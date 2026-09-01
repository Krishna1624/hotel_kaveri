# 01_constraints.md — Constraint Inventory & Design

## Stage 1 Constraint Inventory

| Table | Constraint Name | Type | Business Rule Served | SQLSTATE | HTTP Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **property** | `property_stars_check` | CHECK | Stars rating must be between 1 and 5. | `23514` | `422 Unprocessable` |
| **room_type** | `room_type_max_occupancy_check` | CHECK | Room type capacity must be positive. | `23514` | `422 Unprocessable` |
| **room_type** | `room_type_type_name_key` | UNIQUE | Room type name must be unique. | `23505` | `409 Conflict` |
| **guest** | `guest_email_key` | UNIQUE | Guests identified by unique email. | `23505` | `409 Conflict` |
| **room** | `unique_room_per_property` | UNIQUE | Room numbers must be unique within a property. | `23505` | `409 Conflict` |
| **room** | `room_property_id_fkey` | FOREIGN KEY | Room must belong to an existing property. | `23503` | `404 Not Found` |
| **room** | `room_room_type_id_fkey` | FOREIGN KEY | Room must refer to a valid room type. | `23503` | `404 Not Found` |
| **booking** | `booking_guest_count_check` | CHECK | Stay must have at least one guest. | `23514` | `422 Unprocessable` |
| **booking** | `booking_guest_id_fkey` | FOREIGN KEY | Booking must belong to a valid registered guest. | `23503` | `404 Not Found` |
| **booking** | `booking_room_id_fkey` | FOREIGN KEY | Booking must target a valid room. | `23503` | `404 Not Found` |
| **booking** | `no_overlapping_bookings` | EXCLUDE | Room cannot be double-booked for overlapping dates. | `23P01` | `409 Conflict` |
| **payment** | `payment_booking_id_fkey` | FOREIGN KEY | Payment must refer to an existing booking. | `23503` | `404 Not Found` |
| **review** | `one_review_per_booking` | UNIQUE | One review permitted per booking. | `23505` | `409 Conflict` |
| **review** | `review_booking_id_fkey` | FOREIGN KEY | Review must refer to a valid booking. | `23503` | `404 Not Found` |
| **review** | `review_rating_check` | CHECK | Review rating must be between 1 and 5. | `23514` | `422 Unprocessable` |
| **rate** | `no_overlapping_rates` | EXCLUDE | Rates for same room type & property cannot overlap dates. | `23P01` | `409 Conflict` |
| **rate** | `rate_positive_check` | CHECK | Nightly rate must be greater than zero. | `23514` | `422 Unprocessable` |
| **rate** | `rate_property_id_fkey` | FOREIGN KEY | Rate must belong to a valid property. | `23503` | `404 Not Found` |
| **rate** | `rate_room_type_id_fkey` | FOREIGN KEY | Rate must belong to a valid room type. | `23503` | `404 Not Found` |

### HTTP Status Code Violation Breakdown
We ended up mapping database violations to **3 distinct HTTP status codes**:
- `404 Not Found` (for missing foreign key associations)
- `409 Conflict` (for unique duplicates and temporal date overlaps)
- `422 Unprocessable` (for domain check constraint value violations)

---

## Stage 1 Written Answers

### Task 1.3: Individually Well-Formed Conflicting Requests
Three constraints that are violated by individually valid payloads but conflict with existing database records:
1. `no_overlapping_bookings` (Double-booking a room)
2. `no_overlapping_rates` (Creating overlapping rate schedules)
3. `guest_email_key` (Registering an email that already exists)

**Why `400 Bad Request` is incorrect:**
`400` denotes syntactic errors, malformed envelopes, or unparseable payloads. The request itself is syntactically pristine (perfect dates, valid integers, clean strings). The failure is semantic and conditional upon the current state of the database resources. Therefore, `409 Conflict` is the correct RESTful code.

### Task 1.4: PostgreSQL Exclusion Constraint Errors
When `no_overlapping_bookings` fails, PostgreSQL returns:
`ERROR: conflicting key value violates exclusion constraint "no_overlapping_bookings" DETAIL: Key (room_id, daterange(check_in, check_out, '[)'::text))=(12, [2026-09-01, 2026-09-05)) conflicts with existing key (room_id, daterange(check_in, check_out, '[)'::text))=(12, [2026-08-30, 2026-09-03)).`

**Information Leakage Prevention:**
A client must never see the raw detail message. It leaks database table names (`booking`), column names (`room_id`, `check_in`, `check_out`), and importantly, **exposes private reservation dates of another guest** in that room. The API intercepts this error and returns a generic `409` code: `"The room is not available for those dates."`

### Task 1.5: Rule 3 (Guest Count vs Max Occupancy)
Rule 3 specifies that a booking's guest count cannot exceed the room type's maximum occupancy.
- **API Enforcement:** Verified in `POST /bookings` by querying the associated `Room` and `RoomType` and raising `422` if exceeded.
- **Database Enforcement:** The current PostgreSQL schema does not have a cross-table check constraint between `booking.guest_count` and `room_type.max_occupancy` directly, as check constraints cannot run subqueries across tables. A direct `INSERT` bypass via `psql` would succeed unless a database trigger is written to validate it before insertion.

### Task 1.6: Unenforceable Constraints & API Bypasses
The rule that could not be fully enforced via a static SQL constraint is **Rule 6 (Nightly Rate Calculation)**:
- A booking's total price must match the sum of nightly rates in the `rate` table matching each day of the stay duration.
- **Where it lives:** Enforced at the API layer by calculating nightly rates server-side inside `POST /bookings` and storing it.
- **psql Bypass:** If a user logs into PostgreSQL via `psql` and runs a raw `INSERT INTO booking`, they can supply any check-in/out range without calculating rates. The database stores the booking, but the financial ledger (total amount vs payments) will drift from the rate table unless a Postgres procedural trigger handles the lookup.
