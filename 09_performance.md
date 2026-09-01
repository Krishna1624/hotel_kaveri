# 09_performance.md — Performance Tuning & Concurrency

## Task 9.1: N+1 Query Resolution

### 1. The N+1 Query Identification
In the endpoint `GET /bookings`, the code retrieves a list of bookings and maps each row via `booking_out(db, booking)`. Inside `booking_out`, the following queries are executed for **every single booking row**:
```python
room = db.query(Room).filter(Room.room_id == booking.room_id).first()
guest = db.query(Guest).filter(Guest.guest_id == booking.guest_id).first()
```
For a list of $N$ bookings, this executes $1$ primary query to fetch the bookings, and then $2N$ additional queries to fetch the associated rooms and guests. This is a classic $O(N)$ database roundtrip bottleneck.

### 2. Resolution Strategy
To fix this N+1 query issue, we rewrite the primary query to **join** the related tables and load them eagerly in a single database roundtrip using SQLAlchemy's `joinedload` or explicit joins:
```python
rows = (
    db.query(Booking)
    .join(Room, Room.room_id == Booking.room_id)
    .join(Guest, Guest.guest_id == Booking.guest_id)
    .filter(...)
    .options(joinedload(Booking.room), joinedload(Booking.guest))
    .all()
)
```
This reduces the query count from $2N + 1$ to exactly **1 query**, yielding a significant performance boost.

---

## Task 9.2: Connection Pool Exhaustion

- **Connection Pool Configuration**:
  Our pool size is configured in `database.py` as:
  ```python
  pool_size=5
  max_overflow=5
  ```
  This allows up to 5 permanent connections in the pool, with an additional 5 temporary connections under high load (total of 10 concurrent active connections).
- **Behavior under exhaustion**:
  When all 10 connections are occupied (e.g. by slow queries or long-running requests), any new incoming database request blocks. It waits for a connection to be returned to the pool. If no connection becomes free within the timeout limit (default is 30 seconds in SQLAlchemy), the request fails with a `TimeoutError` (specifically `sqlalchemy.exc.TimeoutError`), returning an HTTP 500 error to the client.

---

## Task 9.3: Rate Limiting `POST /auth/login`

- **Implementation**:
  We configured rate limiting parameters in `.env`:
  ```text
  LOGIN_LIMIT=5
  LOGIN_WINDOW_SECONDS=60
  ```
  This restricts an IP address or email to a maximum of 5 login attempts within a 60-second window.
- **Client response**:
  When the threshold is exceeded, the request is blocked and returns:
  - **HTTP Status Code**: `429 Too Many Requests`
  - **Error Envelope**: `{"error": {"code": "rate_limited", "message": "Too many login attempts. Please try again later."}}`

---

## Task 9.4: Availability Query Performance

- **Availability Endpoint Query**:
  The availability endpoint queries rooms that do not have booking overlaps using the `no_overlapping_bookings` constraint index.
- **Indexes Utilized**:
  - The database uses the **GIST index** created by the exclusion constraint `no_overlapping_bookings` on the `booking` table:
    `no_overlapping_bookings EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out, '[)') WITH &&)`
  - This index enables fast range overlap checks (`&&`) in $O(\log N)$ time, avoiding sequential scans on the entire bookings table.
  - Additionally, B-Tree indexes on `rate(property_id, room_type_id, start_date, end_date)` ensure rapid nightly rate resolution.
