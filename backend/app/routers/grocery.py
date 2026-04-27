"""
Grocery Order Router
====================
Dedicated router for /api/grocery/* endpoints.
Kept separate to avoid route conflicts with /api/inventory/{item_id} wildcard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_owner
from app.models.owner import Owner
from app.models.restaurant import Restaurant
from app.services.inventory_service import get_weekly_grocery_order
from fastapi import HTTPException

router = APIRouter(prefix="/api/grocery", tags=["grocery"])


def _get_restaurant(owner: Owner, db: Session) -> Restaurant:
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == owner.id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/weekly_order")
def get_weekly_grocery_order_endpoint(
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """
    Smart next-week grocery order.
    Combines last 7 days of sales data, ingredient consumption,
    and current stock levels to produce a manager-ready purchase order.
    """
    restaurant = _get_restaurant(owner, db)
    return get_weekly_grocery_order(restaurant.id, db)
