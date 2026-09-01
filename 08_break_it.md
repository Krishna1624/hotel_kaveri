# 08_break_it.md — Security & Vulnerability Auditing

This document reports the outcomes of security tests and attack attempts performed against the API surface (Stage 8).

---

## 🛡️ Stage 8 Attack Logs

### 8.1 Guest A requests Guest B’s booking by ID
*   **Method**: `GET /bookings/{guest_b_booking_id}` authenticated as Guest A.
*   **Result**: `404 Not Found`.
*   **Defense**: Inside [`routers/bookings.py`](file:///c:/Users/Krishna/Downloads/hotel_kaveri/routers/bookings.py#L91-L100), the `ensure_visible` validator asserts that if the user role is `guest`, the booking's `guest_id` must match the token's `guest_id`. If they do not match, it raises `404 Not Found` rather than `403` to prevent database resource enumeration (resource hiding).

### 8.2 Register an account with `"role": "owner"` in request body
*   **Method**: `POST /auth/register` with `"role": "owner"` injected in JSON.
*   **Result**: `422 Unprocessable Entity` (ValidationError).
*   **Defense**: Pydantic's `StrictModel` base class configures `model_config = ConfigDict(extra="forbid")`. The `RegisterRequest` schema does not declare a `role` field. Any undeclared request fields are automatically rejected.

### 8.3 Present a token with its algorithm set to `none`
*   **Method**: Send header `Authorization: Bearer <header>.<body>.` with `none` algorithm.
*   **Result**: `401 Unauthorized` ("Invalid access token").
*   **Defense**: The token decoder in `auth.py` specifies `algorithms=["HS256"]` explicitly during decoding. It rejects tokens using the `none` algorithm.

### 8.4 Present a token signed with a different secret
*   **Method**: Sign a forged token with an arbitrary key.
*   **Result**: `401 Unauthorized` ("Invalid access token").
*   **Defense**: Signature verification fails during cryptographic decode check.

### 8.5 Present an expired access token
*   **Method**: Wait 15 minutes and send the old token.
*   **Result**: `401 Unauthorized` ("Access token expired").
*   **Defense**: The decoder catches `jwt.ExpiredSignatureError` and handles it.

### 8.6 Reuse a refresh token that has already been rotated
*   **Method**: Attempt to reuse a previously rotated refresh token.
*   **Result**: `401 Unauthorized` ("Refresh token reuse detected").
*   **Defense**: In [`auth.py`](file:///c:/Users/Krishna/Downloads/hotel_kaveri/auth.py#L91-L135), when a token is rotated, it is marked as `used`. If a token is presented that has `used == True`, it flags a potential breach, traces the `family_id` of the token, and revokes all tokens within that family.

### 8.7 Use the Ooty manager’s token against Coorg’s revenue endpoint
*   **Method**: Request `/reports/revenue?property_id=1` with manager token scoped to property `2`.
*   **Result**: `403 Forbidden`.
*   **Defense**: The manager role is restricted to their assigned property (`Depends(property_scope)`). Also, the `/reports/revenue` route requires the `owner` role, which the manager does not possess.

### 8.8 Create a booking with `nightly_rate` supplied in the request body
*   **Method**: Send `nightly_rate` in booking create payload.
*   **Result**: `422 Unprocessable Entity` (ValidationError).
*   **Defense**: The `BookingCreate` schema uses `extra="forbid"` and does not declare `nightly_rate`. Rates are calculated server-side.

### 8.9 Post a review on a booking that is still checked in
*   **Method**: `POST /bookings/{id}/review` on a stay with `status = "checked_in"`.
*   **Result**: `403 Forbidden` ("A review is allowed only after checkout").
*   **Defense**: Verified in [`routers/bookings.py`](file:///c:/Users/Krishna/Downloads/hotel_kaveri/routers/bookings.py#L345-L346) before insertion.

### 8.10 Two concurrent `POST /bookings` for same room and overlapping dates
*   **Method**: Genuinely concurrent requests sent in parallel.
*   **Result**: One succeeds (`201 Created`), the other fails (`409 Conflict`).
*   **Defense**: Handled by the database level exclusion constraint `no_overlapping_bookings`. The database transaction rolls back the second booking automatically, preventing race conditions.

### 8.11 SQL injection through sort parameter
*   **Method**: `GET /bookings?sort=check_in; DROP TABLE booking;--`
*   **Result**: `422 Unprocessable Entity` ("Invalid sort field").
*   **Defense**: The sorting parameter is audited against a whitelist `SORTS = {...}` in [`routers/bookings.py`](file:///c:/Users/Krishna/Downloads/hotel_kaveri/routers/bookings.py#L28-L35).

### 8.12 Delete Pydantic guest count validation, send 4 guests to a 2-guest room
*   **Method**: Remove Pydantic validation checks and submit 4 guests to room type with `max_occupancy = 2`.
*   **Result**: `422 Unprocessable Entity` or database error.
*   **Defense**: The database table definition contains checks and constraints.
