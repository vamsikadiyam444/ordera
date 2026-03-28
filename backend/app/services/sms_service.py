"""
SMS Notification Service via Telnyx
Sends order confirmations and payment links to customers.
"""
import telnyx
from app.config import settings

_client = telnyx.Telnyx(api_key=settings.TELNYX_API_KEY)


def send_sms(to_phone: str, from_phone: str, message: str) -> bool:
    """Send an SMS message. Returns True on success."""
    try:
        params = {
            "from_": from_phone,
            "to": to_phone,
            "text": message,
        }
        if settings.TELNYX_MESSAGING_PROFILE_ID:
            params["messaging_profile_id"] = settings.TELNYX_MESSAGING_PROFILE_ID
        _client.messages.create(**params)
        return True
    except Exception as e:
        print(f"[SMS] Error sending to {to_phone}: {e}")
        return False


def send_order_confirmation(
    customer_phone: str,
    restaurant_phone: str,
    order_id: str,
    restaurant_name: str,
    items_summary: str,
    total: float,
    payment_link: str = None,
    wait_minutes: str = "20",
) -> bool:
    """Send order confirmation SMS with optional payment link."""
    message_lines = [
        f"✅ Order confirmed at {restaurant_name}!",
        f"",
        f"Your order:",
        items_summary,
        f"",
        f"Total: ${total:.2f}",
        f"Estimated wait: {wait_minutes} mins",
    ]

    if payment_link:
        message_lines += [
            f"",
            f"Pay securely here:",
            payment_link,
        ]

    message_lines.append(f"\nThank you for your order!")
    message = "\n".join(message_lines)

    return send_sms(customer_phone, restaurant_phone, message)


def send_payment_link(
    customer_phone: str,
    restaurant_phone: str,
    restaurant_name: str,
    payment_link: str,
    total: float,
) -> bool:
    """Send a standalone payment link SMS."""
    message = (
        f"{restaurant_name} - Payment Request\n\n"
        f"Total: ${total:.2f}\n\n"
        f"Pay securely here: {payment_link}\n\n"
        f"Thank you!"
    )
    return send_sms(customer_phone, restaurant_phone, message)
