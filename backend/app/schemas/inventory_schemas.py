from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

VALID_UNITS = {"lbs", "grams", "oz", "gallons", "pieces", "liters"}


class InventoryItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(..., ge=0)
    unit: str = Field(..., description="lbs | grams | oz | gallons | pieces | liters")
    cost_per_unit: float = Field(..., ge=0)
    low_stock_threshold: float = Field(default=0.0, ge=0)

    @validator("unit")
    def validate_unit(cls, v):
        if v not in VALID_UNITS:
            raise ValueError(f"unit must be one of: {', '.join(sorted(VALID_UNITS))}")
        return v


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    cost_per_unit: Optional[float] = Field(None, ge=0)
    low_stock_threshold: Optional[float] = Field(None, ge=0)

    @validator("unit", pre=True, always=True)
    def validate_unit(cls, v):
        if v is not None and v not in VALID_UNITS:
            raise ValueError(f"unit must be one of: {', '.join(sorted(VALID_UNITS))}")
        return v


class InventoryItemResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    quantity: float
    unit: str
    cost_per_unit: float
    low_stock_threshold: float
    low_stock: bool  # computed: quantity < low_stock_threshold
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryUploadResponse(BaseModel):
    saved_count: int
    items: List[InventoryItemResponse]


class IngredientMapping(BaseModel):
    inventory_item_id: str
    quantity_used_per_order: float = Field(..., gt=0)


class MenuMappingCreate(BaseModel):
    menu_item_id: str
    ingredients: List[IngredientMapping]


class MenuMappingResponse(BaseModel):
    id: str
    menu_item_id: str
    inventory_item_id: str
    quantity_used_per_order: float
    inventory_item_name: Optional[str] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True


class WasteEntryCreate(BaseModel):
    inventory_item_id: str
    quantity: float = Field(..., gt=0)
    note: Optional[str] = None


class InventoryLogResponse(BaseModel):
    id: str
    inventory_item_id: str
    change_type: str
    quantity: float
    order_id: Optional[str] = None
    note: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class RecommendationItem(BaseModel):
    item_name: str
    unit: str
    current_quantity: float
    avg_daily_usage: float
    recommended_order_qty: float
    cost_per_unit: float = 0.0
    estimated_cost: float = 0.0
    days_remaining: float = 0.0   # current_qty / avg_daily_usage (0 if no usage)
