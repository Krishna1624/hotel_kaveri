from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from auth import require_roles
from database import get_db
from models import RoomType
from schemas import RoomTypeOut, PageMeta
router = APIRouter(prefix="/room-types", tags=["room types"])
@router.get("", response_model=dict)
def list_room_types(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(require_roles("staff", "manager", "owner")),
    db: Session = Depends(get_db),
):
    q = db.query(RoomType)
    total = q.count()
    rows = q.order_by(RoomType.room_type_id).offset(offset).limit(limit).all()
    return {
        "items": [{"name": r.type_name, "max_occupancy": r.max_occupancy} for r in rows],
        "meta": {"limit": limit, "offset": offset, "total": total},
    }