import re
import uuid
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
def error_payload(code, message, detail=None, request_id=None):
    data = {
        "code": code,
        "message": message,
        "request_id": request_id or str(uuid.uuid4()),
    }
    if detail is not None:
        data["detail"] = detail
    return {"error": data}
def _sqlstate(exc):
    return getattr(getattr(exc, "orig", None), "pgcode", None)
def _constraint_name(exc):
    text = str(getattr(exc, "orig", exc))
    match = re.search(r'constraint "([^"]+)"', text)
    return match.group(1) if match else ""
async def integrity_error_handler(request: Request, exc: IntegrityError):
    db = getattr(request.state, "db", None)
    if db is not None:
        db.rollback()
    state = _sqlstate(exc)
    constraint = _constraint_name(exc)
    if state == "23P01":
        code, message, status = "room_unavailable", "The room is not available for those dates.", 409
    elif state == "23505":
        code, message, status = "conflict", "The request conflicts with existing data.", 409
    elif state == "23503":
        code, message, status = "not_found", "A referenced resource was not found.", 404
    elif state in {"23502", "23514", "22P02", "22007", "22008"}:
        code, message, status = "constraint_violation", "The supplied data violates a database rule.", 422
    else:
        code, message, status = "database_error", "The request could not be completed.", 500
    return JSONResponse(
        status_code=status,
        content=error_payload(
            code,
            message,
            {"constraint": constraint} if constraint and state not in {"23P01"} else None,
            getattr(request.state, "request_id", None),
        ),
    )
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_payload(
            "validation_failed",
            "Request validation failed.",
            exc.errors(),
            getattr(request.state, "request_id", None),
        ),
    )
async def http_error_handler(request: Request, exc):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        status = exc.status_code
        code_map = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            409: "conflict",
            422: "validation_failed",
            429: "rate_limited",
        }
        code = code_map.get(status, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        detail = exc.detail if isinstance(exc.detail, dict) else None
        return JSONResponse(
            status_code=status,
            content=error_payload(
                code,
                message,
                detail,
                getattr(request.state, "request_id", None),
            ),
        )
    raise exc