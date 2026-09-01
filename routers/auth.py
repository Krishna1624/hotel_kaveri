import os
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session
from auth import (
    ACCESS_TOKEN_MINUTES,
    create_access_token,
    create_refresh_token,
    get_current_user,
    load_users,
    hash_password,
    revoke_refresh_token,
    rotate_refresh_token,
    save_users,
    verify_password,
)
from database import get_db
from models import Guest
from schemas import LoginRequest, Me, RefreshRequest, RegisterRequest, TokenPair
router = APIRouter(prefix="/auth", tags=["auth"])
@router.post("/register", response_model=Me, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    email = str(data.email).lower().strip()
    users = load_users()
    if any(u["email"].lower() == email for u in users):
        raise HTTPException(409, "Email is already registered")
    guest = db.query(Guest).filter(Guest.email.ilike(email)).first()
    if guest is None:
        guest = Guest(name=data.full_name, email=email, phone=data.phone)
        db.add(guest)
        db.flush()
    else:
        guest.name = data.full_name
        if data.phone is not None:
            guest.phone = data.phone
    user_id = max([u["id"] for u in users], default=0) + 1
    user = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "role": "guest",
        "property_id": None,
        "guest_id": guest.guest_id,
    }
    users.append(user)
    save_users(users)
    db.commit()
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": guest.name,
        "role": "guest",
        "property_id": None,
    }
@router.post("/login", response_model=TokenPair)
def login(data: LoginRequest):
    users = load_users()
    email = str(data.email).lower().strip()
    user = next((u for u in users if u["email"].lower() == email), None)
    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {
        "access_token": create_access_token(user),
        "refresh_token": create_refresh_token(user),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
    }

@router.post("/refresh", response_model=TokenPair)
def refresh(data: RefreshRequest):
    user, new_refresh = rotate_refresh_token(data.refresh_token)
    return {
        "access_token": create_access_token(user),
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
    }
@router.post("/logout", status_code=204)
def logout(
    data: RefreshRequest | None = None, user=Depends(get_current_user),):
    if data:
        revoke_refresh_token(data.refresh_token)
    return Response(status_code=204)
@router.get("/health-auth")
def auth_health():
    return {"status": "ok"}
@router.get("/me", response_model=Me)
def get_me(user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = int(user["sub"])
    email = user["email"]
    role = user["role"]
    property_id = user.get("property_id")
    guest_id = user.get("guest_id")
    full_name = "User"
    if role == "guest" and guest_id:
        guest = db.query(Guest).filter(Guest.guest_id == guest_id).first()
        if guest:
            full_name = guest.name
    else:
        full_name = email.split("@")[0].replace(".", " ").title()
    return {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "role": role,
        "property_id": property_id,
    }