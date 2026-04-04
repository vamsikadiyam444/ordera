"""
Subscription Router
===================
HTTP endpoints for plan management, Stripe checkout, and billing portal.

Business logic (plan definitions, billing cycles, usage alerts) lives in
services/subscription_service.py — this file only handles HTTP concerns.

Endpoints
---------
  GET  /api/subscription/plans            → Return all plans (no auth)
  POST /api/subscription/send-plan-otp    → Email OTP for plan change
  GET  /api/subscription/current          → Current plan + usage + billing
  POST /api/subscription/create-checkout  → Start Stripe Checkout session
  POST /api/subscription/create-portal    → Open Stripe billing portal
  POST /api/subscription/change-plan      → Direct downgrade (no Stripe)
  POST /api/subscription/cancel           → Cancel subscription at period end
  POST /api/subscription/webhook          → Stripe webhook events
  GET  /api/subscription/check-usage-alert → Manually trigger usage check
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_owner
from app.models.owner import Owner
from app.services.email_service import send_otp_email, send_plan_change_confirmation

from app.services.otp_service import generate_otp, verify_otp
from app.services.sms_service import send_sms
from app.services.stripe_service import (
    cancel_subscription,
    create_customer_portal_session,
    create_subscription_checkout,
    get_or_create_customer,
    get_subscription_details,
    verify_webhook,
)
from app.services.subscription_service import (
    PLANS,
    billing_cycle_start,
    check_usage_alert,
    plan_rank,
    safe_billing_date,
)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


# ── Schemas ───────────────────────────────────────────────────────────────────

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
    db: Session = Depends(get_db),
):
    """Send OTP to the owner's email for plan change verification."""
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")
    if req.plan == current_owner.plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    identifier = f"plan_change:{current_owner.id}:{req.plan}"
    code = generate_otp(db, identifier)

    action = "upgrade" if plan_rank(req.plan) > plan_rank(current_owner.plan or "essential") else "downgrade"
    send_otp_email(current_owner.email, code, purpose=f"{action} to {PLANS[req.plan]['name']} plan")

    # Send SMS via Telnyx using the platform number (not the restaurant's own number)
    if settings.TELNYX_API_KEY and settings.TELNYX_PHONE_NUMBER:
        restaurant = current_owner.restaurants[0] if current_owner.restaurants else None
        owner_phone = restaurant.phone if restaurant else None
        if owner_phone and owner_phone != settings.TELNYX_PHONE_NUMBER:
            sms_msg = f"Your Ringa verification code for plan {action}: {code}. Expires in 5 minutes."
            send_sms(owner_phone, settings.TELNYX_PHONE_NUMBER, sms_msg)

    response: dict = {
        "message": f"Verification code sent to {current_owner.email}",
        "email": current_owner.email,
    }
    # Dev mode: return OTP when email not configured
    if settings.APP_ENV != "production" and not settings.SMTP_HOST:
        response["otp"] = code
        response["dev_mode"] = True

    return response


@router.get("/check-usage-alert")
def trigger_usage_check(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Manually trigger a usage alert check."""
    check_usage_alert(db, current_owner)
    return {"checked": True}


# ── Authenticated endpoints ───────────────────────────────────────────────────

@router.get("/current", response_model=SubscriptionResponse)
def get_current_subscription(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    plan_key = current_owner.plan or "essential"
    plan_details = PLANS.get(plan_key, PLANS["essential"])

    cycle_start = billing_cycle_start(current_owner)

    if cycle_start.month == 12:
        next_billing = safe_billing_date(cycle_start, cycle_start.year + 1, 1)
    else:
        next_billing = safe_billing_date(cycle_start, cycle_start.year, cycle_start.month + 1)

    from app.models.call_log import CallLog
    from app.models.order import Order
    restaurant_ids = [r.id for r in current_owner.restaurants] if current_owner.restaurants else []
    calls_this_month = 0
    orders_this_cycle = 0
    revenue_this_cycle = 0.0
    if restaurant_ids:
        calls_this_month = (
            db.query(CallLog)
            .filter(CallLog.restaurant_id.in_(restaurant_ids), CallLog.created_at >= cycle_start)
            .count()
        )
        orders_in_cycle = (
            db.query(Order)
            .filter(Order.restaurant_id.in_(restaurant_ids), Order.created_at >= cycle_start)
            .all()
        )
        orders_this_cycle = len(orders_in_cycle)
        revenue_this_cycle = round(sum(
            o.total for o in orders_in_cycle
            if o.status != "cancelled" and (
                o.payment_status == "paid" or o.pay_method in ("cash", "card_on_pickup")
            )
        ), 2)

    doc_count = len(current_owner.documents) if current_owner.documents else 0

    stripe_info = None
    if current_owner.stripe_subscription_id:
        stripe_info = get_subscription_details(current_owner.stripe_subscription_id)

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
            "orders_this_cycle": orders_this_cycle,
            "revenue_this_cycle": revenue_this_cycle,
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
    Requires OTP verification. In dev mode (no Stripe key) changes plan directly.
    """
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")
    if req.plan == current_owner.plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    identifier = f"plan_change:{current_owner.id}:{req.plan}"
    if not verify_otp(db, identifier, req.otp_code):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if not settings.STRIPE_SECRET_KEY:
        # Dev mode: change plan directly
        old_plan = current_owner.plan or "essential"
        current_owner.plan = req.plan
        current_owner.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_owner)
        send_plan_change_confirmation(current_owner.email, current_owner.restaurant_name or "", old_plan, req.plan)
        return {
            "mode": "dev",
            "message": f"Plan changed from {old_plan} to {req.plan} (dev mode — no Stripe key configured)",
            "new_plan": req.plan,
            "redirect_url": None,
        }

    result = create_subscription_checkout(
        owner_id=current_owner.id,
        email=current_owner.email,
        restaurant_name=current_owner.restaurant_name or "",
        plan=req.plan,
        customer_id=current_owner.stripe_customer_id,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to create checkout session. Check Stripe configuration.")

    if not current_owner.stripe_customer_id:
        customer_id = get_or_create_customer(current_owner.id, current_owner.email, current_owner.restaurant_name or "")
        if customer_id:
            current_owner.stripe_customer_id = customer_id
            db.commit()

    return {
        "mode": "live",
        "session_id": result["session_id"],
        "redirect_url": result["url"],
    }


@router.post("/create-portal")
def create_portal(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    if not current_owner.stripe_customer_id:
        if settings.STRIPE_SECRET_KEY:
            customer_id = get_or_create_customer(current_owner.id, current_owner.email, current_owner.restaurant_name or "")
            if customer_id:
                current_owner.stripe_customer_id = customer_id
                db.commit()
            else:
                raise HTTPException(status_code=400, detail="Could not create Stripe customer")
        else:
            raise HTTPException(status_code=400, detail="No payment method on file. Subscribe to a plan first.")

    portal_url = create_customer_portal_session(current_owner.stripe_customer_id)
    if not portal_url:
        raise HTTPException(status_code=500, detail="Failed to create billing portal session")

    return {"portal_url": portal_url}


class ChangePlanRequest(BaseModel):
    plan: str


@router.post("/change-plan")
def change_plan_direct(
    req: ChangePlanRequest,
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """
    Direct plan change (no Stripe checkout) — used for downgrades from Settings page.
    Upgrades should go through /create-checkout (Stripe payment required).
    """
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    current_plan = current_owner.plan or "essential"
    if req.plan == current_plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    is_upgrade = plan_rank(req.plan) > plan_rank(current_plan)
    if is_upgrade and settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="Upgrades require payment. Use the subscription page to upgrade."
        )

    # Downgrade (or upgrade in dev mode): cancel Stripe subscription at period end if active
    if current_owner.stripe_subscription_id and not is_upgrade:
        cancel_subscription(current_owner.stripe_subscription_id)

    old_plan = current_plan
    current_owner.plan = req.plan
    current_owner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_owner)
    send_plan_change_confirmation(current_owner.email, current_owner.restaurant_name or "", old_plan, req.plan)

    return {
        "message": f"Plan changed from {old_plan} to {req.plan}",
        "new_plan": req.plan,
    }


@router.post("/cancel")
def cancel_current_subscription(
    current_owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Cancel the current subscription at the end of the billing period."""
    plan = current_owner.plan or "essential"
    if plan == "essential":
        raise HTTPException(status_code=400, detail="You are already on the Essential plan")

    if current_owner.stripe_subscription_id:
        success = cancel_subscription(current_owner.stripe_subscription_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to cancel subscription")
        return {"message": "Subscription will be cancelled at the end of the current billing period"}

    old_plan = plan
    current_owner.plan = "essential"
    current_owner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_owner)
    return {"message": f"Subscription cancelled. Downgraded from {old_plan} to essential.", "new_plan": "essential"}


# ── Stripe Webhook ────────────────────────────────────────────────────────────

@router.post("/webhook")
async def subscription_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    """Handle Stripe webhook events for subscriptions."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook secret not configured")

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

            if owner_id and plan and plan in PLANS:
                owner = db.query(Owner).filter(Owner.id == owner_id).first()
                if owner:
                    old_plan = owner.plan or "essential"
                    owner.plan = plan
                    owner.stripe_customer_id = customer_id
                    owner.stripe_subscription_id = subscription_id
                    owner.updated_at = datetime.utcnow()
                    db.commit()
                    send_plan_change_confirmation(owner.email, owner.restaurant_name or "", old_plan, plan)
                    print(f"[Stripe Webhook] Owner {owner_id} upgraded to {plan}")

    # ── customer.subscription.updated ──
    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        plan = data.get("metadata", {}).get("plan")
        sub_status = data.get("status")

        owner = db.query(Owner).filter(Owner.stripe_subscription_id == subscription_id).first()
        if owner:
            if plan and plan in PLANS:
                owner.plan = plan
            if sub_status in ("canceled", "unpaid"):
                owner.plan = "essential"
                owner.stripe_subscription_id = None
            owner.updated_at = datetime.utcnow()
            db.commit()

    # ── customer.subscription.deleted ──
    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id")
        owner = db.query(Owner).filter(Owner.stripe_subscription_id == subscription_id).first()
        if owner:
            owner.plan = "essential"
            owner.stripe_subscription_id = None
            owner.updated_at = datetime.utcnow()
            db.commit()

    # ── invoice.payment_failed ──
    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        owner = db.query(Owner).filter(Owner.stripe_customer_id == customer_id).first()
        if owner:
            print(f"[Stripe Webhook] Payment failed for owner {owner.id} ({owner.email})")

    # ── invoice.payment_succeeded ──
    elif event_type == "invoice.payment_succeeded":
        customer_id = data.get("customer")
        print(f"[Stripe Webhook] Payment succeeded for customer {customer_id}")

    return {"received": True}
