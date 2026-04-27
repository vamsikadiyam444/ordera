from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
import uuid
from app.database import Base


class InventoryLog(Base):
    """Immutable audit log — every inventory change produces one row."""
    __tablename__ = "inventory_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    inventory_item_id = Column(String, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True)
    change_type = Column(String(20), nullable=False)  # 'added' | 'used' | 'wasted'
    quantity = Column(Float, nullable=False)           # always positive
    order_id = Column(String, ForeignKey("orders.id"), nullable=True)  # null for manual entries
    note = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
