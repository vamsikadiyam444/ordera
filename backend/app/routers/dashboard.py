from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, datetime, timedelta
import uuid
import random
from app.database import get_db
from app.models.order import Order, OrderItem
from app.models.call_log import CallLog
from app.models.conversation import Conversation
from app.models.restaurant import Restaurant
from app.middleware.auth import get_current_owner
from app.models.owner import Owner

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_restaurant(db: Session, owner: Owner) -> Restaurant:
    from fastapi import HTTPException
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == owner.id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/stats")
def get_stats(
    days: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Get order stats. days=0 (default) = today only; days>0 = last N days."""
    restaurant = _get_restaurant(db, current_owner)
    today = datetime.utcnow().date()

    if days > 0:
        since = today - timedelta(days=days)
        orders_period = db.query(Order).filter(
            Order.restaurant_id == restaurant.id,
            func.date(Order.created_at) >= since,
        ).all()
    else:
        orders_period = db.query(Order).filter(
            Order.restaurant_id == restaurant.id,
            func.date(Order.created_at) == today,
        ).all()

    active = [o for o in orders_period if o.status in ("new", "confirmed", "preparing")]
    ready = [o for o in orders_period if o.status == "ready"]
    completed = [o for o in orders_period if o.status == "picked_up"]

    revenue = sum(
        o.total for o in orders_period
        if o.status != "cancelled" and (
            o.payment_status == "paid" or o.pay_method in ("cash", "card_on_pickup")
        )
    )

    return {
        "active_orders": len(active),
        "ready_orders": len(ready),
        "completed_orders": len(completed),
        "total_orders_today": len(orders_period),
        "revenue_today": round(revenue, 2),
        "orders": [
            {
                "id": o.id,
                "customer_name": o.customer_name,
                "customer_phone": o.customer_phone,
                "status": o.status,
                "total": o.total,
                "payment_status": o.payment_status,
                "pay_method": o.pay_method,
                "call_sid": o.call_sid,
                "special_instructions": o.special_instructions,
                "items": [
                    {"name": i.name, "quantity": i.quantity, "modification": i.modification}
                    for i in o.items
                ],
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in sorted(orders_period, key=lambda x: x.created_at or date.min, reverse=True)
        ],
    }


@router.get("/calls")
def get_call_stats(
    days: int = 7,
    hours: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Get call analytics. Use hours>0 for hourly grouping, days for daily grouping."""
    restaurant = _get_restaurant(db, current_owner)

    if hours > 0:
        since_dt = datetime.utcnow() - timedelta(hours=hours)
        logs = db.query(CallLog).filter(
            CallLog.restaurant_id == restaurant.id,
            CallLog.created_at >= since_dt,
        ).all()

        by_period: dict = {}
        for log in logs:
            if log.created_at:
                hour_str = log.created_at.strftime("%H:00")
                by_period.setdefault(hour_str, 0)
                by_period[hour_str] += 1

        lang_rows = (
            db.query(Conversation.language_detected, func.count(Conversation.id).label("count"))
            .join(CallLog, CallLog.call_sid == Conversation.call_sid)
            .filter(
                CallLog.restaurant_id == restaurant.id,
                CallLog.created_at >= since_dt,
                Conversation.language_detected.isnot(None),
            )
            .group_by(Conversation.language_detected)
            .all()
        )
    else:
        since = date.today() - timedelta(days=days)
        logs = db.query(CallLog).filter(
            CallLog.restaurant_id == restaurant.id,
            func.date(CallLog.created_at) >= since,
        ).all()

        by_period: dict = {}
        for log in logs:
            if log.created_at:
                day_str = log.created_at.date().isoformat()
                by_period.setdefault(day_str, 0)
                by_period[day_str] += 1

        lang_rows = (
            db.query(Conversation.language_detected, func.count(Conversation.id).label("count"))
            .join(CallLog, CallLog.call_sid == Conversation.call_sid)
            .filter(
                CallLog.restaurant_id == restaurant.id,
                func.date(CallLog.created_at) >= since,
                Conversation.language_detected.isnot(None),
            )
            .group_by(Conversation.language_detected)
            .all()
        )

    total_calls = len(logs)
    completed = [l for l in logs if l.status == "completed"]
    abandoned = [l for l in logs if l.status == "abandoned"]
    avg_duration = (
        sum(l.duration_seconds for l in completed) / len(completed)
        if completed else 0
    )

    _lang_labels = {"en": "English", "es": "Spanish", "zh": "Chinese"}
    languages = {
        _lang_labels.get(row.language_detected, row.language_detected): row.count
        for row in lang_rows
    }

    return {
        "total_calls": total_calls,
        "completed_calls": len(completed),
        "abandoned_calls": len(abandoned),
        "completion_rate": round(len(completed) / total_calls * 100, 1) if total_calls else 0,
        "avg_duration_seconds": round(avg_duration),
        "calls_by_date": [
            {"date": d, "count": c} for d, c in sorted(by_period.items())
        ],
        "languages": languages,
    }


@router.get("/report")
def get_report(
    period: str = Query("week", pattern="^(week|month|year)$"),
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Full data export for PDF report — week / month / year."""
    restaurant = _get_restaurant(db, current_owner)

    days_map = {"week": 7, "month": 30, "year": 365}
    num_days = days_map[period]
    since = date.today() - timedelta(days=num_days)

    # ── Orders ──
    orders = db.query(Order).filter(
        Order.restaurant_id == restaurant.id,
        func.date(Order.created_at) >= since,
    ).order_by(Order.created_at.desc()).all()

    completed_orders = [o for o in orders if o.status == "picked_up"]
    cancelled_orders = [o for o in orders if o.status == "cancelled"]
    revenue = sum(o.total for o in orders if o.payment_status == "paid")
    revenue += sum(o.total for o in orders if o.pay_method == "cash" and o.status not in ("cancelled",))
    avg_order = revenue / len(completed_orders) if completed_orders else 0

    # Revenue by date
    rev_by_date: dict = {}
    for o in orders:
        if o.created_at and o.status not in ("cancelled",):
            d = o.created_at.date().isoformat()
            rev_by_date.setdefault(d, 0)
            if o.payment_status == "paid" or o.pay_method == "cash":
                rev_by_date[d] = round(rev_by_date[d] + o.total, 2)

    # ── Call logs ──
    logs = db.query(CallLog).filter(
        CallLog.restaurant_id == restaurant.id,
        func.date(CallLog.created_at) >= since,
    ).all()

    completed_calls = [l for l in logs if l.status == "completed"]
    abandoned_calls = [l for l in logs if l.status == "abandoned"]
    avg_dur = round(sum(l.duration_seconds for l in completed_calls) / len(completed_calls)) if completed_calls else 0

    calls_by_date: dict = {}
    for log in logs:
        if log.created_at:
            d = log.created_at.date().isoformat()
            calls_by_date.setdefault(d, {"completed": 0, "abandoned": 0})
            calls_by_date[d][log.status] = calls_by_date[d].get(log.status, 0) + 1

    return {
        "restaurant_name": restaurant.name,
        "period": period,
        "since": since.isoformat(),
        "until": date.today().isoformat(),
        "summary": {
            "total_orders": len(orders),
            "completed_orders": len(completed_orders),
            "cancelled_orders": len(cancelled_orders),
            "revenue": round(revenue, 2),
            "avg_order_value": round(avg_order, 2),
        },
        "calls": {
            "total": len(logs),
            "completed": len(completed_calls),
            "abandoned": len(abandoned_calls),
            "completion_rate": round(len(completed_calls) / len(logs) * 100, 1) if logs else 0,
            "avg_duration_seconds": avg_dur,
        },
        "calls_by_date": [
            {"date": d, **v} for d, v in sorted(calls_by_date.items())
        ],
        "revenue_by_date": [
            {"date": d, "revenue": v} for d, v in sorted(rev_by_date.items())
        ],
        "orders": [
            {
                "id": o.id[:8].upper(),
                "created_at": o.created_at.strftime("%b %d, %Y %I:%M %p") if o.created_at else "",
                "customer_name": o.customer_name or "Walk-in",
                "customer_phone": o.customer_phone or "",
                "status": o.status,
                "total": o.total,
                "pay_method": o.pay_method,
                "payment_status": o.payment_status,
                "special_instructions": o.special_instructions or "",
                "items": ", ".join(
                    f"{i.quantity}x {i.name}" + (f" ({i.modification})" if i.modification else "")
                    for i in o.items
                ),
            }
            for o in orders
        ],
    }


@router.post("/seed-sample-data")
def seed_sample_data(
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    """Seed 30 days of realistic sample call logs, orders, and order items."""
    restaurant = _get_restaurant(db, current_owner)

    FIRST_NAMES = [
        "James", "Maria", "David", "Sarah", "Michael", "Emily", "Robert", "Anna",
        "Daniel", "Lisa", "Chris", "Jessica", "Matt", "Ashley", "John", "Nicole",
        "Kevin", "Rachel", "Brian", "Laura", "Alex", "Sophia", "Ryan", "Olivia",
        "Tom", "Megan", "Jake", "Chloe", "Sam", "Emma",
    ]
    PHONES = [f"+1215555{random.randint(1000,9999)}" for _ in range(30)]
    MENU_ITEMS = [
        ("Mozzarella Sticks", 8.99), ("Chicken Wings", 12.99),
        ("Classic Burger", 13.99), ("Grilled Chicken Sandwich", 12.99),
        ("Margherita Pizza", 14.99), ("Caesar Salad", 10.99),
        ("French Fries", 3.99), ("Onion Rings", 4.99),
        ("Soft Drink", 2.99), ("Fresh Lemonade", 3.99),
        ("Chocolate Brownie", 5.99),
    ]
    MODIFICATIONS = [
        "", "", "", "", "no onions", "extra cheese", "well done",
        "gluten-free bun", "no tomato", "add bacon", "light sauce",
        "no pickles", "extra crispy", "", "",
    ]
    SPECIAL = [
        "", "", "", "Please make it fast", "Birthday dinner!", "",
        "Allergic to nuts", "", "Extra napkins please", "", "",
        "Ring doorbell on arrival", "", "No plastic utensils", "",
    ]
    STATUSES = ["picked_up"] * 4 + ["confirmed", "preparing", "ready", "cancelled"]
    PAY_METHODS = ["cash", "cash", "stripe_link", "stripe_link", "card_on_pickup"]

    today = date.today()
    total_calls = 0
    total_orders = 0

    for day_offset in range(30, -1, -1):  # include today (offset 0)
        day = today - timedelta(days=day_offset)
        weekday = day.weekday()
        if day_offset == 0:
            # Today: generate more calls so usage looks populated
            num_calls = random.randint(15, 25)
        elif weekday >= 5:
            num_calls = random.randint(12, 22)
        elif weekday == 4:
            num_calls = random.randint(10, 18)
        else:
            num_calls = random.randint(5, 14)

        for ci in range(num_calls):
            max_hour = 21 if day_offset > 0 else min(datetime.utcnow().hour, 21)
            if max_hour < 10:
                max_hour = 10
            call_time = datetime(day.year, day.month, day.day,
                                random.randint(10, max_hour),
                                random.randint(0, 59),
                                random.randint(0, 59))
            call_sid = f"sample_{day.isoformat()}_{ci}_{uuid.uuid4().hex[:6]}"
            caller = random.choice(PHONES)
            name = random.choice(FIRST_NAMES)

            roll = random.random()
            if roll < 0.15:
                call_status = "abandoned"
                duration = random.randint(3, 9)
                order_id = None
            elif roll < 0.25:
                call_status = "completed"
                duration = random.randint(20, 90)
                order_id = None
            else:
                call_status = "completed"
                duration = random.randint(45, 180)

                num_items = random.randint(1, 4)
                chosen = random.sample(MENU_ITEMS, min(num_items, len(MENU_ITEMS)))
                oid = str(uuid.uuid4())
                o_status = random.choice(STATUSES)
                if day_offset <= 1:
                    o_status = random.choice(["new", "confirmed", "preparing", "ready"])
                pay = random.choice(PAY_METHODS)
                pay_st = "paid" if o_status == "picked_up" else ("pending" if o_status != "cancelled" else "failed")

                order = Order(
                    id=oid, restaurant_id=restaurant.id,
                    customer_name=name, customer_phone=caller,
                    status=o_status, total=0, pay_method=pay,
                    payment_status=pay_st, call_sid=call_sid,
                    special_instructions=random.choice(SPECIAL),
                    created_at=call_time + timedelta(minutes=random.randint(1, 3)),
                )
                db.add(order)

                order_total = 0
                for item_name, item_price in chosen:
                    qty = random.choices([1, 2, 3], weights=[70, 25, 5])[0]
                    order_total += item_price * qty
                    db.add(OrderItem(
                        id=str(uuid.uuid4()), order_id=oid,
                        name=item_name, quantity=qty,
                        price=item_price, modification=random.choice(MODIFICATIONS),
                    ))
                order.total = round(order_total, 2)
                order_id = oid
                total_orders += 1

            db.add(CallLog(
                id=str(uuid.uuid4()), restaurant_id=restaurant.id,
                call_sid=call_sid, caller_phone=caller,
                duration_seconds=duration, status=call_status,
                order_id=order_id,
                ai_turns=random.randint(2, 8) if call_status == "completed" else random.randint(0, 2),
                created_at=call_time,
            ))
            total_calls += 1

    db.commit()
    return {
        "message": f"Seeded {total_calls} calls and {total_orders} orders over 30 days",
        "total_calls": total_calls,
        "total_orders": total_orders,
    }
