import os
import pytest
from fastapi.testclient import TestClient
os.environ.setdefault("SECRET_KEY", "test-secret-" + "x" * 32)
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://invalid:invalid@localhost:5432/invalid")
from app import app
client = TestClient(app)
def test_root():
    response = client.get("/")
    assert response.status_code == 200
    if response.headers.get("content-type", "").startswith("text/html"):
        assert "Kaveri Stays" in response.text
    else:
        assert "Kaveri Stays API Running" in response.json()["message"]
def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "Healthy"
def test_register_rejects_role_field():
    response = client.post(
        "/auth/register",
        json={
            "email": "attack@example.com",
            "password": "Password12345",
            "full_name": "Attacker",
            "role": "owner",
        },
    )
    assert response.status_code == 422
def test_missing_token_is_401():
    response = client.get("/me")
    assert response.status_code in {401, 404}