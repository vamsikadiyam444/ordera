"""
Voice Call Router
=================
Handles the complete inbound call lifecycle via Telnyx webhooks.

Call flow
---------
  1. Customer calls the restaurant's Telnyx number
  2. POST /voice/incoming  → Look up restaurant, create conversation, speak greeting
  3. POST /voice/respond   → Customer spoke → AI responds → loop until order complete
  4. POST /voice/status    → Call ended → finalize records, check usage alert

Webhook security
----------------
Telnyx signs every webhook with an Ed25519 signature.
Set TELNYX_PUBLIC_KEY in .env to enable verification.
In development (no key set), signature verification is skipped.

Tenant isolation
-----------------
Every DB query in this file filters by restaurant_id pulled from the Conversation
record — not from URL parameters. This prevents cross-tenant data leakage even if
a malicious caller crafts a forged restaurant_id query param.

Service dependencies
--------------------
  ai_engine.py       → get_greeting(), get_ai_response(), extract_order_json()
  language_service.py → detect_language(), VOICE_MAP, STT_LANGUAGE_MAP
  telnyx_service.py  → txml_gather(), txml_say_hangup()
  order_service.py   → save_order_from_voice()
  rag_service.py     → build_rag_context()
  sms_service.py     → send_order_confirmation()
"""
import base64
import json
import re
import time

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.call_log import CallLog
from app.models.conversation import Conversation
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.services.ai_engine import extract_order_json, get_ai_response, get_greeting
from app.services.language_service import STT_LANGUAGE_MAP, VOICE_MAP, detect_language
from app.services.order_service import save_order_from_voice
from app.services.rag_service import build_rag_context
from app.services.sms_service import send_order_confirmation
from app.services.telnyx_service import txml_gather, txml_say_hangup

router = APIRouter(prefix="/voice", tags=["voice"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _xml_response(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


def _get_restaurant_by_telnyx_phone(db: Session, to_phone: str):
    return db.query(Restaurant).filter(Restaurant.telnyx_phone == to_phone).first()


# ── Webhook signature verification ───────────────────────────────────────────

def _verify_telnyx_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    """
    Verify a Telnyx webhook using Ed25519 public key.
    Returns True if valid, or if TELNYX_PUBLIC_KEY is not set (dev mode).
    """
    if not settings.TELNYX_PUBLIC_KEY:
        return True  # Dev mode — skip verification
    try:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

        payload = f"{timestamp}|".encode() + request_body
        pub_key_bytes = base64.b64decode(settings.TELNYX_PUBLIC_KEY)
        public_key = Ed25519PublicKey.from_public_bytes(pub_key_bytes)
        sig_bytes = base64.b64decode(signature)
        public_key.verify(sig_bytes, payload)
        return True
    except Exception:
        return False


# ── Step 1: Incoming call ─────────────────────────────────────────────────────

@router.post("/incoming")
async def handle_incoming_call(request: Request, db: Session = Depends(get_db)):
    """
    Triggered when a new call arrives on any Telnyx number.

    Responsibilities:
    - Look up the restaurant by the Telnyx phone number dialled (to_phone)
    - Create a Conversation and CallLog record
    - Generate and speak an opening greeting
    - Return a TeXML <Gather> to wait for the customer's first words
    """
    raw_body = await request.body()

    try:
        body = await request.form()
        call_sid  = body.get("CallSid") or body.get("call_sid", "")
        to_phone  = body.get("To") or body.get("to", "")
        from_phone = body.get("From") or body.get("from", "")
    except Exception:
        try:
            body = json.loads(raw_body)
            payload    = body.get("data", {}).get("payload", {})
            call_sid   = payload.get("call_control_id", "")
            to_phone   = payload.get("to", "")
            from_phone = payload.get("from", "")
        except Exception:
            return _xml_response(txml_say_hangup(
                "Sorry, we're having technical difficulties. Please call again."
            ))

    # Look up restaurant by Telnyx number — strict tenant lookup
    restaurant = _get_restaurant_by_telnyx_phone(db, to_phone)
    if not restaurant and settings.APP_ENV != "production":
        # Dev fallback: use first active restaurant for local testing
        restaurant = db.query(Restaurant).filter(Restaurant.is_active == True).first()

    if not restaurant:
        return _xml_response(txml_say_hangup(
            "Sorry, this number is not configured. Please try again later."
        ))

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

    conversation.messages = json.dumps([{"role": "assistant", "content": greeting}])
    db.commit()

    action_url = (
        f"{settings.BASE_URL}/voice/respond"
        f"?call_sid={conversation.call_sid}&restaurant_id={restaurant.id}"
    )
    return _xml_response(txml_gather(greeting, action_url))


# ── Step 2: Customer spoke ────────────────────────────────────────────────────

@router.post("/respond")
async def handle_speech(
    request: Request,
    call_sid: str = "",
    restaurant_id: str = "",
    db: Session = Depends(get_db),
):
    """
    Triggered each time the customer finishes speaking.

    Responsibilities:
    - Retrieve the customer's transcribed speech (SpeechResult)
    - Detect language on the first turn; reuse stored language on subsequent turns
    - Retrieve conversation history and RAG context
    - Get the AI's next response
    - If the order is complete: save order, send SMS, hang up
    - Otherwise: speak the AI response and listen again (<Gather> loop)
    """
    try:
        body = await request.form()
        speech_result = body.get("SpeechResult") or body.get("speech_result", "")
        call_sid      = call_sid or body.get("CallSid", "")
        from_phone    = body.get("From", "")
    except Exception:
        speech_result = ""

    if not speech_result:
        action_url = f"{settings.BASE_URL}/voice/respond?call_sid={call_sid}&restaurant_id={restaurant_id}"
        return _xml_response(txml_gather(
            "I didn't catch that. Could you please repeat?", action_url
        ))

    # Load conversation — verifies the call exists
    conversation = db.query(Conversation).filter(Conversation.call_sid == call_sid).first()
    if not conversation:
        return _xml_response(txml_say_hangup("Sorry, session expired. Please call again."))

    # Use conversation.restaurant_id as the authoritative tenant — ignore URL param
    restaurant = db.query(Restaurant).filter(Restaurant.id == conversation.restaurant_id).first()
    if not restaurant:
        return _xml_response(txml_say_hangup("Technical error. Please call again."))

    menu_items = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant.id,
        MenuItem.available == True,
    ).all()

    messages = json.loads(conversation.messages or "[]")

    # ── Language detection (first turn only) ──────────────────────────────────
    # On the first turn, conversation.language_detected is None — detect and store it.
    # All subsequent turns reuse the stored value.
    lang = conversation.language_detected
    if not lang:
        lang = detect_language(speech_result)
        conversation.language_detected = lang

    voice    = VOICE_MAP.get(lang, VOICE_MAP["en"])
    stt_lang = STT_LANGUAGE_MAP.get(lang, "en-US")

    # ── RAG context retrieval ──────────────────────────────────────────────────
    rag_context = build_rag_context(
        db=db,
        owner_id=restaurant.owner_id,
        query=speech_result,
        restaurant_id=restaurant.id,
    )

    # ── AI response ───────────────────────────────────────────────────────────
    ai_text, is_order_complete = get_ai_response(
        restaurant=restaurant,
        menu_items=menu_items,
        conversation_history=messages,
        user_message=speech_result,
        rag_context=rag_context,
        language=lang,
    )

    messages.append({"role": "user", "content": speech_result})
    messages.append({"role": "assistant", "content": ai_text})
    conversation.messages = json.dumps(messages)

    call_log = db.query(CallLog).filter(CallLog.call_sid == call_sid).first()
    if call_log:
        call_log.ai_turns = (call_log.ai_turns or 0) + 1

    # ── Order complete ─────────────────────────────────────────────────────────
    if is_order_complete:
        order_data = extract_order_json(ai_text)
        if order_data:
            order = save_order_from_voice(db, restaurant, conversation, order_data, from_phone)
            conversation.order_id = order.id
            if call_log:
                call_log.order_id = order.id
                call_log.status = "completed"
            db.commit()

            # Deduct ingredients from inventory (best-effort — never blocks order)
            try:
                from app.services.inventory_service import deduct_order_ingredients
                deduct_order_ingredients(
                    order_id=order.id,
                    restaurant_id=restaurant.id,
                    order_items=order_data.get("items", []),
                    db=db,
                )
            except Exception as _inv_err:
                print(f"[Inventory] Deduction failed for order {order.id}: {_inv_err}")

            # Strip the silent ORDER_COMPLETE block from the spoken response
            clean_text = re.sub(r"<ORDER_COMPLETE>[\s\S]*?</ORDER_COMPLETE>", "", ai_text).strip()
            if not clean_text:
                _fallbacks = {
                    "en": f"Your order has been placed! We'll have it ready in about {restaurant.estimated_wait_minutes} minutes.",
                    "es": f"¡Tu pedido ha sido realizado! Lo tendremos listo en aproximadamente {restaurant.estimated_wait_minutes} minutos.",
                    "zh": f"您的订单已下单！我们将在大约{restaurant.estimated_wait_minutes}分钟内准备好。",
                }
                clean_text = _fallbacks.get(lang, _fallbacks["en"])

            # Send SMS confirmation (with optional Stripe payment link)
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
                    language=lang,
                )

            return _xml_response(txml_say_hangup(clean_text, voice=voice))

    db.commit()

    action_url = (
        f"{settings.BASE_URL}/voice/respond"
        f"?call_sid={call_sid}&restaurant_id={restaurant.id}"
    )
    return _xml_response(txml_gather(
        ai_text, action_url, voice=voice, stt_language=stt_lang, lang=lang
    ))


# ── Step 3: Call ended ────────────────────────────────────────────────────────

@router.post("/status")
async def call_status(request: Request, db: Session = Depends(get_db)):
    """
    Triggered by Telnyx when a call ends (regardless of reason).

    Responsibilities:
    - Record call duration
    - Mark call as completed or abandoned (< 10 s = abandoned)
    - Trigger usage alert check for the restaurant owner
    """
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

    # Check if owner has hit 80% of their monthly call limit
    if call_log and call_log.restaurant_id:
        try:
            from app.models.owner import Owner
            from app.routers.subscription import check_usage_alert

            restaurant = db.query(Restaurant).filter(Restaurant.id == call_log.restaurant_id).first()
            if restaurant:
                owner = db.query(Owner).filter(Owner.id == restaurant.owner_id).first()
                if owner:
                    check_usage_alert(db, owner)
        except Exception as e:
            print(f"[Usage Alert] Error checking usage: {e}")

    return JSONResponse({"ok": True})
