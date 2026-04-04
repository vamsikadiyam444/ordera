from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.database import get_db
from app.models.order import Order, OrderItem
from app.models.restaurant import Restaurant
from app.schemas.order import OrderCreate, OrderResponse, OrderStatusUpdate
from app.middleware.auth import get_current_owner
from app.models.owner import Owner

router = APIRouter(prefix="/api/orders", tags=["orders"])

VALID_STATUSES = {"new", "confirmed", "preparing", "ready", "picked_up", "cancelled"}
AUTO_CONFIRM_SECONDS = 60


def _get_restaurant(db: Session, owner: Owner) -> Restaurant:
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == owner.id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


def _auto_confirm_stale(db: Session, restaurant_id: str):
    """Auto-confirm new orders older than AUTO_CONFIRM_SECONDS (inline, no background task)."""
    cutoff = datetime.utcnow() - timedelta(seconds=AUTO_CONFIRM_SECONDS)
    stale = (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant_id, Order.status == "new", Order.created_at <= cutoff)
        .all()
    )
    for order in stale:
        order.status = "confirmed"
    if stale:
        db.commit()


@router.post("/", response_model=OrderResponse)
def create_walk_in_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Create a walk-in order manually (from Kitchen Dashboard front desk)."""
    restaurant = _get_restaurant(db, current_owner)

    pay_method = data.pay_method or "cash"
    if pay_method not in {"stripe_link", "cash", "card_on_pickup"}:
        pay_method = "cash"

    order = Order(
        restaurant_id=restaurant.id,
        customer_name=data.customer_name or "Walk-in",
        customer_phone=data.customer_phone,
        status="new",
        total=data.total,
        pay_method=pay_method,
        payment_status="pending",
        special_instructions=data.special_instructions,
    )
    db.add(order)
    db.flush()

    for item_data in data.items:
        db.add(OrderItem(
            order_id=order.id,
            name=item_data.get("name", ""),
            quantity=int(item_data.get("quantity", 1)),
            price=float(item_data.get("price", 0)),
            modification=item_data.get("modification") or None,
        ))

    db.commit()
    db.refresh(order)
    return order


@router.get("/", response_model=List[OrderResponse])
def list_orders(
    status: Optional[str] = Query(None),
    order_date: Optional[date] = Query(None),
    days: Optional[int] = Query(None, ge=1),
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)

    # Auto-confirm stale orders on every list request
    _auto_confirm_stale(db, restaurant.id)

    from sqlalchemy import func
    q = db.query(Order).filter(Order.restaurant_id == restaurant.id)

    if status:
        q = q.filter(Order.status == status)

    if order_date:
        q = q.filter(func.date(Order.created_at) == order_date)
    elif days:
        since = date.today() - timedelta(days=days)
        q = q.filter(func.date(Order.created_at) >= since)

    return q.order_by(Order.created_at.desc()).limit(limit).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)
    order = db.query(Order).filter(
        Order.id == order_id, Order.restaurant_id == restaurant.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {VALID_STATUSES}")

    restaurant = _get_restaurant(db, current_owner)
    order = db.query(Order).filter(
        Order.id == order_id, Order.restaurant_id == restaurant.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = data.status
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}")
def cancel_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)
    order = db.query(Order).filter(
        Order.id == order_id, Order.restaurant_id == restaurant.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = "cancelled"
    db.commit()
    return {"message": "Order cancelled"}
