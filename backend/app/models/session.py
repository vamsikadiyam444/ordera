from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
import secrets

class OAuthSession(Base):
    __tablename__ = "oauth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True, default=lambda: secrets.token_urlsafe(32))
    owner_id = Column(String, ForeignKey("owners.id"), index=True, nullable=False)
    provider = Column(String(50))  # 'gmail', 'google', etc.
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_type = Column(String(50))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    scope = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())