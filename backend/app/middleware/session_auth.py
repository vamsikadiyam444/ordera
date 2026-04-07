from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.session_service import get_session
from app.models.owner import Owner

def get_current_session(request: Request) -> str:
    """Extract session ID from cookie."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session_id

def get_current_owner_from_session(request: Request, db: Session = Depends(get_db)) -> Owner:
    """Get current owner from session."""
    session_id = get_current_session(request)
    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    owner = db.query(Owner).filter(Owner.id == session.owner_id).first()
    if not owner:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Owner not found")

    return owner