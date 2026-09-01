from fastapi import Depends, HTTPException
from auth import get_current_user
def property_scope(property_id: int, user=Depends(get_current_user)):
    role = user.get("role")
    if role == "owner":
        return property_id
    if role in {"staff", "manager"}:
        assigned = user.get("property_id")
        if assigned is None or assigned != property_id:
            raise HTTPException(403, "You do not have access to this property")
        return property_id
    raise HTTPException(403, "You do not have permission to access this property")