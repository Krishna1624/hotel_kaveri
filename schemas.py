from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
class BookingStatus(str, Enum):
    confirmed = "confirmed"
    checked_in = "checked_in"
    checked_out = "checked_out"
    cancelled = "cancelled"
    no_show = "no_show"
class PaymentMethod(str, Enum):
    card = "card"
    upi = "upi"
    bank_transfer = "bank_transfer"
    cash = "cash"
class Role(str, Enum):
    guest = "guest"
    staff = "staff"
    manager = "manager"
    owner = "owner"
class RegisterRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=10)
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = None
class LoginRequest(StrictModel):
    email: EmailStr
    password: str
class RefreshRequest(StrictModel):
    refresh_token: str
class TokenPair(StrictModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
class Me(StrictModel):
    id: int
    email: EmailStr
    full_name: str
    role: Role
    property_id: int | None = None
class PropertyOut(StrictModel):
    id: int
    name: str
    city: str
    stars: int
class RoomTypeOut(StrictModel):
    name: str
    max_occupancy: int
class RoomOut(StrictModel):
    id: int
    property_id: int
    room_number: str
    room_type: RoomTypeOut
class PageMeta(StrictModel):
    limit: int
    offset: int
    total: int
class RoomPage(StrictModel):
    items: list[RoomOut]
    meta: PageMeta
class AvailableRoom(StrictModel):
    room_id: int
    room_number: str
    room_type: RoomTypeOut
    nights: int
    total_rate: str
class AvailabilityResponse(StrictModel):
    property_id: int
    from_: date = Field(alias="from")
    to: date
    items: list[AvailableRoom]
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
class PaymentCreate(StrictModel):
    amount: Decimal
    method: PaymentMethod
    reference: str | None = None
    @field_validator("amount")
    @classmethod
    def positive(cls, value):
        if value <= 0:
            raise ValueError("amount must be positive")
        return value
class PaymentOut(StrictModel):
    id: int
    booking_id: int
    amount: str
    method: PaymentMethod
    reference: str | None = None
    paid_at: datetime
class BookingCreate(StrictModel):
    room_id: int
    check_in: date
    check_out: date
    guests: int = Field(ge=1)
    guest_id: int | None = None
    deposit: PaymentCreate | None = None
    @field_validator("check_out")
    @classmethod
    def after_check_in(cls, value, info):
        check_in = info.data.get("check_in")
        if check_in and value <= check_in:
            raise ValueError("check_out must be after check_in")
        return value
class BookingOut(StrictModel):
    id: int
    property_id: int
    room_id: int
    room_number: str
    guest_id: int
    guest_name: str
    check_in: date
    check_out: date
    nights: int
    guests: int
    status: BookingStatus
    total_amount: str
    total_paid: str
    balance: str
    created_at: datetime
class BookingPage(StrictModel):
    items: list[BookingOut]
    meta: PageMeta
class ReviewCreate(StrictModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)
class ReviewOut(StrictModel):
    id: int
    booking_id: int
    rating: int
    comment: str | None
    guest_name: str
    created_at: datetime
class ReviewPage(StrictModel):
    items: list[ReviewOut]
    meta: PageMeta
class OccupancyRow(StrictModel):
    property_id: int
    property_name: str | None = None
    month: str
    room_nights_available: int
    room_nights_sold: int
    occupancy_pct: str
class RateMetricRow(StrictModel):
    property_id: int
    property_name: str | None = None
    month: str
    value: str
class RevenueRow(StrictModel):
    property_id: int
    property_name: str | None = None
    month: str
    revenue: str
class GuestOut(StrictModel):
    id: int
    email: EmailStr
    full_name: str
    phone: str | None = None
    stay_count: int = 0
class GuestPage(StrictModel):
    items: list[GuestOut]
    meta: PageMeta
class ErrorDetail(StrictModel):
    code: str
    message: str
    detail: Any | None = None
    request_id: str
class ErrorResponse(StrictModel):
    error: ErrorDetail