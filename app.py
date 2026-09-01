import time
import uuid
from dotenv import load_dotenv
load_dotenv()
from auth import SECRET_KEY
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.exc import IntegrityError
from fastapi.staticfiles import StaticFiles
import os
from errors import integrity_error_handler, validation_error_handler, http_error_handler
from routers import auth, bookings, guests, properties, reports, reviews
app = FastAPI(
    title="Kaveri Stays API",
    version="1.0.0",
    description="Hotel Booking Management System",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = str(uuid.uuid4())
    start = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        if response is not None:
            response.headers["X-Request-ID"] = request.state.request_id
            response.headers["X-Response-Time-ms"] = f"{elapsed_ms:.2f}"
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(HTTPException, http_error_handler)
@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
                "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
            }
        },
    )
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(bookings.router)
app.include_router(reviews.router)
app.include_router(reports.router)
app.include_router(guests.router)
os.makedirs("static/assets", exist_ok=True)
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")
@app.get("/")
def root():
    if os.path.exists("static/index.html"):
        return FileResponse("static/index.html")
    return {"message": "Kaveri Stays API Running. Frontend is being set up."}
@app.get("/health")
def health():
    return {"status": "Healthy"}