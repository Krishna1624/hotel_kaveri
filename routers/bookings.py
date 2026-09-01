from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session
from auth import get_current_user, require_roles
from database import get_db
from models import Booking, Guest, Property, Rate, Room, RoomType, Review
from schemas import (
    BookingCreate,
    BookingOut,
    BookingPage,
    BookingStatus,
    PageMeta,
    PaymentCreate,
    PaymentOut,
    ReviewCreate,
    ReviewOut,
    ReviewPage,
)
from stores import add_payment, add_review_meta, find_payment_by_key, payments_for_booking, reviews_meta
from utils import money, nights, utcnow
router = APIRouter(prefix="/bookings", tags=["bookings"])
SORTS = {
    "check_in": Booking.check_in,
    "-check_in": Booking.check_in.desc(),
    "created_at": Booking.booking_id.desc(),
    "-created_at": Booking.booking_id.desc(),
    "total_amount": Booking.booking_id.asc(),
    "-total_amount": Booking.booking_id.desc(),
}
TRANSITIONS = {
    "confirmed": {"checked_in", "cancelled", "no_show"},
    "checked_in": {"checked_out"},
    "checked_out": set(),
    "cancelled": set(),
    "no_show": set(),
}
def booking_property_id(db, booking):
    room = db.query(Room).filter(Room.room_id == booking.room_id).first()
    return room.property_id if room else None
def booking_total(db, booking):
    total = Decimal("0.00")
    for i in range(nights(booking.check_in, booking.check_out)):
        day = booking.check_in.fromordinal(booking.check_in.toordinal() + i)
        rate = db.query(Rate.nightly_rate).filter(
            Rate.property_id == booking_property_id(db, booking),
            Rate.room_type_id == db.query(Room).filter(Room.room_id == booking.room_id).first().room_type_id,
            Rate.start_date <= day,
            Rate.end_date > day,
        ).order_by(Rate.start_date.desc()).first()
        if rate is not None:
            total += Decimal(rate[0])
    return total
def booking_out(db, booking):
    room = db.query(Room).filter(Room.room_id == booking.room_id).first()
    guest = db.query(Guest).filter(Guest.guest_id == booking.guest_id).first()
    paid = sum((Decimal(x["amount"]) for x in payments_for_booking(booking.booking_id)), Decimal("0.00"))
    total = booking_total(db, booking)
    return {
        "id": booking.booking_id,
        "property_id": room.property_id,
        "room_id": booking.room_id,
        "room_number": room.room_number,
        "guest_id": booking.guest_id,
        "guest_name": guest.name if guest else "",
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "nights": nights(booking.check_in, booking.check_out),
        "guests": booking.guest_count,
        "status": booking.status,
        "total_amount": money(total),
        "total_paid": money(paid),
        "balance": money(total - paid),
        "created_at": utcnow(),
    }
def ensure_visible(db, booking, user):
    role = user.get("role")
    if role == "guest" and booking.guest_id != user.get("guest_id"):
        raise HTTPException(404, "Booking not found")
    if role in {"staff", "manager"}:
        prop = booking_property_id(db, booking)
        if prop != user.get("property_id"):
            raise HTTPException(404, "Booking not found")
@router.get("", response_model=BookingPage)
def list_bookings(
    property_id: int | None = None,
    status: BookingStatus | None = None,
    guest_id: int | None = None,
    from_: date | None = Query(None, alias="from"),
    to: date | None = None,
    sort: str = "-check_in",
    limit: int = 25,
    offset: int = 0,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if sort not in SORTS:
        raise HTTPException(422, "Invalid sort field")
    q = db.query(Booking)
    has_joined_room = False
    if user.get("role") == "guest":
        q = q.filter(Booking.guest_id == user.get("guest_id"))
    elif user.get("role") in {"staff", "manager"}:
        q = q.join(Room, Room.room_id == Booking.room_id)
        has_joined_room = True
        q = q.filter(Room.property_id == user.get("property_id"))
    if property_id is not None:
        if not has_joined_room:
            q = q.join(Room, Room.room_id == Booking.room_id)
            has_joined_room = True
        q = q.filter(Room.property_id == property_id)
    if status:
        q = q.filter(Booking.status == status.value)
    if guest_id is not None and user.get("role") != "guest":
        q = q.filter(Booking.guest_id == guest_id)
    if from_ and isinstance(from_, date):
        q = q.filter(Booking.check_out > from_)
    if to and isinstance(to, date):
        q = q.filter(Booking.check_in < to)
    total = q.count()
    rows = q.order_by(SORTS[sort]).offset(offset).limit(limit).all()
    return {
        "items": [booking_out(db, b) for b in rows],
        "meta": {"limit": limit, "offset": offset, "total": total},
    }
@router.post("", response_model=BookingOut, status_code=201)
def create_booking(data: BookingCreate,user=Depends(get_current_user),db: Session = Depends(get_db)):
    role = user.get("role")
    room = db.query(Room).filter(Room.room_id == data.room_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if role in {"staff", "manager"} and room.property_id != user.get("property_id"):
        raise HTTPException(403, "You do not have access to this property")
    if role == "guest":
        guest_id = user.get("guest_id")
    else:
        guest_id = data.guest_id
    if not guest_id:
        raise HTTPException(422, "guest_id is required for staff bookings")
    guest = db.query(Guest).filter(Guest.guest_id == guest_id).first()
    if not guest:
        raise HTTPException(404, "Guest not found")
    rt = db.query(RoomType).filter(RoomType.room_type_id == room.room_type_id).first()
    if not rt:
        raise HTTPException(404, "Room type not found")
    if data.guests > rt.max_occupancy:
        raise HTTPException(422, "Guest count exceeds room type maximum occupancy")
    total = Decimal("0.00")
    for i in range(nights(data.check_in, data.check_out)):
        day = data.check_in.fromordinal(data.check_in.toordinal() + i)
        rate = db.query(Rate.nightly_rate).filter(
            Rate.property_id == room.property_id,
            Rate.room_type_id == room.room_type_id,
            Rate.start_date <= day,
            Rate.end_date > day,
        ).order_by(Rate.start_date.desc()).first()
        if rate is None:
            raise HTTPException(422, "No rate plan exists for part of the stay")
        total += Decimal(rate[0])
    booking = Booking(
        guest_id=guest_id,
        room_id=data.room_id,
        check_in=data.check_in,
        check_out=data.check_out,
        guest_count=data.guests,
        status="confirmed",
    )
    db.add(booking)
    db.flush()
    if data.deposit:
        amount = Decimal(data.deposit.amount)
        if amount > total:
            db.rollback()
            raise HTTPException(422, "Payment exceeds booking total")
        add_payment({
            "id": max([x["id"] for x in payments_for_booking(booking.booking_id)], default=0) + 1,
            "booking_id": booking.booking_id,
            "amount": money(amount),
            "method": data.deposit.method.value,
            "reference": data.deposit.reference,
            "paid_at": utcnow().isoformat(),
            "idempotency_key": f"deposit-{booking.booking_id}",
        })
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)
@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int,user=Depends(get_current_user),db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    ensure_visible(db, booking, user)
    return booking_out(db, booking)
def transition(db, booking_id, target, user, allowed_roles):
    if user.get("role") not in allowed_roles:
        raise HTTPException(403, "You do not have permission to perform this transition")
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    ensure_visible(db, booking, user)
    if target not in TRANSITIONS.get(booking.status, set()):
        raise HTTPException(409, "Illegal booking status transition")
    booking.status = target
    db.commit()
    db.refresh(booking)
    return booking_out(db, booking)
@router.post("/{booking_id}/check-in", response_model=BookingOut)
def check_in(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return transition(db, booking_id, "checked_in", user, {"staff", "manager", "owner"})
@router.post("/{booking_id}/check-out", response_model=BookingOut)
def check_out(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return transition(db, booking_id, "checked_out", user, {"staff", "manager", "owner"})
@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return transition(db, booking_id, "cancelled", user, {"guest", "staff", "manager", "owner"})
@router.post("/{booking_id}/no-show", response_model=BookingOut)
def no_show(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return transition(db, booking_id, "no_show", user, {"staff", "manager", "owner"})
@router.get("/{booking_id}/payments", response_model=list[PaymentOut])
def list_payments(booking_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    ensure_visible(db, booking, user)
    return payments_for_booking(booking_id)
@router.post("/{booking_id}/payments", response_model=PaymentOut)
def add_installment(booking_id: int,
    data: PaymentCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    ensure_visible(db, booking, user)
    existing = find_payment_by_key(idempotency_key)
    if existing:
        if existing["booking_id"] != booking_id:
            raise HTTPException(409, "Idempotency key was already used for another payment")
        return existing
    total = booking_total(db, booking)
    paid = sum((Decimal(x["amount"]) for x in payments_for_booking(booking_id)), Decimal("0.00"))
    amount = Decimal(data.amount)
    if paid + amount > total:
        raise HTTPException(422, "Payment exceeds booking balance")
    existing_ids = [x["id"] for x in payments_for_booking(booking_id)]
    record = {
        "id": max(existing_ids, default=0) + 1,
        "booking_id": booking_id,
        "amount": money(amount),
        "method": data.method.value,
        "reference": data.reference,
        "paid_at": utcnow().isoformat(),
        "idempotency_key": idempotency_key,
    }
    add_payment(record)
    return record
@router.post("/{booking_id}/review", response_model=ReviewOut, status_code=201)
def create_review(booking_id: int,data: ReviewCreate,user=Depends(require_roles("guest")),db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.guest_id != user.get("guest_id"):
        raise HTTPException(404, "Booking not found")
    if booking.status != "checked_out":
        raise HTTPException(403, "A review is allowed only after checkout")
    if db.query(Review).filter(Review.booking_id == booking_id).first():
        raise HTTPException(409, "A review already exists for this booking")
    review = Review(booking_id=booking_id,rating=data.rating,comment=data.comment)
    db.add(review)
    db.commit()
    db.refresh(review)
    guest = db.query(Guest).filter(Guest.guest_id == booking.guest_id).first()
    return {
        "id": review.review_id,
        "booking_id": booking_id,
        "rating": review.rating,
        "comment": review.comment,
        "guest_name": guest.name if guest else "",
        "created_at": utcnow(),
    }