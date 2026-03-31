"""
Stripe payment integration.
- One-time payment links for orders
- Subscription checkout sessions for plans
- Customer portal for billing management
- Webhook verification
"""
from typing import Optional
import stripe
from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

# ── Map plan names to Stripe Price IDs ────────────────────────────────────────

PLAN_PRICE_MAP = {
    "basic": settings.STRIPE_PRICE_ID_BASIC,
    "pro": settings.STRIPE_PRICE_ID_PRO,
    "enterprise": settings.STRIPE_PRICE_ID_ENTERPRISE,
}


# ── Order Payments (one-time) ─────────────────────────────────────────────────

def create_payment_link(
    order_id: str,
    restaurant_name: str,
    total_amount: float,
    items: list,
) -> Optional[str]:
    """
    Create a Stripe Checkout session for a one-time order payment.
    Returns the checkout URL.
    """
    try:
        line_items = []
        for item in items:
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"{item.get('name', 'Item')} x{item.get('quantity', 1)}",
                        "description": item.get("modification") or None,
                    },
                    "unit_amount": int(item.get("price", 0) * 100),
                },
                "quantity": item.get("quantity", 1),
            })

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=f"{settings.BASE_URL}/payment/success?order_id={order_id}",
            cancel_url=f"{settings.BASE_URL}/payment/cancel?order_id={order_id}",
            metadata={"order_id": order_id, "restaurant": restaurant_name},
        )
        return session.url

    except stripe.StripeError as e:
        print(f"[Stripe] Error creating payment link: {e}")
        return None


# ── Subscription Payments ─────────────────────────────────────────────────────

def get_or_create_customer(owner_id: str, email: str, name: str) -> Optional[str]:
    """
    Get existing Stripe customer or create a new one.
    Returns the Stripe customer ID.
    """
    try:
        # Search for existing customer by email
        customers = stripe.Customer.list(email=email, limit=1)
        if customers.data:
            return customers.data[0].id

        # Create new customer
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"owner_id": owner_id},
        )
        return customer.id

    except stripe.StripeError as e:
        print(f"[Stripe] Error with customer: {e}")
        return None


def create_subscription_checkout(
    owner_id: str,
    email: str,
    restaurant_name: str,
    plan: str,
    customer_id: Optional[str] = None,
) -> Optional[dict]:
    """
    Create a Stripe Checkout session for a subscription plan.
    Returns dict with session_id and url.
    """
    price_id = PLAN_PRICE_MAP.get(plan)
    if not price_id:
        print(f"[Stripe] No price ID configured for plan: {plan}")
        return None

    try:
        # Get or create customer
        if not customer_id:
            customer_id = get_or_create_customer(owner_id, email, restaurant_name)

        session_params = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": f"{settings.FRONTEND_URL}/subscription?payment=success&plan={plan}",
            "cancel_url": f"{settings.FRONTEND_URL}/subscription?payment=cancelled",
            "metadata": {
                "owner_id": owner_id,
                "plan": plan,
            },
            "subscription_data": {
                "metadata": {
                    "owner_id": owner_id,
                    "plan": plan,
                },
            },
            "allow_promotion_codes": True,
        }

        # Attach customer if we have one
        if customer_id:
            session_params["customer"] = customer_id
        else:
            session_params["customer_email"] = email

        session = stripe.checkout.Session.create(**session_params)

        return {
            "session_id": session.id,
            "url": session.url,
        }

    except stripe.StripeError as e:
        print(f"[Stripe] Error creating subscription checkout: {e}")
        return None


def create_customer_portal_session(customer_id: str) -> Optional[str]:
    """
    Create a Stripe Customer Portal session for managing billing.
    Returns the portal URL.
    """
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.FRONTEND_URL}/subscription",
        )
        return session.url

    except stripe.StripeError as e:
        print(f"[Stripe] Error creating portal session: {e}")
        return None


def cancel_subscription(subscription_id: str) -> bool:
    """Cancel a Stripe subscription at period end."""
    try:
        stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )
        return True
    except stripe.StripeError as e:
        print(f"[Stripe] Error cancelling subscription: {e}")
        return False


def get_subscription_details(subscription_id: str) -> Optional[dict]:
    """Get details of a Stripe subscription."""
    try:
        sub = stripe.Subscription.retrieve(subscription_id)
        return {
            "id": sub.id,
            "status": sub.status,
            "current_period_start": sub.current_period_start,
            "current_period_end": sub.current_period_end,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "plan": sub.metadata.get("plan"),
        }
    except stripe.StripeError as e:
        print(f"[Stripe] Error getting subscription: {e}")
        return None


# ── Webhook Verification ──────────────────────────────────────────────────────

def verify_webhook(payload: bytes, sig_header: str) -> Optional[dict]:
    """Verify and parse a Stripe webhook event."""
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
    except (ValueError, stripe.SignatureVerificationError):
        return None
