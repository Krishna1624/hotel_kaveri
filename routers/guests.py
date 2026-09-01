from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from auth import require_roles
from database import get_db
from models import Booking, Guest
from schemas import GuestOut, GuestPage, PageMeta
router = APIRouter(prefix="/guests", tags=["guests"])
@router.get("", response_model=GuestPage)
def list_guests(
    email: str | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(require_roles("staff", "manager", "owner")),
    db: Session = Depends(get_db),
):
    q = db.query(Guest)
    if email:
        q = q.filter(func.lower(Guest.email) == email.lower())
    total = q.count()
    rows = q.order_by(Guest.guest_id).offset(offset).limit(limit).all()
    items = []
    for g in rows:
        stay_count = db.query(Booking).filter(Booking.guest_id == g.guest_id).count()
        items.append({
            "id": g.guest_id,
            "email": g.email,
            "full_name": g.name,
            "phone": g.phone,
            "stay_count": stay_count,
        })
    return {"items": items, "meta": {"limit": limit, "offset": offset, "total": total}}
@router.get("/{guest_id}", response_model=GuestOut)
def get_guest(guest_id: int,user=Depends(require_roles("staff", "manager", "owner")),db: Session = Depends(get_db),):
    g = db.query(Guest).filter(Guest.guest_id == guest_id).first()
    if not g:
        raise HTTPException(404, "Guest not found")
    stay_count = db.query(Booking).filter(Booking.guest_id == g.guest_id).count()
    return {
        "id": g.guest_id,
        "email": g.email,
        "full_name": g.name,
        "phone": g.phone,
        "stay_count": stay_count,
    }