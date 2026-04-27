from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.owner import Owner
from app.models.restaurant import Restaurant
from app.schemas.auth import (
    OwnerCreate, OwnerLogin, OwnerResponse, Token,
    UpdateEmail, UpdatePhone, UpdatePassword,
    SendOTP, UpdateEmailWithOTP, UpdatePhoneWithOTP,
    LoginRequest, LoginVerify, SignupVerify,
)
from app.services.otp_service import generate_otp, verify_otp
from app.services.auth_service import (
    hash_password, verify_password, authenticate_owner, create_access_token, get_owner_by_email
)
from app.middleware.auth import get_current_owner
from app.config import settings
import time

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory login rate limiter: {ip: [timestamp, ...]}
_login_attempts: dict = {}
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 60


def _check_rate_limit(ip: str):
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    # Drop attempts outside the window
    attempts = [t for t in attempts if now - t < _WINDOW_SECONDS]
    if len(attempts) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Please wait {_WINDOW_SECONDS} seconds.",
        )
    attempts.append(now)
    _login_attempts[ip] = attempts


@router.post("/signup", status_code=201)
def signup(data: OwnerCreate, db: Session = Depends(get_db)):
    """Step 1: Create account, send OTP to email and phone."""
    existing = get_owner_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    owner = Owner(
        email=data.email,
        password_hash=hash_password(data.password),
        restaurant_name=data.restaurant_name,
        phone=data.phone,
    )
    db.add(owner)
    db.flush()

    # Auto-create first restaurant
    restaurant = Restaurant(
        owner_id=owner.id,
        name=data.restaurant_name,
    )
    db.add(restaurant)
    db.commit()
    db.refresh(owner)

    # Generate OTP and send to email + phone
    identifier = f"signup:{data.email}"
    code = generate_otp(db, identifier)

    from app.services.email_service import send_otp_email
    send_otp_email(data.email, code, purpose="signup")

    if data.phone:
        from app.services.sms_service import send_otp_sms
        send_otp_sms(data.phone, code, purpose="signup")

    response: dict = {
        "pending": True,
        "message": f"Verification code sent to {data.email}" + (f" and {data.phone}" if data.phone else ""),
        "email": data.email,
    }
    if settings.APP_ENV != "production":
        response["otp"] = code
        response["dev_mode"] = True

    return response


@router.post("/signup/verify", response_model=Token)
def signup_verify(data: SignupVerify, db: Session = Depends(get_db)):
    """Step 2: Verify OTP and issue JWT token."""
    identifier = f"signup:{data.email}"
    if not verify_otp(db, identifier, data.otp_code):
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    owner = get_owner_by_email(db, data.email)
    if not owner:
        raise HTTPException(status_code=404, detail="Account not found")

    token = create_access_token({"sub": owner.id})
    return Token(access_token=token, owner=OwnerResponse.model_validate(owner))


@router.post("/login/request")
def login_request(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Step 1: Validate credentials, send OTP to email.
    Falls back to direct JWT issuance when SMTP is not configured."""
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    owner = authenticate_owner(db, data.email, data.password)
    if not owner:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Skip OTP in dev mode or when SMTP is not configured
    if settings.APP_ENV != "production" or not settings.SMTP_HOST:
        token = create_access_token({"sub": owner.id})
        return Token(access_token=token, owner=OwnerResponse.model_validate(owner))

    identifier = f"login:{data.email}"
    code = generate_otp(db, identifier)

    from app.services.email_service import send_otp_email
    send_otp_email(data.email, code, purpose="login")

    response: dict = {"message": f"Verification code sent to {data.email}"}
    if settings.APP_ENV != "production":
        response["otp"] = code
        response["dev_mode"] = True
    return response


@router.post("/login/verify", response_model=Token)
def login_verify(data: LoginVerify, db: Session = Depends(get_db)):
    """Step 2: Verify OTP, issue JWT token."""
    identifier = f"login:{data.email}"
    if not verify_otp(db, identifier, data.otp_code):
        raise HTTPException(status_code=401, detail="Invalid or expired verification code")

    owner = get_owner_by_email(db, data.email)
    if not owner:
        raise HTTPException(status_code=404, detail="Account not found")

    token = create_access_token({"sub": owner.id})
    return Token(access_token=token, owner=OwnerResponse.model_validate(owner))


@router.post("/login", response_model=Token)
def login(data: OwnerLogin, request: Request, db: Session = Depends(get_db)):
    """Legacy single-step login (kept for backward compatibility)."""
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    owner = authenticate_owner(db, data.email, data.password)
    if not owner:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": owner.id})
    return Token(access_token=token, owner=OwnerResponse.model_validate(owner))


@router.get("/me", response_model=OwnerResponse)
def get_me(current_owner: Owner = Depends(get_current_owner)):
    return OwnerResponse.model_validate(current_owner)


@router.post("/logout")
def logout(current_owner: Owner = Depends(get_current_owner)):
    return {"message": "Logged out successfully"}


@router.post("/send-otp")
def send_otp(data: SendOTP, db: Session = Depends(get_db)):
    """Generate and send an OTP for email or phone verification."""
    if data.type not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="type must be 'email' or 'phone'")
    identifier = f"{data.type}:{data.value}"
    code = generate_otp(db, identifier)

    # Send via email/SMS (logs to console in dev when SMTP not configured)
    if data.type == "email":
        from app.services.email_service import send_otp_email
        send_otp_email(data.value, code, purpose="verification")
    # SMS sending is handled by the caller if phone

    response: dict = {"message": f"OTP sent to {data.value}"}

    # Always expose OTP in non-production mode so developers can test
    # without checking email (email is still sent when configured)
    if settings.APP_ENV != "production":
        response["otp"] = code
        response["dev_mode"] = True

    return response


@router.patch("/email", response_model=OwnerResponse)
def update_email(
    data: UpdateEmailWithOTP,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    if not verify_password(data.password, current_owner.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")
    identifier = f"email:{data.new_email}"
    if not verify_otp(db, identifier, data.code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    existing = get_owner_by_email(db, data.new_email)
    if existing and existing.id != current_owner.id:
        raise HTTPException(status_code=400, detail="Email already in use")
    current_owner.email = data.new_email
    db.commit()
    db.refresh(current_owner)
    return OwnerResponse.model_validate(current_owner)


@router.patch("/phone")
def update_phone(
    data: UpdatePhoneWithOTP,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    identifier = f"phone:{data.phone}"
    if not verify_otp(db, identifier, data.code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    restaurant = current_owner.restaurants[0] if current_owner.restaurants else None
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found")
    restaurant.phone = data.phone
    db.commit()
    return {"message": "Phone number updated", "phone": data.phone}


@router.get("/otp-debug")
def otp_debug(db: Session = Depends(get_db)):
    """DEV ONLY — show all OTP entries in DB to diagnose verification issues."""
    if settings.APP_ENV == "production":
        raise HTTPException(status_code=404, detail="Not found")
    from app.models.otp import OTPCode
    entries = db.query(OTPCode).all()
    now = time.time()
    return {
        "count": len(entries),
        "entries": [
            {
                "identifier": e.identifier,
                "code": e.code,
                "expires_in_seconds": round(e.expires_at - now),
                "expired": now > e.expires_at,
            }
            for e in entries
        ]
    }


@router.patch("/password")
def update_password(
    data: UpdatePassword,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    if not verify_password(data.current_password, current_owner.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    current_owner.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
