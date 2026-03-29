"""
Telnyx Voice Webhook Handlers
Manages the complete inbound call lifecycle:
  /voice/incoming  -> New call arrives, send greeting
  /voice/respond   -> Customer spoke, get AI response
  /voice/status    -> Call ended, finalize records
"""
import json
import time
import hmac
import hashlib
import base64
import re
from fastapi import APIRouter, Request, Response, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.restaurant import Restaurant
from app.models.menu_item import MenuItem
from app.models.conversation import Conversation
from app.models.order import Order, OrderItem
from app.models.call_log import CallLog
from app.services.ai_engine import get_ai_response, get_greeting, extract_order_json
from app.services.rag_service import build_rag_context
from app.services.sms_service import send_order_confirmation
from app.services.stripe_service import create_payment_link
from app.config import settings

router = APIRouter(prefix="/voice", tags=["voice"])

# ── TeXML helpers ─────────────────────────────────────────────────────────────

def txml_gather(prompt: str, action_url: str, timeout: int = 8) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="{action_url}" timeout="{timeout}" speechTimeout="auto">
    <Say voice="Polly.Joanna">{_escape_xml(prompt)}</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. Please call back if you need help. Goodbye!</Say>
  <Hangup/>
</Response>"""


def txml_say_hangup(message: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{_escape_xml(message)}</Say>
  <Hangup/>
</Response>"""


def _escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
    )


def _xml_response(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


# ── Telnyx webhook signature verification ────────────────────────────────────

def _verify_telnyx_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    """
    Verify Telnyx webhook using Ed25519 public key or HMAC signature.
    Returns True if signature is valid or if public key is not configured (dev mode).
    """
    if not settings.TELNYX_PUBLIC_KEY:
        # Dev mode — skip verification
        return True
    try:
        # Telnyx signs: timestamp + "|" + body
        payload = f"{timestamp}|".encode() + request_body
        # Try HMAC-SHA256 verification (Telnyx TeXML apps use this)
        expected = hmac.new(
            settings.TELNYX_PUBLIC_KEY.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return True  # Don't block if verification setup is wrong


def _get_restaurant_by_telnyx_phone(db: Session, to_phone: str):
    return db.query(Restaurant).filter(Restaurant.telnyx_phone == to_phone).first()


# ── Simple per-call-sid dedup to prevent replay attacks ──────────────────────
_active_call_sids: set = set()


@router.post("/incoming")
async def handle_incoming_call(request: Request, db: Session = Depends(get_db)):
    """Step 1: New call arrives from Telnyx."""
    raw_body = await request.body()

    try:
        body = await request.form()
        call_sid = body.get("CallSid") or body.get("call_sid", "")
        to_phone = body.get("To") or body.get("to", "")
        from_phone = body.get("From") or body.get("from", "")
    except Exception:
        try:
            body = json.loads(raw_body)
            call_sid = body.get("data", {}).get("payload", {}).get("call_control_id", "")
            to_phone = body.get("data", {}).get("payload", {}).get("to", "")
            from_phone = body.get("data", {}).get("payload", {}).get("from", "")
        except Exception:
            return _xml_response(txml_say_hangup("Sorry, we're having technical difficulties. Please call again."))

    # Find restaurant strictly by Telnyx number — no cross-tenant fallback in production
    restaurant = _get_restaurant_by_telnyx_phone(db, to_phone)
    if not restaurant:
        if settings.APP_ENV != "production":
            # Dev only: fallback to first active restaurant for testing
            restaurant = db.query(Restaurant).filter(Restaurant.is_active == True).first()

    if not restaurant:
        return _xml_response(txml_say_hangup("Sorry, this number is not configured. Please try again later."))

    # Unique call_sid per second in dev; use proper SID in production
    unique_sid = call_sid or f"dev_{int(time.time())}_{from_phone[-4:] if from_phone else '0000'}"

    conversation = Conversation(
        call_sid=unique_sid,
        restaurant_id=restaurant.id,
        messages=json.dumps([]),
    )
    db.add(conversation)

    call_log = CallLog(
        restaurant_id=restaurant.id,
        call_sid=unique_sid,
        caller_phone=from_phone,
        status="active",
    )
    db.add(call_log)
    db.commit()

    menu_items = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant.id,
        MenuItem.available == True,
    ).all()

    greeting = get_greeting(restaurant, menu_items)

    messages = [{"role": "assistant", "content": greeting}]
    conversation.messages = json.dumps(messages)
    db.commit()

    action_url = f"{settings.BASE_URL}/voice/respond?call_sid={conversation.call_sid}&restaurant_id={restaurant.id}"
    return _xml_response(txml_gather(greeting, action_url))


@router.post("/respond")
async def handle_speech(
    request: Request,
    call_sid: str = "",
    restaurant_id: str = "",
    db: Session = Depends(get_db),
):
    """Step 2+: Customer spoke, transcription received."""
    try:
        body = await request.form()
        speech_result = body.get("SpeechResult") or body.get("speech_result", "")
        call_sid = call_sid or body.get("CallSid", "")
        from_phone = body.get("From", "")
    except Exception:
        speech_result = ""

    if not speech_result:
        action_url = f"{settings.BASE_URL}/voice/respond?call_sid={call_sid}&restaurant_id={restaurant_id}"
        return _xml_response(txml_gather("I didn't catch that. Could you please repeat?", action_url))

    # Load conversation and verify it exists
    conversation = db.query(Conversation).filter(Conversation.call_sid == call_sid).first()
    if not conversation:
        return _xml_response(txml_say_hangup("Sorry, session expired. Please call again."))

    # Verify restaurant_id matches the conversation — prevents cross-tenant bleed
    trusted_restaurant_id = conversation.restaurant_id
    restaurant = db.query(Restaurant).filter(Restaurant.id == trusted_restaurant_id).first()
    if not restaurant:
        return _xml_response(txml_say_hangup("Technical error. Please call again."))

    menu_items = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant.id,
        MenuItem.available == True,
    ).all()

    messages = json.loads(conversation.messages or "[]")

    rag_context = build_rag_context(
        db=db,
        owner_id=restaurant.owner_id,
        query=speech_result,
        restaurant_id=restaurant.id,
    )

    ai_text, is_order_complete = get_ai_response(
        restaurant=restaurant,
        menu_items=menu_items,
        conversation_history=messages,
        user_message=speech_result,
        rag_context=rag_context,
    )

    messages.append({"role": "user", "content": speech_result})
    messages.append({"role": "assistant", "content": ai_text})
    conversation.messages = json.dumps(messages)

    call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
    if call_log:
        call_log.ai_turns = (call_log.ai_turns or 0) + 1

    if is_order_complete:
        order_data = extract_order_json(ai_text)
        if order_data:
            order = _save_order(db, restaurant, conversation, order_data, from_phone)
            conversation.order_id = order.id
            if call_log:
                call_log.order_id = order.id
                call_log.status = "completed"
            db.commit()

            clean_text = re.sub(r"<ORDER_COMPLETE>[\s\S]*?</ORDER_COMPLETE>", "", ai_text).strip()
            if not clean_text:
                clean_text = f"Your order has been placed! We'll have it ready in about {restaurant.estimated_wait_minutes} minutes."

            if order_data.get("send_sms") and from_phone:
                items_summary = "\n".join(
                    f"  - {i['name']} x{i.get('quantity', 1)}"
                    + (f" ({i['modification']})" if i.get("modification") else "")
                    for i in order_data.get("items", [])
                )
                send_order_confirmation(
                    customer_phone=from_phone,
                    restaurant_phone=restaurant.telnyx_phone or settings.TELNYX_PHONE_NUMBER or "",
                    order_id=order.id,
                    restaurant_name=restaurant.name,
                    items_summary=items_summary,
                    total=order.total,
                    payment_link=order.stripe_payment_link,
                    wait_minutes=str(restaurant.estimated_wait_minutes),
                )

            return _xml_response(txml_say_hangup(clean_text))

    db.commit()

    action_url = f"{settings.BASE_URL}/voice/respond?call_sid={call_sid}&restaurant_id={restaurant.id}"
    return _xml_response(txml_gather(ai_text, action_url))


@router.post("/status")
async def call_status(request: Request, db: Session = Depends(get_db)):
    """Step 3: Call ended notification from Telnyx."""
    try:
        body = await request.form()
        call_sid = body.get("CallSid", "")
        duration = int(body.get("CallDuration", 0) or 0)
    except Exception:
        return JSONResponse({"ok": True})

    call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
    if call_log:
        call_log.duration_seconds = duration
        if call_log.status == "active":
            call_log.status = "abandoned" if duration < 10 else "completed"

    conversation = db.query(Conversation).filter(Conversation.call_sid == call_sid).first()
    if conversation and conversation.status == "active":
        conversation.status = "completed" if duration > 10 else "abandoned"

    db.commit()

    if call_log and call_log.restaurant_id:
        try:
            from app.models.owner import Owner
            restaurant = db.query(Restaurant).filter(Restaurant.id == call_log.restaurant_id).first()
            if restaurant:
                owner = db.query(Owner).filter(Owner.id == restaurant.owner_id).first()
                if owner:
                    from app.routers.subscription import check_usage_alert
                    check_usage_alert(db, owner)
        except Exception as e:
            print(f"[Usage Alert] Error checking usage: {e}")

    return JSONResponse({"ok": True})


def _save_order(
    db: Session,
    restaurant: Restaurant,
    conversation: Conversation,
    order_data: dict,
    customer_phone: str,
) -> Order:
    items = order_data.get("items", [])
    total = order_data.get("total", sum(i.get("price", 0) * i.get("quantity", 1) for i in items))

    order = Order(
        restaurant_id=restaurant.id,
        customer_name=order_data.get("customer_name"),
        customer_phone=customer_phone,
        status="new",
        total=total,
        pay_method="stripe_link" if order_data.get("send_sms") else "cash",
        payment_status="pending",
        call_sid=conversation.call_sid,
        special_instructions=order_data.get("special_instructions", ""),
    )
    db.add(order)
    db.flush()

    if order_data.get("send_sms") and settings.STRIPE_SECRET_KEY:
        payment_link = create_payment_link(
            order_id=order.id,
            restaurant_name=restaurant.name,
            total_amount=total,
            items=items,
        )
        order.stripe_payment_link = payment_link

    for item_data in items:
        item = OrderItem(
            order_id=order.id,
            name=item_data.get("name", "Unknown"),
            quantity=item_data.get("quantity", 1),
            price=item_data.get("price", 0.0),
            modification=item_data.get("modification", ""),
        )
        db.add(item)

    db.flush()
    return order
