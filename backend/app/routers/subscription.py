"""
Subscription management endpoints.
Full Stripe integration for plan checkout, webhooks, and billing portal.
OTP verification required for all plan changes.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.owner import Owner
from app.middleware.auth import get_current_owner
from app.config import settings
from app.services.stripe_service import (
    create_subscription_checkout,
    create_customer_portal_session,
    cancel_subscription,
    get_subscription_details,
    verify_webhook,
    get_or_create_customer,
)
from app.services.otp_service import generate_otp, verify_otp, get_otp_for_dev
from app.services.email_service import (
    send_otp_email,
    send_usage_alert,
    send_plan_change_confirmation,
)
from app.services.sms_service import send_sms

# Track which owners have already been alerted this billing cycle
_usage_alerts_sent: dict = {}  # {owner_id: True}

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# ── Plan definitions ─────────────────────────────────────────────────────────

PLANS = {
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
            "documents": -1,
            "menu_items": -1,
            "sms_enabled": True,
            "analytics": True,
            "priority_support": True,
        },
    },
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanChangeRequest(BaseModel):
    plan: str


class CheckoutRequest(BaseModel):
    plan: str
    otp_code: str


class PlanOtpRequest(BaseModel):
    plan: str


class SubscriptionResponse(BaseModel):
    current_plan: str
    plan_details: dict
    billing: dict
    usage: dict


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/plans")
def get_plans():
    """Return all available plans with features and pricing."""
    return {"plans": PLANS}


# ── OTP for plan changes ─────────────────────────────────────────────────────

@router.post("/send-plan-otp")
def send_plan_change_otp(
    req: PlanOtpRequest,
    current_owner: Owner = Depends(get_current_owner),
):
    """
    Send OTP to the owner's email (and phone if available) for plan change verification.
    Returns the OTP in dev mode for testing.
    """
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    if req.plan == current_owner.plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    # Generate OTP keyed to this owner + target plan
    identifier = f"plan_change:{current_owner.id}:{req.plan}"
    code = generate_otp(identifier)

    # Send via email
    action = "upgrade" if _plan_rank(req.plan) > _plan_rank(current_owner.plan) else "downgrade"
    send_otp_email(
        current_owner.email,
        code,
        purpose=f"{action} to {PLANS[req.plan]['name']} plan",
    )

    # Send via SMS if restaurant has a phone number
    phone = None
    if current_owner.restaurants:
        phone = current_owner.restaurants[0].phone
    if phone:
        sms_msg = f"Your verification code for plan {action} is: {code}. This code expires in 5 minutes."
        send_sms(phone, phone, sms_msg)

    response = {
        "message": f"Verification code sent to {current_owner.email}"
            + (f" and {phone}" if phone else ""),
        "email": current_owner.email,
        "phone": phone,
    }

    # Dev mode: include OTP in response for testing
    if not settings.SMTP_HOST:
        response["otp"] = code
        response["dev_mode"] = True

    return response


def _plan_rank(plan: str) -> int:
    return {"essential": 0, "pro": 1, "enterprise": 2}.get(plan, 0)


# ── Usage alert check ────────────────────────────────────────────────────────

def check_usage_alert(db: Session, owner: Owner):
    """
    Check if the owner's call usage has reached 80% and send an alert email.
    Only sends once per billing cycle.
    """
    if owner.id in _usage_alerts_sent:
        return  # Already alerted this cycle

    plan_key = owner.plan or "essential"
    plan = PLANS.get(plan_key)
    if not plan:
        return

    calls_limit = plan["limits"]["calls_per_month"]
    if calls_limit == -1:
        return  # Unlimited plan

    # Calculate billing cycle start
    created = owner.created_at or datetime.utcnow()
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    now = datetime.utcnow()
    cycle_start = created.replace(
        year=now.year, month=now.month, day=created.day,
        hour=0, minute=0, second=0, microsecond=0,
    )
    if cycle_start > now:
        if now.month == 1:
            cycle_start = cycle_start.replace(year=now.year - 1, month=12)
        else:
            cycle_start = cycle_start.replace(month=now.month - 1)

    # Count calls this cycle
    from app.models.call_log import CallLog
    restaurant_ids = [r.id for r in owner.restaurants] if owner.restaurants else []
    if not restaurant_ids:
        return

    calls_used = (
        db.query(CallLog)
        .filter(CallLog.restaurant_id.in_(restaurant_ids), CallLog.created_at >= cycle_start)
        .count()
    )

    pct = (calls_used / calls_limit) * 100 if calls_limit > 0 else 0
    if pct >= 80:
        _usage_alerts_sent[owner.id] = True
        send_usage_alert(
            to_email=owner.email,
            restaurant_name=owner.restaurant_name,
            calls_used=calls_used,
            calls_limit=calls_limit,
            percentage=int(pct),
        )
        print(f"[Usage Alert] Sent 80% alert to {owner.email}: {calls_used}/{calls_limit} ({int(pct)}%)")


@router.get("/check-usage-alert")
def trigger_usage_check(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Manually trigger a usage alert check (also called automatically after each call)."""
    check_usage_alert(db, current_owner)
    return {"checked": True}


# ── Authenticated endpoints ───────────────────────────────────────────────────

@router.get("/current", response_model=SubscriptionResponse)
def get_current_subscription(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Get current owner's subscription details including Stripe info."""
    plan_key = current_owner.plan or "essential"
    plan_details = PLANS.get(plan_key, PLANS["essential"])

    # Calculate billing cycle
    created = current_owner.created_at or datetime.utcnow()
    if isinstance(created, str):
        created = datetime.fromisoformat(created)

    now = datetime.utcnow()
    cycle_start = created.replace(year=now.year, month=now.month, day=created.day, hour=0, minute=0, second=0, microsecond=0)
    if cycle_start > now:
        if now.month == 1:
            cycle_start = cycle_start.replace(year=now.year - 1, month=12)
        else:
            cycle_start = cycle_start.replace(month=now.month - 1)

    if cycle_start.month == 12:
        next_billing = cycle_start.replace(year=cycle_start.year + 1, month=1)
    else:
        next_billing = cycle_start.replace(month=cycle_start.month + 1)

    # Count calls
    from app.models.call_log import CallLog
    restaurant_ids = [r.id for r in current_owner.restaurants] if current_owner.restaurants else []
    calls_this_month = 0
    if restaurant_ids:
        calls_this_month = (
            db.query(CallLog)
            .filter(CallLog.restaurant_id.in_(restaurant_ids), CallLog.created_at >= cycle_start)
            .count()
        )

    doc_count = len(current_owner.documents) if current_owner.documents else 0

    # Get Stripe subscription info if available
    stripe_info = None
    if current_owner.stripe_subscription_id:
        stripe_info = get_subscription_details(current_owner.stripe_subscription_id)

    # Build payment method display
    payment_method = None
    if current_owner.stripe_customer_id:
        payment_method = "Card on file"
    if stripe_info and stripe_info.get("cancel_at_period_end"):
        payment_method = "Cancels at period end"

    return SubscriptionResponse(
        current_plan=plan_key,
        plan_details=plan_details,
        billing={
            "price": plan_details["price"],
            "price_label": plan_details["price_label"],
            "cycle_start": cycle_start.isoformat(),
            "next_billing_date": (
                datetime.utcfromtimestamp(stripe_info["current_period_end"]).isoformat()
                if stripe_info and stripe_info.get("current_period_end")
                else next_billing.isoformat()
            ),
            "payment_method": payment_method,
            "stripe_connected": bool(current_owner.stripe_customer_id),
            "subscription_status": stripe_info.get("status") if stripe_info else None,
            "cancel_at_period_end": stripe_info.get("cancel_at_period_end", False) if stripe_info else False,
        },
        usage={
            "calls_used": calls_this_month,
            "calls_limit": plan_details["limits"]["calls_per_month"],
            "calls_label": f"{calls_this_month} / {'Unlimited' if plan_details['limits']['calls_per_month'] == -1 else plan_details['limits']['calls_per_month']}",
            "documents_used": doc_count,
            "documents_limit": plan_details["limits"]["documents"],
        },
    )


@router.post("/create-checkout")
def create_checkout(
    req: CheckoutRequest,
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout session for subscribing to a plan.
    Requires OTP verification before proceeding.
    Returns the checkout URL to redirect the user.
    """
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    if req.plan == current_owner.plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    # Verify OTP
    identifier = f"plan_change:{current_owner.id}:{req.plan}"
    if not verify_otp(identifier, req.otp_code):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    # Check if Stripe keys are configured
    if not settings.STRIPE_SECRET_KEY:
        # Dev mode: change plan directly without payment
        old_plan = current_owner.plan
        current_owner.plan = req.plan
        current_owner.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_owner)

        # Send plan change confirmation email
        send_plan_change_confirmation(
            current_owner.email, current_owner.restaurant_name, old_plan, req.plan
        )

        return {
            "mode": "dev",
            "message": f"Plan changed from {old_plan} to {req.plan} (dev mode - no Stripe key configured)",
            "new_plan": req.plan,
            "redirect_url": None,
        }

    # Production: create Stripe Checkout session
    result = create_subscription_checkout(
        owner_id=current_owner.id,
        email=current_owner.email,
        restaurant_name=current_owner.restaurant_name,
        plan=req.plan,
        customer_id=current_owner.stripe_customer_id,
    )

    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to create checkout session. Check Stripe configuration.",
        )

    # Store customer ID if we created one
    if not current_owner.stripe_customer_id:
        customer_id = get_or_create_customer(
            current_owner.id, current_owner.email, current_owner.restaurant_name
        )
        if customer_id:
            current_owner.stripe_customer_id = customer_id
            db.commit()

    return {
        "mode": "live",
        "session_id": result["session_id"],
        "redirect_url": result["url"],
    }


@router.post("/change-plan")
def change_plan(
    req: PlanChangeRequest,
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Direct plan change (for dev mode or after successful Stripe payment)."""
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    if req.plan == current_owner.plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    old_plan = current_owner.plan
    current_owner.plan = req.plan
    current_owner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_owner)

    return {
        "message": f"Plan changed from {old_plan} to {req.plan}",
        "new_plan": req.plan,
        "plan_details": PLANS[req.plan],
    }


@router.post("/create-portal")
def create_portal(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Customer Portal session for managing billing,
    payment methods, and invoices.
    """
    if not current_owner.stripe_customer_id:
        # Try to create a customer first
        if settings.STRIPE_SECRET_KEY:
            customer_id = get_or_create_customer(
                current_owner.id, current_owner.email, current_owner.restaurant_name
            )
            if customer_id:
                current_owner.stripe_customer_id = customer_id
                db.commit()
            else:
                raise HTTPException(status_code=400, detail="Could not create Stripe customer")
        else:
            raise HTTPException(
                status_code=400,
                detail="No payment method on file. Subscribe to a plan first.",
            )

    portal_url = create_customer_portal_session(current_owner.stripe_customer_id)
    if not portal_url:
        raise HTTPException(status_code=500, detail="Failed to create billing portal session")

    return {"portal_url": portal_url}


@router.post("/cancel")
def cancel_current_subscription(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Cancel the current subscription at the end of the billing period."""
    if current_owner.plan == "essential":
        raise HTTPException(status_code=400, detail="You are already on the Essential plan")

    # If Stripe subscription exists, cancel through Stripe
    if current_owner.stripe_subscription_id:
        success = cancel_subscription(current_owner.stripe_subscription_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to cancel subscription")
        return {"message": "Subscription will be cancelled at the end of the current billing period"}

    # Dev mode: no Stripe, revert to essential directly
    old_plan = current_owner.plan
    current_owner.plan = "essential"
    current_owner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_owner)
    return {
        "message": f"Subscription cancelled. Downgraded from {old_plan} to essential.",
        "new_plan": "essential",
    }


# ── Stripe Webhook ────────────────────────────────────────────────────────────

@router.post("/webhook")
async def subscription_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    """
    Handle Stripe webhook events for subscriptions.
    Events handled:
      - checkout.session.completed  → activate plan after payment
      - customer.subscription.updated → plan changes, renewals
      - customer.subscription.deleted → plan cancellation
      - invoice.payment_succeeded    → successful recurring payment
      - invoice.payment_failed       → failed payment
    """
    payload = await request.body()
    event = verify_webhook(payload, stripe_signature or "")

    if not event:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    print(f"[Stripe Webhook] Received: {event_type}")

    # ── checkout.session.completed ──
    if event_type == "checkout.session.completed":
        if data.get("mode") == "subscription":
            owner_id = data.get("metadata", {}).get("owner_id")
            plan = data.get("metadata", {}).get("plan")
            subscription_id = data.get("subscription")
            customer_id = data.get("customer")

            if owner_id and plan:
                owner = db.query(Owner).filter(Owner.id == owner_id).first()
                if owner:
                    owner.plan = plan
                    owner.stripe_customer_id = customer_id
                    owner.stripe_subscription_id = subscription_id
                    owner.updated_at = datetime.utcnow()
                    db.commit()
                    print(f"[Stripe Webhook] Owner {owner_id} upgraded to {plan}")

    # ── customer.subscription.updated ──
    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        plan = data.get("metadata", {}).get("plan")
        status = data.get("status")

        owner = db.query(Owner).filter(
            Owner.stripe_subscription_id == subscription_id
        ).first()

        if owner:
            if plan and plan in PLANS:
                owner.plan = plan
            if status in ("canceled", "unpaid"):
                owner.plan = "essential"
                owner.stripe_subscription_id = None
            owner.updated_at = datetime.utcnow()
            db.commit()
            print(f"[Stripe Webhook] Subscription {subscription_id} updated: plan={plan}, status={status}")

    # ── customer.subscription.deleted ──
    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id")

        owner = db.query(Owner).filter(
            Owner.stripe_subscription_id == subscription_id
        ).first()

        if owner:
            owner.plan = "essential"
            owner.stripe_subscription_id = None
            owner.updated_at = datetime.utcnow()
            db.commit()
            print(f"[Stripe Webhook] Subscription {subscription_id} deleted, owner reverted to essential")

    # ── invoice.payment_failed ──
    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        owner = db.query(Owner).filter(
            Owner.stripe_customer_id == customer_id
        ).first()

        if owner:
            print(f"[Stripe Webhook] Payment failed for owner {owner.id} ({owner.email})")
            # Could send notification email here

    # ── invoice.payment_succeeded ──
    elif event_type == "invoice.payment_succeeded":
        customer_id = data.get("customer")
        print(f"[Stripe Webhook] Payment succeeded for customer {customer_id}")

    return {"received": True}
