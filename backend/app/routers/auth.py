from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.owner import Owner
from app.models.restaurant import Restaurant
from app.schemas.auth import (
    OwnerCreate, OwnerLogin, OwnerResponse, Token,
    UpdateEmail, UpdatePhone, UpdatePassword,
    SendOTP, UpdateEmailWithOTP, UpdatePhoneWithOTP,
)
from app.services.otp_service import generate_otp, verify_otp
from app.services.auth_service import (
    hash_password, verify_password, authenticate_owner, create_access_token, get_owner_by_email
)
from app.middleware.auth import get_current_owner

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=Token, status_code=201)
def signup(data: OwnerCreate, db: Session = Depends(get_db)):
    if get_owner_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    owner = Owner(
        email=data.email,
        password_hash=hash_password(data.password),
        restaurant_name=data.restaurant_name,
    )
    db.add(owner)
    db.flush()  # Get owner.id

    # Auto-create first restaurant
    restaurant = Restaurant(
        owner_id=owner.id,
        name=data.restaurant_name,
    )
    db.add(restaurant)
    db.commit()
    db.refresh(owner)

    token = create_access_token({"sub": owner.id})
    return Token(access_token=token, owner=OwnerResponse.model_validate(owner))


@router.post("/login", response_model=Token)
def login(data: OwnerLogin, db: Session = Depends(get_db)):
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
    # JWT is stateless; client deletes the token
    return {"message": "Logged out successfully"}


@router.post("/send-otp")
def send_otp(data: SendOTP):
    """Generate an OTP for email or phone verification.
    In dev mode the OTP is returned directly (no email/SMS provider configured).
    """
    if data.type not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="type must be 'email' or 'phone'")
    identifier = f"{data.type}:{data.value}"
    code = generate_otp(identifier)
    # In production you would send via email/SMS here.
    # For dev/testing we return the code so the frontend can display it.
    return {"message": f"OTP sent to {data.value}", "otp": code}


@router.patch("/email", response_model=OwnerResponse)
def update_email(
    data: UpdateEmailWithOTP,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    if not verify_password(data.password, current_owner.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")
    # Verify OTP for the new email
    identifier = f"email:{data.new_email}"
    if not verify_otp(identifier, data.code):
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
    # Verify OTP for the phone number
    identifier = f"phone:{data.phone}"
    if not verify_otp(identifier, data.code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    # Update phone on the owner's restaurant
    restaurant = current_owner.restaurants[0] if current_owner.restaurants else None
    if not restaurant:
        raise HTTPException(status_code=404, detail="No restaurant found")
    restaurant.phone = data.phone
    db.commit()
    return {"message": "Phone number updated", "phone": data.phone}


@router.patch("/password")
def update_password(
    data: UpdatePassword,
    db: Session = Depends(get_db),
    current_owner: Owner = Depends(get_current_owner),
):
    if not verify_password(data.current_password, current_owner.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_owner.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
