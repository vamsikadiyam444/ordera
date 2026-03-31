"""
OTP model — stores one-time passwords in the database so they work
across multiple backend replicas (unlike in-memory storage).
"""
from sqlalchemy import Column, String, DateTime, Float
from app.database import Base
import uuid


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    identifier = Column(String, nullable=False, unique=True, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(Float, nullable=False)  # Unix timestamp
