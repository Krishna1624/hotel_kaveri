import json
from pathlib import Path
from threading import Lock
BASE_DIR = Path(__file__).resolve().parent
PAYMENTS_FILE = BASE_DIR / "payments.json"
REVIEWS_META_FILE = BASE_DIR / "review_meta.json"
LOCK = Lock()
def _load(path, default):
    if not path.exists():
        path.write_text(json.dumps(default, indent=2), encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))
def _save(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(path)
def payments():
    return _load(PAYMENTS_FILE, [])
def add_payment(record):
    with LOCK:
        rows = payments()
        rows.append(record)
        _save(PAYMENTS_FILE, rows)
def find_payment_by_key(key):
    return next((x for x in payments() if x["idempotency_key"] == key), None)
def payments_for_booking(booking_id):
    return [x for x in payments() if x["booking_id"] == booking_id]
def reviews_meta():
    return _load(REVIEWS_META_FILE, [])
def add_review_meta(record):
    with LOCK:
        rows = reviews_meta()
        rows.append(record)
        _save(REVIEWS_META_FILE, rows)