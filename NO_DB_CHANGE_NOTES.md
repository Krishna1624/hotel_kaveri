# No-DB-change implementation notes

The supplied API assignment says PostgreSQL should remain as built, but its Stage 2 tasks also ask for an accounts design/DDL and its Stage 5 tasks assume persistent payments. The currently supplied SQLAlchemy models contain no accounts/payment table.

Therefore this implementation intentionally does not change PostgreSQL.

## What is implemented

- FastAPI
- Swagger/OpenAPI
- JWT authentication
- bcrypt
- guest self-registration
- controlled staff/manager/owner bootstrap
- role authorization
- property scoping dependency
- guest object-level ownership
- booking lifecycle
- server-side rate lookup
- availability with half-open date ranges
- idempotency-key payment store
- review rules
- centralized IntegrityError mapping
- generic error envelope
- request IDs
- strict request bodies
- pytest smoke tests

## What cannot honestly be claimed as database-enforced without changing the schema

- persistent payments in PostgreSQL
- persistent refresh tokens in PostgreSQL
- account DDL/constraints in PostgreSQL
- database-created timestamps for bookings/reviews

Do not submit this as a claim that those database requirements are fulfilled. If the original database assignment has the missing tables, use that schema instead.
