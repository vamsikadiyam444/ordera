"""
AI Conversation Engine
Supports two providers:
  - Groq  — used when GROQ_API_KEY is set (takes priority)
  - Claude — used when ANTHROPIC_API_KEY is set (fallback)

Fast model    → Groq: llama-3.1-8b-instant     / Claude: claude-haiku-4-5-20251001
Complex model → Groq: llama-3.3-70b-versatile  / Claude: claude-sonnet-4-6
"""
import json
import logging
from typing import List, Optional
from app.config import settings
from app.models.restaurant import Restaurant
from app.models.menu_item import MenuItem

logger = logging.getLogger(__name__)

# Claude model IDs
HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

# Groq model IDs
GROQ_FAST_MODEL = "llama-3.1-8b-instant"
GROQ_COMPLEX_MODEL = "llama-3.3-70b-versatile"

# Keywords that trigger the more capable (complex) model
COMPLEX_KEYWORDS = [
    "allerg", "gluten", "vegan", "vegetarian", "halal", "kosher",
    "dairy", "nut", "peanut", "shellfish", "policy", "refund", "catering"
]

# ---------------------------------------------------------------------------
# Client initialisation — Grok takes priority over Claude
# ---------------------------------------------------------------------------
_groq_client = None
_anthropic_client = None

if settings.GROQ_API_KEY:
    from openai import OpenAI
    _groq_client = OpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )
    logger.info("AI provider: Groq (llama-3.1-8b-instant / llama-3.3-70b-versatile)")
else:
    import anthropic
    _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    logger.info("AI provider: Anthropic Claude")


# ---------------------------------------------------------------------------
# Unified low-level chat helper
# ---------------------------------------------------------------------------
def _chat(
    *,
    fast: bool,
    system: str,
    messages: list,
    max_tokens: int,
    cache_system: bool = False,
) -> str:
    """
    Route to Grok or Anthropic and return the assistant's text response.

    Parameters
    ----------
    fast        : True → use the cheaper/faster model; False → use the smarter model
    system      : system prompt text (empty string = no system prompt)
    messages    : list of {"role": ..., "content": ...} dicts
    max_tokens  : maximum tokens to generate
    cache_system: enable Anthropic prompt caching on the system prompt (ignored for Grok)
    """
    if _groq_client:
        model = GROQ_FAST_MODEL if fast else GROQ_COMPLEX_MODEL
        all_messages = []
        if system:
            all_messages.append({"role": "system", "content": system})
        all_messages.extend(messages)
        resp = _groq_client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=all_messages,
        )
        return resp.choices[0].message.content

    # Anthropic path
    model = HAIKU_MODEL if fast else SONNET_MODEL
    system_param = []
    if system:
        block = {"type": "text", "text": system}
        if cache_system:
            block["cache_control"] = {"type": "ephemeral"}
        system_param = [block]

    resp = _anthropic_client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_param,
        messages=messages,
    )
    return resp.content[0].text


# ---------------------------------------------------------------------------
# Menu extraction
# ---------------------------------------------------------------------------
def extract_menu_items(text: str) -> list[dict]:
    """Parse a menu document and return structured menu items as a list of dicts."""
    prompt = (
        "Extract all menu items from the restaurant menu text below.\n"
        "Return ONLY a valid JSON array — no markdown, no explanation.\n"
        "Each element must have exactly these keys:\n"
        '  "category": string (e.g. "Appetizers", "Mains", "Sides", "Desserts", "Drinks")\n'
        '  "name": string\n'
        '  "description": string or null\n'
        '  "price": number (e.g. 12.99; use 0 if not found)\n\n'
        f"Menu text:\n{text[:8000]}"
    )

    raw = _chat(fast=True, system="", messages=[{"role": "user", "content": prompt}], max_tokens=4096)
    logger.info("Menu extraction raw response (first 500 chars): %s", raw[:500])

    # Strip markdown code fences if present
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else parts[0]
        if raw.startswith("json"):
            raw = raw[4:].strip()

    items = json.loads(raw)
    return items if isinstance(items, list) else []


# ---------------------------------------------------------------------------
# Voice conversation
# ---------------------------------------------------------------------------
def _select_model_is_fast(user_message: str) -> bool:
    """Return True (fast model) unless the message contains complex-topic keywords."""
    msg_lower = user_message.lower()
    for keyword in COMPLEX_KEYWORDS:
        if keyword in msg_lower:
            return False
    return True


def _build_menu_text(menu_items: List[MenuItem]) -> str:
    if not menu_items:
        return "No menu items available."

    by_category: dict = {}
    for item in menu_items:
        if not item.available:
            continue
        cat = item.category
        if cat not in by_category:
            by_category[cat] = []
        desc = f" - {item.description}" if item.description else ""
        by_category[cat].append(f"  • {item.name}: ${item.price:.2f}{desc}")

    lines = []
    for category, items in by_category.items():
        lines.append(f"\n{category}:")
        lines.extend(items)
    return "\n".join(lines)


def _build_system_prompt(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    rag_context: str = "",
) -> str:
    menu_text = _build_menu_text(menu_items)

    hours_info = ""
    if restaurant.hours:
        try:
            hours_data = json.loads(restaurant.hours)
            hours_lines = [f"  {day}: {hours}" for day, hours in hours_data.items()]
            hours_info = "Operating Hours:\n" + "\n".join(hours_lines)
        except Exception:
            hours_info = f"Hours: {restaurant.hours}"

    rag_section = ""
    if rag_context:
        rag_section = f"""
## Restaurant Knowledge Base
The following information comes from restaurant-uploaded documents. Use this to answer specific questions:

{rag_context}
"""

    return f"""# Role
You are a friendly AI phone agent for {restaurant.name}. Your job is to answer calls, take food orders, and help customers with questions about the restaurant.

# Voice Guidelines
- Speak naturally and conversationally — your responses are spoken aloud over the phone.
- Keep every response to 1-3 short sentences. Under 150 characters unless the customer asks for more detail.
- Never use markdown, bullet symbols, bold, or special characters. Plain spoken language only.
- Use varied phrasing — avoid repeating the same words or phrases.
- If you didn't understand something, ask: "Just to confirm, did you say...?"
- Pause naturally after questions to allow the customer to reply.
- If a customer seems stressed or confused, stay calm, slow down, and be extra clear.

# Restaurant Information
- Name: {restaurant.name}
- Address: {restaurant.address or "Contact us for our address"}
- Phone: {restaurant.phone or "N/A"}
- Estimated wait time: {restaurant.estimated_wait_minutes} minutes
{hours_info}

# Menu
{menu_text}

# Call Flow
Step 1 — Greet warmly: "Thank you for calling {restaurant.name}! How can I help you today?"
Step 2 — Listen and help. This may be an order, a menu question, hours, location, or something else.
Step 3 — If placing an order:
  a. Take items one at a time, asking for any modifications or preferences.
  b. Read the full order back to confirm: "So that's a [item] and a [item] — does that sound right?"
  c. Ask for their name: "What name should I put the order under?"
  d. Offer SMS payment: "Would you like me to send a payment link to your phone?"
  e. Confirm the total and wait time, then output this block silently (never read it aloud):

<ORDER_COMPLETE>
{{
  "customer_name": "John",
  "items": [
    {{"name": "Burger", "quantity": 1, "price": 12.99, "modification": "no onions"}},
    {{"name": "Fries", "quantity": 2, "price": 3.99, "modification": ""}}
  ],
  "total": 20.97,
  "send_sms": true,
  "special_instructions": ""
}}
</ORDER_COMPLETE>

Step 4 — After every order or question, ask: "Is there anything else I can help you with today?"
Step 5 — Close warmly: "Thanks for calling {restaurant.name}. Have a great day!"
{rag_section}
# Handling Questions
- Menu items and prices: Answer only from the menu listed above. Never invent items or prices.
- Hours, location, wait time: Use the restaurant information above.
- Allergens and dietary needs (gluten, vegan, halal, nuts, dairy, shellfish): Check the knowledge base carefully and be precise. If unsure, say "I want to make sure I give you accurate information — let me check on that."
- If a question is outside what you know: "I don't have that detail, but our team would be happy to help if you call back."

# Rules
- Never make up menu items, prices, or policies not listed above.
- Always confirm the full order before outputting ORDER_COMPLETE.
- Keep all spoken responses under 50 words for phone clarity.
- Do not output the ORDER_COMPLETE block until the customer has verbally confirmed their order.
"""


def get_ai_response(
    restaurant: Restaurant,
    menu_items: List[MenuItem],
    conversation_history: List[dict],
    user_message: str,
    rag_context: str = "",
) -> tuple[str, bool]:
    """
    Get AI response for a voice conversation turn.
    Returns (response_text, is_order_complete).
    """
    fast = _select_model_is_fast(user_message)
    system_prompt = _build_system_prompt(restaurant, menu_items, rag_context)
    messages = conversation_history + [{"role": "user", "content": user_message}]

    try:
        text = _chat(fast=fast, system=system_prompt, messages=messages, max_tokens=500, cache_system=True)
        is_complete = "<ORDER_COMPLETE>" in text
        return text, is_complete
    except Exception as e:
        logger.error("AI response error: %s", e)
        return "I'm sorry, I'm having a technical issue. Please hold on for a moment.", False


def extract_order_json(response_text: str) -> Optional[dict]:
    """Extract the ORDER_COMPLETE JSON block from an AI response."""
    import re
    pattern = r"<ORDER_COMPLETE>\s*([\s\S]*?)\s*</ORDER_COMPLETE>"
    match = re.search(pattern, response_text)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def get_greeting(restaurant: Restaurant, menu_items: List[MenuItem]) -> str:
    """Generate the opening greeting for a new call."""
    system_prompt = _build_system_prompt(restaurant, menu_items)
    try:
        return _chat(
            fast=True,
            system=system_prompt,
            messages=[{"role": "user", "content": "Generate a warm, natural phone greeting. Spoken aloud — no markdown, no symbols. 1-2 sentences max, under 120 characters."}],
            max_tokens=80,
        )
    except Exception:
        return f"Thank you for calling {restaurant.name}! How can I help you today?"
