from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from auth import require_roles
from database import get_db
from models import Rate
router = APIRouter(prefix="/rates", tags=["rates"])
@router.get("")
def list_rates(user=Depends(require_roles("manager", "owner")),db: Session = Depends(get_db)):
    return [
        {
            "rate_id": r.rate_id,
            "property_id": r.property_id,
            "room_type_id": r.room_type_id,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "nightly_rate": str(r.nightly_rate),
        }
        for r in db.query(Rate).order_by(Rate.rate_id).all()
    ]