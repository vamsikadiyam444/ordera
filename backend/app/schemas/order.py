from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OrderItemResponse(BaseModel):
    id: str
    name: str
    quantity: int
    price: float
    modification: Optional[str]

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[dict]
    total: float
    special_instructions: Optional[str] = None
    pay_method: Optional[str] = "cash"  # cash | card_on_pickup | stripe_link


class OrderStatusUpdate(BaseModel):
    status: str   # new | confirmed | preparing | ready | picked_up | cancelled


class OrderResponse(BaseModel):
    id: str
    restaurant_id: str
    customer_name: Optional[str]
    customer_phone: Optional[str]
    status: str
    total: float
    pay_method: str
    payment_status: str
    stripe_payment_link: Optional[str]
    call_sid: Optional[str]
    special_instructions: Optional[str]
    items: List[OrderItemResponse] = []
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
