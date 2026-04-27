from sqlalchemy import Column, String, Float, ForeignKey
import uuid
from app.database import Base


class MenuIngredient(Base):
    """Maps a menu item to the inventory items it consumes."""
    __tablename__ = "menu_ingredients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    menu_item_id = Column(String, ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_item_id = Column(String, ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False)
    quantity_used_per_order = Column(Float, nullable=False)  # e.g. 200 (grams per 1 ordered unit)
    # Unit is inherited from inventory_item.unit — not duplicated here
