from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, Text
from database import Base
class Property(Base):
    __tablename__ = "property"
    property_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=False)
    stars = Column(Integer, nullable=False)
class RoomType(Base):
    __tablename__ = "room_type"
    room_type_id = Column(Integer, primary_key=True)
    type_name = Column(String(20), nullable=False)
    max_occupancy = Column(Integer, nullable=False)
class Guest(Base):
    __tablename__ = "guest"
    guest_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    city = Column(String(100))
class Room(Base):
    __tablename__ = "room"
    room_id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("property.property_id"), nullable=False)
    room_number = Column(String(10), nullable=False)
    room_type_id = Column(Integer, ForeignKey("room_type.room_type_id"), nullable=False)
class Booking(Base):
    __tablename__ = "booking"
    booking_id = Column(Integer, primary_key=True)
    guest_id = Column(Integer, ForeignKey("guest.guest_id"), nullable=False)
    room_id = Column(Integer, ForeignKey("room.room_id"), nullable=False)
    check_in = Column(Date, nullable=False)
    check_out = Column(Date, nullable=False)
    guest_count = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)
class Review(Base):
    __tablename__ = "review"
    review_id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("booking.booking_id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
class Rate(Base):
    __tablename__ = "rate"
    rate_id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("property.property_id"), nullable=False)
    room_type_id = Column(Integer, ForeignKey("room_type.room_type_id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    nightly_rate = Column(Numeric(10, 2), nullable=False)