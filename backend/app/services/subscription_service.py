"""
Subscription Service
====================
Single source of truth for plan definitions, billing cycle calculations,
and usage alerting. Used by routers/subscription.py.

Plan hierarchy
--------------
  essential (free tier / entry)  →  pro  →  enterprise
  plan_rank(): essential=0, pro=1, enterprise=2

Billing cycle
-------------
Cycles are anchored to the account creation day-of-month.
Example: account created on the 15th → bills on the 15th every month.
The safe_billing_date() helper clamps to the last valid day for short months
(e.g., created on the 31st → Feb bills on the 28th/29th).

Usage alerts
------------
check_usage_alert() is called after every completed call (voice.py → status endpoint).
It sends a single email alert when the owner hits 80% of their monthly call limit.
The alert timestamp is persisted in owners.usage_alert_sent_at so it only fires
once per billing cycle across all backend workers/pods.
"""
import calendar
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session


# ── Plan definitions ──────────────────────────────────────────────────────────
# This dict is the authoritative source for plan names, pricing, features, and limits.
# The frontend reads it via GET /api/subscription/plans.
# The backend enforces limits using the "limits" sub-dict.
PLANS: dict = {
    "essential": {
        "name": "Essential",
        "price": 79.99,
        "price_label": "$79.99/mo",
        "calls_per_month": 150,
        "ai_model": "Claude Haiku",
        "features": [
            "Up to 150 AI calls/month",
            "Instant call answering 24/7",
            "Full order taking & confirmation",
            "SMS order notifications",
            "5 knowledge base documents",
            "Stripe payment links",
            "Email support",
        ],
        "limits": {
            "calls_per_month": 150,
            "documents": 5,
            "menu_items": 50,
            "sms_enabled": True,
            "analytics": False,
            "priority_support": False,
        },
    },
    "pro": {
        "name": "Pro",
        "price": 199,
        "price_label": "$199/mo",
        "calls_per_month": 500,
        "ai_model": "Claude Haiku + Sonnet",
        "features": [
            "Up to 500 AI calls/month",
            "Advanced allergy & dietary detection",
            "SMS + Stripe payment links",
            "20 knowledge base documents",
            "Full analytics dashboard",
            "Call recording & transcripts",
            "Priority email support",
        ],
        "limits": {
            "calls_per_month": 500,
            "documents": 20,
            "menu_items": 200,
            "sms_enabled": True,
            "analytics": True,
            "priority_support": True,
        },
        "popular": True,
    },
    "enterprise": {
        "name": "Enterprise",
        "price": 499,
        "price_label": "$499/mo",
        "calls_per_month": 2000,
        "ai_model": "Claude Sonnet (all calls)",
        "features": [
            "Up to 2,000 AI calls/month",
            "Claude Sonnet on every call",
            "Full allergy & dietary handling",
            "Unlimited knowledge base documents",
            "Advanced analytics & reports",
            "Multi-location support",
            "Dedicated account manager",
            "Custom AI personality & training",
        ],
        "limits": {
            "calls_per_month": 2000,
            "documents": -1,       # -1 = unlimited
            "menu_items": -1,
            "sms_enabled": True,
            "analytics": True,
            "priority_support": True,
        },
    },
}


# ── Plan utilities ────────────────────────────────────────────────────────────

def plan_rank(plan: str) -> int:
    """
    Return a numeric rank for comparing plan tiers.
    Higher number = higher tier (more expensive / more features).
    Used to determine whether a plan change is an upgrade or downgrade.
    """
    return {"essential": 0, "pro": 1, "enterprise": 2}.get(plan, 0)


# ── Billing cycle ─────────────────────────────────────────────────────────────

def safe_billing_date(base_date: datetime, year: int, month: int) -> datetime:
    """
    Return a datetime clamped to the last valid day of the given month.

    Handles edge cases like accounts created on the 29th, 30th, or 31st
    when the target month has fewer days (e.g., February).

    Args:
        base_date: The "anchor" date (typically owner.created_at).
        year:      Target year.
        month:     Target month (1–12).

    Returns:
        A datetime with the clamped day and time reset to midnight.
    """
    last_day = calendar.monthrange(year, month)[1]
    day = min(base_date.day, last_day)
    return base_date.replace(
        year=year, month=month, day=day,
        hour=0, minute=0, second=0, microsecond=0,
    )


def billing_cycle_start(owner) -> datetime:
    """
    Calculate the start of the owner's current billing cycle.
    """
    from datetime import timezone

    created = owner.created_at or datetime.now(timezone.utc)
    if isinstance(created, str):
        created = datetime.fromisoformat(created)

    # Make created timezone naive to match
    if created.tzinfo is not None:
        created = created.replace(tzinfo=None)

    now = datetime.utcnow()
    cycle_start = safe_billing_date(created, now.year, now.month)

    if cycle_start > now:
        # Before this month's billing date — step back one month
        if now.month == 1:
            cycle_start = safe_billing_date(created, now.year - 1, 12)
        else:
            cycle_start = safe_billing_date(created, now.year, now.month - 1)

    return cycle_start

# ── Usage alerts ──────────────────────────────────────────────────────────────

def check_usage_alert(db: Session, owner) -> None:
    """
    Send an 80% usage alert email if the owner is approaching their call limit.

    Called after every completed call via voice.py → /voice/status webhook.
    Safe to call repeatedly — idempotent within a billing cycle.

    Skips if:
    - Plan is unlimited (calls_per_month == -1)
    - An alert was already sent this billing cycle (usage_alert_sent_at >= cycle_start)
    - Owner has no restaurants

    Side effects:
    - Sets owner.usage_alert_sent_at and commits to DB before sending the email
      (prevents double-send even if the email service is slow)
    - Sends one email via email_service.send_usage_alert()
    """
    from app.models.call_log import CallLog
    from app.services.email_service import send_usage_alert

    plan_key = owner.plan or "essential"
    plan = PLANS.get(plan_key)
    if not plan:
        return

    calls_limit: int = plan["limits"]["calls_per_month"]
    if calls_limit == -1:
        return  # Unlimited plan — no alert needed

    cycle_start = billing_cycle_start(owner)

    # Already sent an alert this billing cycle — don't spam
    if owner.usage_alert_sent_at and owner.usage_alert_sent_at >= cycle_start:
        return

    restaurant_ids = [r.id for r in owner.restaurants] if owner.restaurants else []
    if not restaurant_ids:
        return

    calls_used: int = (
        db.query(CallLog)
        .filter(
            CallLog.restaurant_id.in_(restaurant_ids),
            CallLog.created_at >= cycle_start,
        )
        .count()
    )

    pct = (calls_used / calls_limit) * 100 if calls_limit > 0 else 0
    if pct >= 80:
        # Persist timestamp first to prevent race-condition double sends
        owner.usage_alert_sent_at = datetime.utcnow()
        db.commit()

        send_usage_alert(
            to_email=owner.email,
            restaurant_name=owner.restaurant_name or "Your Restaurant",
            calls_used=calls_used,
            calls_limit=calls_limit,
            percentage=int(pct),
        )
        print(
            f"[Usage Alert] Sent 80% alert to {owner.email}: "
            f"{calls_used}/{calls_limit} ({int(pct)}%)"
        )
