from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, exists, not_, or_
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db
from dependencies import property_scope
from models import Booking, Property, Rate, Room, RoomType
from schemas import (
    AvailabilityResponse,
    AvailableRoom,
    PageMeta,
    PropertyOut,
    RoomOut,
    RoomPage,
    RoomTypeOut,
)
from utils import money, nights
router = APIRouter(prefix="/properties", tags=["properties"])
def property_out(p):
    return {"id": p.property_id, "name": p.name, "city": p.city, "stars": p.stars}
@router.get("", response_model=dict)
def list_properties(db: Session = Depends(get_db)):
    return {"items": [property_out(p) for p in db.query(Property).order_by(Property.property_id).all()]}
@router.get("/{property_id}", response_model=PropertyOut)
def get_property(property_id: int, db: Session = Depends(get_db)):
    p = db.query(Property).filter(Property.property_id == property_id).first()
    if not p:
        raise HTTPException(404, "Property not found")
    return property_out(p)
@router.get("/{property_id}/rooms", response_model=RoomPage)
def list_rooms(
    property_id: int,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    scoped_property: int = Depends(property_scope),
):
    p = db.query(Property).filter(Property.property_id == property_id).first()
    if not p:
        raise HTTPException(404, "Property not found")
    q = db.query(Room, RoomType).join(RoomType, Room.room_type_id == RoomType.room_type_id).filter(Room.property_id == property_id)
    total = q.count()
    rows = q.order_by(Room.room_id).offset(offset).limit(limit).all()
    items = [
        {
            "id": room.room_id,
            "property_id": room.property_id,
            "room_number": room.room_number,
            "room_type": {"name": rt.type_name, "max_occupancy": rt.max_occupancy},
        }
        for room, rt in rows
    ]
    return {"items": items, "meta": {"limit": limit, "offset": offset, "total": total}}
@router.get("/{property_id}/availability", response_model=AvailabilityResponse)
def availability(
    property_id: int,
    from_: date = Query(alias="from"),
    to: date = Query(),
    room_type: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if to <= from_:
        raise HTTPException(422, "to must be after from")
    p = db.query(Property).filter(Property.property_id == property_id).first()
    if not p:
        raise HTTPException(404, "Property not found")
    q = db.query(Room, RoomType).join(RoomType, Room.room_type_id == RoomType.room_type_id).filter(Room.property_id == property_id)
    if room_type:
        q = q.filter(RoomType.type_name == room_type)
    overlap = exists().where(and_(
            Booking.room_id == Room.room_id,
            Booking.status.notin_(["cancelled", "no_show"]),
            Booking.check_in < to,
            Booking.check_out > from_))
    q = q.filter(not_(overlap))
    items = []
    n = nights(from_, to)
    for room, rt in q.order_by(Room.room_id).all():
        total = Decimal("0.00")
        has_rate = True
        for day_index in range(n):
            day = from_.fromordinal(from_.toordinal() + day_index)
            rate = db.query(Rate.nightly_rate).filter(
                Rate.property_id == property_id,
                Rate.room_type_id == room.room_type_id,
                Rate.start_date <= day,
                Rate.end_date > day,
            ).order_by(Rate.start_date.desc()).first()
            if rate is None:
                has_rate = False
                break
            total += Decimal(rate[0])
        if not has_rate:
            continue
        items.append({
            "room_id": room.room_id,
            "room_number": room.room_number,
            "room_type": {"name": rt.type_name, "max_occupancy": rt.max_occupancy},
            "nights": n,
            "total_rate": money(total),
        })
    return {"property_id": property_id, "from": from_, "to": to, "items": items}