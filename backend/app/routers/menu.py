from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.menu import MenuItemCreate, MenuItemUpdate, MenuItemResponse
from app.middleware.auth import get_current_owner
from app.models.owner import Owner

router = APIRouter(prefix="/api/menu", tags=["menu"])


def _get_restaurant(db: Session, owner: Owner) -> Restaurant:
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == owner.id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/", response_model=List[MenuItemResponse])
def list_menu(db: Session = Depends(get_db), current_owner: Owner = Depends(get_current_owner)):
    restaurant = _get_restaurant(db, current_owner)
    return db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id).all()


@router.post("/", response_model=MenuItemResponse, status_code=201)
def create_item(
    data: MenuItemCreate,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)
    item = MenuItem(restaurant_id=restaurant.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=MenuItemResponse)
def update_item(
    item_id: str,
    data: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)
    item = db.query(MenuItem).filter(
        MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/all")
def delete_all_items(db: Session = Depends(get_db), current_owner: Owner = Depends(get_current_owner)):
    """Delete all menu items for this restaurant."""
    restaurant = _get_restaurant(db, current_owner)
    deleted = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id).delete()
    db.commit()
    return {"message": f"Deleted {deleted} menu items"}


@router.delete("/{item_id}")
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    restaurant = _get_restaurant(db, current_owner)
    item = db.query(MenuItem).filter(
        MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}
