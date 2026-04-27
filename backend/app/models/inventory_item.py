from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
import uuid
from app.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    quantity = Column(Float, default=0.0)            # current stock level
    unit = Column(String(50), nullable=False)         # lbs | grams | oz | gallons | pieces | liters
    cost_per_unit = Column(Float, default=0.0)        # $ per unit
    low_stock_threshold = Column(Float, default=0.0)  # alert when quantity falls below this
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
