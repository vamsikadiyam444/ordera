"""
Inventory Router
================
All /inventory/* endpoints.

Every endpoint:
- Requires JWT authentication via get_current_owner()
- Filters by the authenticated owner's restaurant_id
- Owner A cannot access Owner B's inventory
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_owner
from app.models.inventory_item import InventoryItem
from app.models.inventory_log import InventoryLog
from app.models.menu_ingredient import MenuIngredient
from app.models.owner import Owner
from app.models.restaurant import Restaurant
from app.schemas.inventory_schemas import (
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    InventoryLogResponse,
    InventoryUploadResponse,
    MenuMappingCreate,
    MenuMappingResponse,
    RecommendationItem,
    WasteEntryCreate,
)
from app.services.inventory_service import (
    get_analytics,
    get_weekly_recommendations,
    log_waste,
    upload_inventory,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _get_restaurant(owner: Owner, db: Session) -> Restaurant:
    """Resolve the owner's restaurant; raise 404 if not found."""
    restaurant = (
        db.query(Restaurant).filter(Restaurant.owner_id == owner.id).first()
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


def _item_to_response(item: InventoryItem) -> InventoryItemResponse:
    return InventoryItemResponse(
        id=item.id,
        restaurant_id=item.restaurant_id,
        name=item.name,
        quantity=item.quantity,
        unit=item.unit,
        cost_per_unit=item.cost_per_unit,
        low_stock_threshold=item.low_stock_threshold,
        low_stock=item.quantity < item.low_stock_threshold if item.low_stock_threshold > 0 else False,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


# ── POST /inventory/upload ────────────────────────────────────────────────────

@router.post("/upload", response_model=InventoryUploadResponse)
def upload_inventory_items(
    items: List[InventoryItemCreate],
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Upsert a batch of inventory items. Returns saved count and all items."""
    restaurant = _get_restaurant(owner, db)
    saved = upload_inventory(restaurant.id, items, db)
    return InventoryUploadResponse(
        saved_count=len(saved),
        items=[_item_to_response(i) for i in saved],
    )


# ── GET /inventory ────────────────────────────────────────────────────────────

@router.get("", response_model=List[InventoryItemResponse])
def list_inventory(
    low_stock_only: bool = Query(False),
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Return all inventory items for the owner's restaurant."""
    restaurant = _get_restaurant(owner, db)
    query = db.query(InventoryItem).filter(InventoryItem.restaurant_id == restaurant.id)
    items = query.order_by(InventoryItem.name).all()

    responses = [_item_to_response(i) for i in items]
    if low_stock_only:
        responses = [r for r in responses if r.low_stock]
    return responses


# ── PUT /inventory/{id} ───────────────────────────────────────────────────────

@router.put("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    item_id: str,
    data: InventoryItemUpdate,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Update one inventory item (partial update — only provided fields change)."""
    restaurant = _get_restaurant(owner, db)
    item = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.id == item_id,
            InventoryItem.restaurant_id == restaurant.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if data.name is not None:
        item.name = data.name
    if data.quantity is not None:
        item.quantity = data.quantity
    if data.unit is not None:
        item.unit = data.unit
    if data.cost_per_unit is not None:
        item.cost_per_unit = data.cost_per_unit
    if data.low_stock_threshold is not None:
        item.low_stock_threshold = data.low_stock_threshold

    db.commit()
    db.refresh(item)
    return _item_to_response(item)


# ── DELETE /inventory/{id} ────────────────────────────────────────────────────

@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(
    item_id: str,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Delete an inventory item and its ingredient mappings."""
    restaurant = _get_restaurant(owner, db)
    item = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.id == item_id,
            InventoryItem.restaurant_id == restaurant.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    db.delete(item)
    db.commit()


# ── POST /inventory/map ───────────────────────────────────────────────────────

@router.post("/map", response_model=List[MenuMappingResponse])
def upsert_menu_mappings(
    data: MenuMappingCreate,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Upsert ingredient mappings for a menu item."""
    restaurant = _get_restaurant(owner, db)

    # Verify menu item belongs to this restaurant
    from app.models.menu_item import MenuItem
    menu_item = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == data.menu_item_id,
            MenuItem.restaurant_id == restaurant.id,
        )
        .first()
    )
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    # Delete existing mappings and replace
    db.query(MenuIngredient).filter(
        MenuIngredient.menu_item_id == data.menu_item_id
    ).delete()

    new_mappings = []
    for ing in data.ingredients:
        # Verify inventory item belongs to this restaurant
        inv_item = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.id == ing.inventory_item_id,
                InventoryItem.restaurant_id == restaurant.id,
            )
            .first()
        )
        if not inv_item:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory item {ing.inventory_item_id} not found",
            )
        mapping = MenuIngredient(
            menu_item_id=data.menu_item_id,
            inventory_item_id=ing.inventory_item_id,
            quantity_used_per_order=ing.quantity_used_per_order,
        )
        db.add(mapping)
        new_mappings.append((mapping, inv_item))

    db.commit()
    for mapping, _ in new_mappings:
        db.refresh(mapping)

    return [
        MenuMappingResponse(
            id=m.id,
            menu_item_id=m.menu_item_id,
            inventory_item_id=m.inventory_item_id,
            quantity_used_per_order=m.quantity_used_per_order,
            inventory_item_name=inv.name,
            unit=inv.unit,
        )
        for m, inv in new_mappings
    ]


# ── GET /inventory/map/{menu_item_id} ─────────────────────────────────────────

@router.get("/map/{menu_item_id}", response_model=List[MenuMappingResponse])
def get_menu_mappings(
    menu_item_id: str,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Return all ingredient mappings for a menu item."""
    restaurant = _get_restaurant(owner, db)

    mappings = (
        db.query(MenuIngredient)
        .filter(MenuIngredient.menu_item_id == menu_item_id)
        .all()
    )

    result = []
    for m in mappings:
        inv_item = (
            db.query(InventoryItem)
            .filter(
                InventoryItem.id == m.inventory_item_id,
                InventoryItem.restaurant_id == restaurant.id,
            )
            .first()
        )
        if inv_item:
            result.append(MenuMappingResponse(
                id=m.id,
                menu_item_id=m.menu_item_id,
                inventory_item_id=m.inventory_item_id,
                quantity_used_per_order=m.quantity_used_per_order,
                inventory_item_name=inv_item.name,
                unit=inv_item.unit,
            ))
    return result


# ── POST /inventory/waste ─────────────────────────────────────────────────────

@router.post("/waste", status_code=204)
def log_waste_entry(
    data: WasteEntryCreate,
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Log a manual waste entry and deduct from stock."""
    restaurant = _get_restaurant(owner, db)

    item = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.id == data.inventory_item_id,
            InventoryItem.restaurant_id == restaurant.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    log_waste(data.inventory_item_id, data.quantity, data.note, db)


# ── GET /inventory/analytics ──────────────────────────────────────────────────

@router.get("/analytics")
def get_inventory_analytics(
    days: int = Query(7, ge=1, le=365),
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Return daily profit, waste summary, top cost items, and low stock items."""
    restaurant = _get_restaurant(owner, db)
    return get_analytics(restaurant.id, days, db)


# ── GET /inventory/recommendations ───────────────────────────────────────────

@router.get("/recommendations", response_model=List[RecommendationItem])
def get_recommendations(
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Return weekly reorder recommendations sorted by urgency."""
    restaurant = _get_restaurant(owner, db)
    return get_weekly_recommendations(restaurant.id, db)


# ── GET /inventory/logs ───────────────────────────────────────────────────────

@router.get("/logs", response_model=List[InventoryLogResponse])
def get_inventory_logs(
    item_id: Optional[str] = Query(None),
    change_type: Optional[str] = Query(None, regex="^(used|wasted|added)$"),
    limit: int = Query(100, ge=1, le=500),
    owner: Owner = Depends(get_current_owner),
    db: Session = Depends(get_db),
):
    """Return recent inventory logs. Filterable by item and change type."""
    restaurant = _get_restaurant(owner, db)

    # Get all inventory item IDs for this restaurant
    item_ids = [
        i.id
        for i in db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant.id)
        .all()
    ]

    query = db.query(InventoryLog).filter(InventoryLog.inventory_item_id.in_(item_ids))

    if item_id:
        query = query.filter(InventoryLog.inventory_item_id == item_id)
    if change_type:
        query = query.filter(InventoryLog.change_type == change_type)

    logs = query.order_by(InventoryLog.timestamp.desc()).limit(limit).all()
    return [
        InventoryLogResponse(
            id=log.id,
            inventory_item_id=log.inventory_item_id,
            change_type=log.change_type,
            quantity=log.quantity,
            order_id=log.order_id,
            note=log.note,
            timestamp=log.timestamp,
        )
        for log in logs
    ]
