"""
Inventory Service
=================
All business logic for inventory management.

Rules enforced here:
- Quantity NEVER goes below 0 (clamped, logs stock_floor_hit note)
- Every quantity change produces an InventoryLog row
- Owner isolation enforced at router level (restaurant_id passed in)
- Unmapped menu items are silently skipped (normal for new restaurants)
"""
import base64
import io
import json
import re
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.inventory_item import InventoryItem
from app.models.inventory_log import InventoryLog
from app.models.menu_ingredient import MenuIngredient
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderItem
from app.schemas.inventory_schemas import InventoryItemCreate


# ── Core deduction hook ───────────────────────────────────────────────────────

def deduct_order_ingredients(
    order_id: str,
    restaurant_id: str,
    order_items: list,  # list of {name, quantity, price, ...}
    db: Session,
) -> None:
    """
    Called immediately after an order is saved.
    For each ordered item, deducts ingredients from inventory and writes logs.
    Silently skips items with no ingredient mappings.
    NEVER raises — order processing must not be blocked.
    """
    for item_data in order_items:
        item_name = item_data.get("name", "")
        qty_ordered = float(item_data.get("quantity", 1))

        # Find matching menu item (by name in this restaurant)
        menu_item = (
            db.query(MenuItem)
            .filter(
                MenuItem.restaurant_id == restaurant_id,
                MenuItem.name == item_name,
            )
            .first()
        )
        if not menu_item:
            continue  # No menu item found — skip silently

        # Find all ingredient mappings for this menu item
        mappings = (
            db.query(MenuIngredient)
            .filter(MenuIngredient.menu_item_id == menu_item.id)
            .all()
        )
        if not mappings:
            continue  # No mappings set up yet — skip silently

        for mapping in mappings:
            inv_item = (
                db.query(InventoryItem)
                .filter(InventoryItem.id == mapping.inventory_item_id)
                .first()
            )
            if not inv_item:
                continue

            deduct_amount = qty_ordered * mapping.quantity_used_per_order
            note = None

            if inv_item.quantity <= 0:
                # Already at floor — log but don't go negative
                note = "stock_floor_hit"
                deduct_amount = 0.0
            elif inv_item.quantity < deduct_amount:
                # Would go negative — clamp
                deduct_amount = inv_item.quantity
                inv_item.quantity = 0.0
                note = "stock_floor_hit"
            else:
                inv_item.quantity = round(inv_item.quantity - deduct_amount, 6)

            db.add(InventoryLog(
                inventory_item_id=inv_item.id,
                change_type="used",
                quantity=deduct_amount,
                order_id=order_id,
                note=note,
            ))

    db.flush()


# ── Upload / upsert ───────────────────────────────────────────────────────────

def upload_inventory(
    restaurant_id: str,
    items: List[InventoryItemCreate],
    db: Session,
) -> List[InventoryItem]:
    """
    Upsert inventory items for a restaurant.
    Existing item (same name, same restaurant) → update quantity & cost.
    New item → insert.
    Logs change_type='added' for every item.
    """
    saved: List[InventoryItem] = []

    for item_data in items:
        existing = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.restaurant_id == restaurant_id,
                InventoryItem.name == item_data.name,
            )
            .first()
        )

        if existing:
            added_qty = item_data.quantity
            existing.quantity = round(existing.quantity + item_data.quantity, 6)
            existing.cost_per_unit = item_data.cost_per_unit
            existing.unit = item_data.unit
            existing.low_stock_threshold = item_data.low_stock_threshold
            inv_item = existing
        else:
            inv_item = InventoryItem(
                restaurant_id=restaurant_id,
                name=item_data.name,
                quantity=item_data.quantity,
                unit=item_data.unit,
                cost_per_unit=item_data.cost_per_unit,
                low_stock_threshold=item_data.low_stock_threshold,
            )
            db.add(inv_item)
            db.flush()
            added_qty = item_data.quantity

        db.add(InventoryLog(
            inventory_item_id=inv_item.id,
            change_type="added",
            quantity=added_qty,
            note="manual upload",
        ))
        saved.append(inv_item)

    db.commit()
    for item in saved:
        db.refresh(item)
    return saved


# ── Waste logging ─────────────────────────────────────────────────────────────

def log_waste(
    inventory_item_id: str,
    quantity: float,
    note: Optional[str],
    db: Session,
) -> None:
    """Deduct wasted quantity from stock (clamped at 0) and log it."""
    inv_item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == inventory_item_id)
        .first()
    )
    if not inv_item:
        return

    actual_waste = min(quantity, inv_item.quantity)
    inv_item.quantity = max(0.0, round(inv_item.quantity - quantity, 6))

    db.add(InventoryLog(
        inventory_item_id=inventory_item_id,
        change_type="wasted",
        quantity=actual_waste,
        note=note,
    ))
    db.commit()


# ── Profit calculation ────────────────────────────────────────────────────────

def calculate_order_profit(order_id: str, db: Session) -> dict:
    """
    Returns profit breakdown for a single order.
    ingredient_cost = sum of (qty_used × cost_per_unit) from InventoryLog rows.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {}

    logs = (
        db.query(InventoryLog)
        .filter(
            InventoryLog.order_id == order_id,
            InventoryLog.change_type == "used",
        )
        .all()
    )

    ingredient_cost = 0.0
    for log in logs:
        inv_item = db.query(InventoryItem).filter(InventoryItem.id == log.inventory_item_id).first()
        if inv_item:
            ingredient_cost += log.quantity * inv_item.cost_per_unit

    order_total = order.total or 0.0
    profit = order_total - ingredient_cost
    margin = (profit / order_total * 100) if order_total > 0 else 0.0

    return {
        "order_id": order_id,
        "order_total": round(order_total, 2),
        "ingredient_cost": round(ingredient_cost, 2),
        "profit": round(profit, 2),
        "profit_margin_pct": round(margin, 1),
    }


# ── Weekly reorder recommendations ───────────────────────────────────────────

def get_weekly_recommendations(restaurant_id: str, db: Session) -> list:
    """
    For each inventory item: sum 'used' logs from last 7 days.
    avg_daily_usage = total_used / 7
    recommended = (avg_daily × 7) - current_qty  (skipped if <= 0)
    """
    cutoff = datetime.utcnow() - timedelta(days=7)
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    )

    recommendations = []
    for item in items:
        logs = (
            db.query(InventoryLog)
            .filter(
                InventoryLog.inventory_item_id == item.id,
                InventoryLog.change_type == "used",
                InventoryLog.timestamp >= cutoff,
            )
            .all()
        )
        total_used_7d = sum(log.quantity for log in logs)
        avg_daily = total_used_7d / 7.0
        recommended = (avg_daily * 7) - item.quantity
        days_left = round(item.quantity / avg_daily, 1) if avg_daily > 0 else 0.0

        if recommended > 0:
            est_cost = round(recommended * item.cost_per_unit, 2)
            recommendations.append({
                "item_name": item.name,
                "unit": item.unit,
                "current_quantity": round(item.quantity, 2),
                "avg_daily_usage": round(avg_daily, 2),
                "recommended_order_qty": round(recommended, 2),
                "cost_per_unit": round(item.cost_per_unit, 2),
                "estimated_cost": est_cost,
                "days_remaining": days_left,
            })

    # Sort by days_remaining ascending (most urgent first)
    recommendations.sort(key=lambda x: (x["days_remaining"] if x["days_remaining"] > 0 else 999))
    return recommendations


# ── Smart weekly grocery order ────────────────────────────────────────────────

def get_weekly_grocery_order(restaurant_id: str, db: Session) -> dict:
    """
    Builds a smart next-week grocery order by combining:
    - Last 7 days of actual order/sales data
    - Ingredient consumption per item sold
    - Current stock levels
    - Projected need for next 7 days

    Returns a manager-ready purchase order with top sellers,
    full order list with priorities, and totals.
    """
    from collections import defaultdict

    cutoff   = datetime.utcnow() - timedelta(days=7)
    now_str  = datetime.utcnow().strftime("%b %d, %Y")
    week_from = (datetime.utcnow() - timedelta(days=7)).strftime("%b %d")
    week_to   = datetime.utcnow().strftime("%b %d")
    next_from = (datetime.utcnow() + timedelta(days=1)).strftime("%b %d")
    next_to   = (datetime.utcnow() + timedelta(days=7)).strftime("%b %d, %Y")

    # ── 1. Sales last 7 days ──────────────────────────────────────────────────
    orders = (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant_id, Order.created_at >= cutoff)
        .all()
    )
    order_ids     = [o.id for o in orders]
    total_orders  = len(orders)
    total_revenue = round(sum(o.total or 0 for o in orders), 2)

    # Count portions sold per menu item
    portions_sold: dict = defaultdict(int)
    for oi in db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).all():
        portions_sold[oi.name] += oi.quantity

    # Top selling items
    top_sellers = sorted(
        [{"name": k, "qty_sold": v} for k, v in portions_sold.items()],
        key=lambda x: -x["qty_sold"]
    )[:10]

    # ── 2. Ingredient consumption last 7 days ─────────────────────────────────
    inv_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    )
    inv_map    = {i.id: i for i in inv_items}
    consumed: dict = defaultdict(float)

    for log in (
        db.query(InventoryLog)
        .filter(
            InventoryLog.inventory_item_id.in_(list(inv_map.keys())),
            InventoryLog.change_type == "used",
            InventoryLog.timestamp   >= cutoff,
        )
        .all()
    ):
        consumed[log.inventory_item_id] += log.quantity

    # ── 3. Which menu items use each ingredient ───────────────────────────────
    # Build inv_item_id -> list of top menu names that use it
    menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
    menu_map   = {m.id: m.name for m in menu_items}

    ingredient_used_by: dict = defaultdict(list)
    for mapping in db.query(MenuIngredient).all():
        if mapping.inventory_item_id in inv_map:
            menu_name = menu_map.get(mapping.menu_item_id)
            if menu_name and portions_sold.get(menu_name, 0) > 0:
                ingredient_used_by[mapping.inventory_item_id].append(
                    (menu_name, portions_sold[menu_name])
                )

    # ── 4. Build order list ───────────────────────────────────────────────────
    order_list = []
    for inv in inv_items:
        used_7d    = round(consumed.get(inv.id, 0), 3)
        avg_daily  = round(used_7d / 7.0, 3)
        projected  = round(avg_daily * 7, 3)          # need for next 7 days
        order_qty  = round(max(projected - inv.quantity, 0), 2)
        days_left  = round(inv.quantity / avg_daily, 1) if avg_daily > 0 else 99.0
        est_cost   = round(order_qty * inv.cost_per_unit, 2)

        # Priority
        if inv.quantity == 0:
            priority = "out_of_stock"
        elif days_left <= 1:
            priority = "critical"
        elif days_left <= 3:
            priority = "urgent"
        elif days_left <= 5 or order_qty > 0:
            priority = "order_soon"
        else:
            priority = "adequate"

        # Top 3 menu items that drive this ingredient's demand
        drivers = sorted(
            ingredient_used_by.get(inv.id, []),
            key=lambda x: -x[1]
        )[:3]

        order_list.append({
            "item_name":          inv.name,
            "unit":               inv.unit,
            "current_stock":      round(inv.quantity, 2),
            "used_last_7_days":   used_7d,
            "avg_daily_usage":    avg_daily,
            "projected_need":     projected,
            "order_qty":          order_qty,
            "cost_per_unit":      round(inv.cost_per_unit, 2),
            "estimated_cost":     est_cost,
            "days_remaining":     days_left,
            "priority":           priority,
            "driven_by":          [d[0] for d in drivers],  # menu items using this
        })

    # Sort: out_of_stock → critical → urgent → order_soon → adequate
    priority_rank = {"out_of_stock": 0, "critical": 1, "urgent": 2, "order_soon": 3, "adequate": 4}
    order_list.sort(key=lambda x: (priority_rank[x["priority"]], x["days_remaining"]))

    # Items that need ordering (exclude adequate with 0 order qty)
    needs_order   = [i for i in order_list if i["order_qty"] > 0]
    adequate_list = [i for i in order_list if i["order_qty"] == 0]

    total_cost = round(sum(i["estimated_cost"] for i in needs_order), 2)

    return {
        "generated_at":     now_str,
        "week_analyzed":    f"{week_from} – {week_to}",
        "next_week":        f"{next_from} – {next_to}",
        "sales_summary": {
            "total_orders":      total_orders,
            "total_revenue":     total_revenue,
            "top_sellers":       top_sellers,
        },
        "needs_order":          needs_order,
        "adequate_stock":       adequate_list,
        "total_estimated_cost": total_cost,
        "order_items_count":    len(needs_order),
        "adequate_items_count": len(adequate_list),
    }


# ── Waste analytics ───────────────────────────────────────────────────────────

def get_waste_analytics(restaurant_id: str, db: Session) -> dict:
    """
    Returns total waste value and per-item breakdown.
    waste_pct = wasted_qty / (used + wasted + current) × 100
    """
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    )

    total_waste_value = 0.0
    waste_by_item = []

    for item in items:
        all_logs = (
            db.query(InventoryLog)
            .filter(InventoryLog.inventory_item_id == item.id)
            .all()
        )
        wasted_qty = sum(l.quantity for l in all_logs if l.change_type == "wasted")
        used_qty = sum(l.quantity for l in all_logs if l.change_type == "used")

        if wasted_qty == 0:
            continue

        waste_value = wasted_qty * item.cost_per_unit
        total_waste_value += waste_value

        total_throughput = used_qty + wasted_qty + item.quantity
        waste_pct = (wasted_qty / total_throughput * 100) if total_throughput > 0 else 0.0

        waste_by_item.append({
            "name": item.name,
            "unit": item.unit,
            "wasted_qty": round(wasted_qty, 2),
            "waste_value": round(waste_value, 2),
            "waste_pct_of_total_inventory": round(waste_pct, 1),
        })

    waste_by_item.sort(key=lambda x: x["waste_value"], reverse=True)

    return {
        "total_waste_value": round(total_waste_value, 2),
        "waste_by_item": waste_by_item,
    }


# ── Analytics (profit + waste + top cost items + profit conversion ratio) ──────

def get_analytics(restaurant_id: str, days: int, db: Session) -> dict:
    """
    Returns full profit analytics including:
    - Daily revenue / COGS / profit
    - Profit Conversion Ratio = Gross Profit / Revenue × 100
    - Wastage cost breakdown
    - Top cost items, low stock items
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Pre-load all inventory items for this restaurant into a map
    inv_items_map = {
        i.id: i
        for i in db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    }

    orders = (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant_id, Order.created_at >= cutoff)
        .all()
    )

    daily: dict = {}
    total_revenue = 0.0
    total_cogs = 0.0

    for order in orders:
        date_key = order.created_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"date": date_key, "revenue": 0.0, "cogs": 0.0, "wastage": 0.0, "profit": 0.0}

        order_rev = order.total or 0.0
        daily[date_key]["revenue"] += order_rev
        total_revenue += order_rev

        logs = (
            db.query(InventoryLog)
            .filter(InventoryLog.order_id == order.id, InventoryLog.change_type == "used")
            .all()
        )
        for log in logs:
            inv = inv_items_map.get(log.inventory_item_id)
            if inv:
                cost = log.quantity * inv.cost_per_unit
                daily[date_key]["cogs"] += cost
                total_cogs += cost

    # Wastage per day in period
    total_wastage_cost = 0.0
    for inv in inv_items_map.values():
        waste_logs = (
            db.query(InventoryLog)
            .filter(
                InventoryLog.inventory_item_id == inv.id,
                InventoryLog.change_type == "wasted",
                InventoryLog.timestamp >= cutoff,
            )
            .all()
        )
        for wlog in waste_logs:
            cost = wlog.quantity * inv.cost_per_unit
            total_wastage_cost += cost
            date_key = wlog.timestamp.strftime("%Y-%m-%d")
            if date_key in daily:
                daily[date_key]["wastage"] += cost

    # Finalise daily rows
    for d in daily.values():
        d["cogs"] = round(d["cogs"], 2)
        d["wastage"] = round(d["wastage"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["profit"] = round(d["revenue"] - d["cogs"] - d["wastage"], 2)

    daily_profit = sorted(daily.values(), key=lambda x: x["date"])

    # Summary — Profit Conversion Ratio
    gross_profit = total_revenue - total_cogs - total_wastage_cost
    pcr = round((gross_profit / total_revenue * 100), 1) if total_revenue > 0 else 0.0

    summary = {
        "total_revenue": round(total_revenue, 2),
        "total_cogs": round(total_cogs, 2),
        "total_wastage_cost": round(total_wastage_cost, 2),
        "gross_profit": round(gross_profit, 2),
        "profit_conversion_ratio": pcr,
    }

    # Waste analytics
    waste_summary = get_waste_analytics(restaurant_id, db)

    # Top cost items
    top_cost = []
    for inv in inv_items_map.values():
        used_logs = (
            db.query(InventoryLog)
            .filter(
                InventoryLog.inventory_item_id == inv.id,
                InventoryLog.change_type == "used",
                InventoryLog.timestamp >= cutoff,
            )
            .all()
        )
        total_cost = sum(l.quantity for l in used_logs) * inv.cost_per_unit
        if total_cost > 0:
            top_cost.append({"name": inv.name, "total_cost_last_n_days": round(total_cost, 2)})

    top_cost.sort(key=lambda x: x["total_cost_last_n_days"], reverse=True)

    low_stock = [
        {"id": i.id, "name": i.name, "unit": i.unit, "quantity": i.quantity, "threshold": i.low_stock_threshold}
        for i in inv_items_map.values()
        if i.low_stock_threshold > 0 and i.quantity < i.low_stock_threshold
    ]

    return {
        "summary": summary,
        "daily_profit": daily_profit,
        "waste_summary": waste_summary,
        "top_cost_items": top_cost[:10],
        "low_stock_items": low_stock,
    }


# ── AI Invoice Extraction ─────────────────────────────────────────────────────

INVOICE_PROMPT = """Extract all line items from this supplier invoice.
Return ONLY valid JSON — no markdown, no explanation:
{
  "supplier": "Supplier name or null",
  "invoice_date": "YYYY-MM-DD or null",
  "invoice_number": "invoice number or null",
  "items": [
    {
      "name": "ingredient or product name",
      "quantity": 10.0,
      "unit": "lbs",
      "unit_price": 3.50,
      "total_cost": 35.00
    }
  ],
  "invoice_total": 150.00
}

Rules:
- unit must be one of: lbs, grams, oz, gallons, pieces, liters — convert if needed, pick closest
- Only extract food/ingredient/product line items — skip taxes, delivery fees, discounts
- quantity and unit_price must be numbers
- If a value is missing use null
"""


def _parse_invoice_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from AI response."""
    text = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"items": [], "supplier": None, "invoice_date": None, "invoice_number": None, "invoice_total": None}
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return {"items": [], "supplier": None, "invoice_date": None, "invoice_number": None, "invoice_total": None}


def _extract_from_text(text: str) -> dict:
    """Pass text invoice content to Claude and return parsed result."""
    from app.services.ai_engine import _chat
    result = _chat(
        fast=False,
        system="You are an expert invoice data extractor. Return only valid JSON as instructed.",
        messages=[{"role": "user", "content": f"{INVOICE_PROMPT}\n\nINVOICE TEXT:\n{text[:8000]}"}],
        max_tokens=2000,
    )
    return _parse_invoice_json(result)


def _extract_from_image(content: bytes, media_type: str) -> dict:
    """Use Claude vision to extract invoice data from an image."""
    from app.services.ai_engine import _anthropic_client, HAIKU_MODEL
    if not _anthropic_client:
        raise ValueError("Image invoice scanning requires ANTHROPIC_API_KEY in .env")
    if media_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        media_type = "image/jpeg"
    b64 = base64.standard_b64encode(content).decode("utf-8")
    resp = _anthropic_client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": INVOICE_PROMPT},
            ],
        }],
    )
    return _parse_invoice_json(resp.content[0].text)


def _extract_pdf_text(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx_text(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_invoice(content: bytes, filename: str, content_type: str) -> dict:
    """
    Main invoice extraction entry point.
    Routes to the right parser based on file type.
    Returns: {supplier, invoice_date, invoice_number, invoice_total, items[]}
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in ("jpg", "jpeg", "png", "webp") or (content_type or "").startswith("image/"):
        mt = content_type if content_type in ("image/jpeg", "image/png", "image/webp") else f"image/{ext or 'jpeg'}"
        return _extract_from_image(content, mt)

    elif ext == "pdf" or content_type == "application/pdf":
        text = _extract_pdf_text(content)
        if not text.strip():
            raise ValueError("Could not extract text from this PDF. Try uploading a photo of the invoice instead.")
        return _extract_from_text(text)

    elif ext in ("docx", "doc"):
        text = _extract_docx_text(content)
        return _extract_from_text(text)

    elif ext in ("txt", "csv", "tsv"):
        text = content.decode("utf-8", errors="ignore")
        return _extract_from_text(text)

    else:
        raise ValueError(f"Unsupported file type: .{ext}. Upload a PDF, image (JPG/PNG/WEBP), or DOCX.")
