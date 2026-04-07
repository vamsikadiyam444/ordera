from sqlalchemy.orm import Session
from app.models.session import OAuthSession
from datetime import datetime
import secrets
from cryptography.fernet import Fernet
from app.config import settings

def create_session(db: Session, owner_id: int, provider: str, token_data: dict) -> str:
    """Create a new OAuth session and return session ID."""
    session = OAuthSession(
        owner_id=owner_id,
        provider=provider,
        access_token=encrypt_token(token_data.get('access_token', '')),
        refresh_token=encrypt_token(token_data.get('refresh_token', '')),
        token_type=token_data.get('token_type', 'Bearer'),
        expires_at=datetime.fromtimestamp(token_data.get('expires_at', 0)) if token_data.get('expires_at') else None,
        scope=token_data.get('scope', ''),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session.session_id

def get_session(db: Session, session_id: str) -> OAuthSession:
    """Retrieve session by ID."""
    return db.query(OAuthSession).filter(
        OAuthSession.session_id == session_id,
        OAuthSession.is_active == True
    ).first()

def invalidate_session(db: Session, session_id: str) -> bool:
    """Mark session as inactive."""
    session = get_session(db, session_id)
    if session:
        session.is_active = False
        db.commit()
        return True
    return False

def get_decrypted_token(session: OAuthSession) -> dict:
    """Get decrypted token data from session."""
    return {
        'access_token': decrypt_token(session.access_token),
        'refresh_token': decrypt_token(session.refresh_token),
        'token_type': session.token_type,
        'expires_at': session.expires_at.timestamp() if session.expires_at else None,
        'scope': session.scope,
    }

def encrypt_token(token: str) -> str:
    """Encrypt sensitive token data."""
    if not token:
        return ""
    key = settings.ENCRYPTION_KEY.encode()
    f = Fernet(key)
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    """Decrypt token data."""
    if not encrypted:
        return ""
    key = settings.ENCRYPTION_KEY.encode()
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()