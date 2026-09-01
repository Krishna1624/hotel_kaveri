from datetime import date, datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from auth import require_roles
from database import get_db
from models import Booking, Property, Room, Rate
from schemas import OccupancyRow, RateMetricRow, RevenueRow
from utils import money, nights
def parse_month_bounds(month_str: str, start: date, end: date):
    dt = datetime.strptime(month_str, "%Y-%m").date()
    if dt.month == 12:
        next_dt = dt.replace(year=dt.year + 1, month=1, day=1)
    else:
        next_dt = dt.replace(month=dt.month + 1, day=1)
    return max(dt, start), min(next_dt, end)
def booking_revenue_in_month(db: Session, booking: Booking, mstart: date, mend: date) -> Decimal:
    start = max(booking.check_in, mstart)
    end = min(booking.check_out, mend)
    num_nights = (end - start).days
    if num_nights <= 0:
        return Decimal("0.00")
    room = db.query(Room).filter(Room.room_id == booking.room_id).first()
    if not room:
        return Decimal("0.00")
    total = Decimal("0.00")
    for i in range(num_nights):
        day = start.fromordinal(start.toordinal() + i)
        rate = db.query(Rate.nightly_rate).filter(
            Rate.property_id == room.property_id,
            Rate.room_type_id == room.room_type_id,
            Rate.start_date <= day,
            Rate.end_date > day,
        ).order_by(Rate.start_date.desc()).first()
        if rate:
            total += Decimal(rate[0])
    return total
router = APIRouter(prefix="/reports", tags=["reports"])
def validate_scope(property_id, user):
    if user["role"] == "owner":
        return property_id
    if property_id is None:
        return user.get("property_id")
    if property_id != user.get("property_id"):
        raise HTTPException(403, "You do not have access to this property")
    return property_id
def month_starts(start, end):
    cur = start.replace(day=1)
    while cur < end:
        yield cur
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)
def overlap_days(a, b, c, d):
    left = max(a, c)
    right = min(b, d)
    return max((right - left).days, 0)
def monthly_rows(property_id, start, end, db):
    props = [property_id] if property_id else [p.property_id for p in db.query(Property).all()]
    result = []
    for pid in props:
        prop = db.query(Property).filter(Property.property_id == pid).first()
        rooms = db.query(Room).filter(Room.property_id == pid).count()
        for month in month_starts(start, end):
            next_month = month.replace(day=28)
            if next_month.month == 12:
                next_month = next_month.replace(year=next_month.year + 1, month=1, day=1)
            else:
                next_month = next_month.replace(month=next_month.month + 1, day=1)
            mstart = max(month, start)
            mend = min(next_month, end)
            available = rooms * overlap_days(mstart, mend, mstart, mend)
            bookings = db.query(Booking).join(Room, Room.room_id == Booking.room_id).filter(
                Room.property_id == pid,
                Booking.status.in_(["confirmed", "checked_in", "checked_out"]),
                Booking.check_in < mend,
                Booking.check_out > mstart).all()
            sold = sum(overlap_days(b.check_in, b.check_out, mstart, mend) for b in bookings)
            result.append((pid, prop.name if prop else None, month.strftime("%Y-%m"), available, sold, bookings))
    return result
@router.get("/occupancy", response_model=list[OccupancyRow])
def occupancy(
    property_id: int | None = None,
    from_: date = Query(alias="from"),
    to: date = Query(),
    user=Depends(require_roles("manager", "owner")),
    db: Session = Depends(get_db),
):
    pid = validate_scope(property_id, user)
    if to <= from_:
        raise HTTPException(422, "to must be after from")
    rows = []
    for pid, name, month, available, sold, _ in monthly_rows(pid, from_, to, db):
        pct = Decimal(sold * 100) / Decimal(available) if available else Decimal("0")
        rows.append({
            "property_id": pid,
            "property_name": name,
            "month": month,
            "room_nights_available": available,
            "room_nights_sold": sold,
            "occupancy_pct": f"{pct:.2f}",
        })
    return rows
@router.get("/adr", response_model=list[RateMetricRow])
def adr(property_id: int | None = None,from_: date = Query(alias="from"),to: date = Query(),user=Depends(require_roles("manager", "owner")),db: Session = Depends(get_db)):
    pid = validate_scope(property_id, user)
    if to <= from_:
        raise HTTPException(422, "to must be after from")
    rows = []
    for pid, name, month, available, sold, bookings in monthly_rows(pid, from_, to, db):
        mstart, mend = parse_month_bounds(month, from_, to)
        revenue = sum(booking_revenue_in_month(db, b, mstart, mend) for b in bookings)
        value = revenue / Decimal(sold) if sold else Decimal("0.00")
        rows.append({
            "property_id": pid,
            "property_name": name,
            "month": month,
            "value": money(value),
        })
    return rows
@router.get("/revpar", response_model=list[RateMetricRow])
def revpar(property_id: int | None = None,from_: date = Query(alias="from"),to: date = Query(),user=Depends(require_roles("manager", "owner")),
    db: Session = Depends(get_db)):
    pid = validate_scope(property_id, user)
    if to <= from_:
        raise HTTPException(422, "to must be after from")
    rows = []
    for pid, name, month, available, sold, bookings in monthly_rows(pid, from_, to, db):
        mstart, mend = parse_month_bounds(month, from_, to)
        revenue = sum(booking_revenue_in_month(db, b, mstart, mend) for b in bookings)
        value = revenue / Decimal(available) if available else Decimal("0.00")
        rows.append({
            "property_id": pid,
            "property_name": name,
            "month": month,
            "value": money(value),
        })
    return rows
@router.get("/revenue", response_model=list[RevenueRow])
def revenue(from_: date = Query(alias="from"),to: date = Query(),user=Depends(require_roles("owner")),db: Session = Depends(get_db)):
    if to <= from_:
        raise HTTPException(422, "to must be after from")
    rows = []
    for pid, name, month, available, sold, bookings in monthly_rows(None, from_, to, db):
        mstart, mend = parse_month_bounds(month, from_, to)
        revenue = sum(booking_revenue_in_month(db, b, mstart, mend) for b in bookings)
        rows.append({
            "property_id": pid,
            "property_name": name,
            "month": month,
            "revenue": money(revenue),
        })
    return rows