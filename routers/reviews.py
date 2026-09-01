from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Booking, Guest, Property, Review, Room
from schemas import ReviewPage
router = APIRouter(prefix="/properties", tags=["reviews"])
@router.get("/{property_id}/reviews", response_model=ReviewPage)
def property_reviews(property_id: int,limit: int = Query(25, ge=1, le=100),offset: int = Query(0, ge=0),db: Session = Depends(get_db)):
    if not db.query(Property).filter(Property.property_id == property_id).first():
        raise HTTPException(404, "Property not found")
    q = (
        db.query(Review, Booking, Guest)
        .join(Booking, Booking.booking_id == Review.booking_id)
        .join(Guest, Guest.guest_id == Booking.guest_id)
        .join(Room, Room.room_id == Booking.room_id)
        .filter(Room.property_id == property_id)
    )
    total = q.count()
    rows = q.order_by(Review.review_id.desc()).offset(offset).limit(limit).all()
    items = [
        {
            "id": review.review_id,
            "booking_id": booking.booking_id,
            "rating": review.rating,
            "comment": review.comment,
            "guest_name": guest.name,
            "created_at": datetime.now(timezone.utc),
        }
        for review, booking, guest in rows
    ]
    return {"items": items, "meta": {"limit": limit, "offset": offset, "total": total}}