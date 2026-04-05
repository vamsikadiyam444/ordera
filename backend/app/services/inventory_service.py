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

        if recommended > 0:
            recommendations.append({
                "item_name": item.name,
                "unit": item.unit,
                "current_quantity": round(item.quantity, 2),
                "avg_daily_usage": round(avg_daily, 2),
                "recommended_order_qty": round(recommended, 2),
            })

    # Sort by recommended qty descending (most urgent first)
    recommendations.sort(key=lambda x: x["recommended_order_qty"], reverse=True)
    return recommendations


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


# ── Analytics (profit + waste + top cost items) ───────────────────────────────

def get_analytics(restaurant_id: str, days: int, db: Session) -> dict:
    """
    Returns daily profit, waste summary, top cost items, and low stock items.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Fetch all orders for this restaurant in the period
    orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= cutoff,
        )
        .all()
    )

    # Build daily profit buckets
    daily: dict = {}
    for order in orders:
        date_key = order.created_at.strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"date": date_key, "revenue": 0.0, "cost": 0.0, "profit": 0.0}
        daily[date_key]["revenue"] += order.total or 0.0

        # Get ingredient cost from logs
        logs = (
            db.query(InventoryLog)
            .filter(
                InventoryLog.order_id == order.id,
                InventoryLog.change_type == "used",
            )
            .all()
        )
        for log in logs:
            inv_item = db.query(InventoryItem).filter(InventoryItem.id == log.inventory_item_id).first()
            if inv_item:
                daily[date_key]["cost"] += log.quantity * inv_item.cost_per_unit

    for d in daily.values():
        d["cost"] = round(d["cost"], 2)
        d["revenue"] = round(d["revenue"], 2)
        d["profit"] = round(d["revenue"] - d["cost"], 2)

    daily_profit = sorted(daily.values(), key=lambda x: x["date"])

    # Waste summary
    waste_summary = get_waste_analytics(restaurant_id, db)

    # Top cost items by usage cost in period
    inv_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    )
    top_cost = []
    for item in inv_items:
        used_logs = (
            db.query(InventoryLog)
            .filter(
                InventoryLog.inventory_item_id == item.id,
                InventoryLog.change_type == "used",
                InventoryLog.timestamp >= cutoff,
            )
            .all()
        )
        total_cost = sum(l.quantity for l in used_logs) * item.cost_per_unit
        if total_cost > 0:
            top_cost.append({"name": item.name, "total_cost_last_n_days": round(total_cost, 2)})

    top_cost.sort(key=lambda x: x["total_cost_last_n_days"], reverse=True)

    # Low stock items
    low_stock = [
        {"id": i.id, "name": i.name, "unit": i.unit, "quantity": i.quantity, "threshold": i.low_stock_threshold}
        for i in inv_items
        if i.low_stock_threshold > 0 and i.quantity < i.low_stock_threshold
    ]

    return {
        "daily_profit": daily_profit,
        "waste_summary": waste_summary,
        "top_cost_items": top_cost[:10],
        "low_stock_items": low_stock,
    }
