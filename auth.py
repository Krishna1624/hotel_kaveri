import hashlib
import json
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
load_dotenv()
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
BASE_DIR = Path(__file__).resolve().parent
USERS_FILE = BASE_DIR / "auth_users.json"
REFRESH_FILE = BASE_DIR / "refresh_tokens.json"
security = HTTPBearer(auto_error=False)
def load_json(path):
    if not path.exists():
        path.write_text("[]", encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))
def save_json(path, data):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    temp.replace(path)
def load_users():
    return load_json(USERS_FILE)
def save_users(users):
    save_json(USERS_FILE, users)
def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
def verify_password(password, password_hash):
    return bcrypt.checkpw(password.encode(), password_hash.encode())
def create_access_token(user):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "property_id": user.get("property_id"),
        "guest_id": user.get("guest_id"),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def create_refresh_token(user):
    raw = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    record = {
        "id": str(uuid.uuid4()),
        "token_hash": token_hash,
        "user_id": user["id"],
        "family_id": str(uuid.uuid4()),
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=REFRESH_TOKEN_DAYS)).isoformat(),
        "used": False,
        "revoked": False,
    }
    tokens = load_json(REFRESH_FILE)
    tokens.append(record)
    save_json(REFRESH_FILE, tokens)
    return raw
def rotate_refresh_token(raw_token):
    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    tokens = load_json(REFRESH_FILE)
    match = next((x for x in tokens if x["token_hash"] == digest), None)
    if match is None:
        raise HTTPException(401, "Invalid refresh token")
    now = datetime.now(timezone.utc)
    expires = datetime.fromisoformat(match["expires_at"])
    if match["revoked"] or expires <= now:
        raise HTTPException(401, "Invalid refresh token")
    if match["used"]:
        family = match["family_id"]
        for token in tokens:
            if token["family_id"] == family:
                token["revoked"] = True
        save_json(REFRESH_FILE, tokens)
        raise HTTPException(401, "Refresh token reuse detected")
    match["used"] = True
    users = load_users()
    user = next((u for u in users if u["id"] == match["user_id"]), None)
    if user is None:
        save_json(REFRESH_FILE, tokens)
        raise HTTPException(401, "Invalid refresh token")
    new_raw = secrets.token_urlsafe(48)
    new_digest = hashlib.sha256(new_raw.encode()).hexdigest()
    new_record = {
        "id": str(uuid.uuid4()),
        "token_hash": new_digest,
        "user_id": user["id"],
        "family_id": match["family_id"],
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=REFRESH_TOKEN_DAYS)).isoformat(),
        "used": False,
        "revoked": False,
    }
    tokens.append(new_record)
    save_json(REFRESH_FILE, tokens)
    return user, new_raw
def revoke_refresh_token(raw_token):
    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    tokens = load_json(REFRESH_FILE)
    changed = False
    for token in tokens:
        if token["token_hash"] == digest:
            token["revoked"] = True
            changed = True
    save_json(REFRESH_FILE, tokens)
    return changed
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(401, "Authentication required")
    try:
        return jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Access token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid access token")
def require_roles(*roles):
    def dependency(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "You do not have permission to access this resource")
        return user
    return dependency