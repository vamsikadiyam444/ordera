from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class OwnerCreate(BaseModel):
    email: EmailStr
    password: str
    restaurant_name: str


class OwnerLogin(BaseModel):
    email: EmailStr
    password: str


class OwnerResponse(BaseModel):
    id: str
    email: str
    restaurant_name: str
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    owner: OwnerResponse


class TokenData(BaseModel):
    owner_id: Optional[str] = None


class UpdateEmail(BaseModel):
    new_email: EmailStr
    password: str


class UpdatePhone(BaseModel):
    phone: str


class UpdatePassword(BaseModel):
    current_password: str
    new_password: str


class SendOTP(BaseModel):
    type: str  # 'email' or 'phone'
    value: str  # the email or phone to verify


class VerifyOTP(BaseModel):
    type: str
    value: str
    code: str


class UpdateEmailWithOTP(BaseModel):
    new_email: str
    code: str
    password: str


class UpdatePhoneWithOTP(BaseModel):
    phone: str
    code: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginVerify(BaseModel):
    email: EmailStr
    otp_code: str
