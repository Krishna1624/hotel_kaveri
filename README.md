# Kaveri Stays API — no-DB-change version

## Important scope

This version is designed around the existing PostgreSQL schema supplied during the project work:

- property
- room_type
- guest
- room
- booking
- review
- rate

It does **not** create or alter PostgreSQL tables.

Because the current schema does not contain an accounts table, payments table, refresh-token table, or created_at columns, the no-DB-change version stores authentication accounts, refresh tokens and API payment/idempotency state in JSON sidecar files.

That is a deliberate compatibility choice. It is **not identical to the assignment's ideal production design**, which asks for server-side persistent credentials/payments and explicitly asks for account DDL. If the database assignment actually contains those tables, the JSON stores should be replaced with SQLAlchemy models.

## Properties

The API assumes the existing seed data contains:

1. Kaveri Riverside — Coorg
2. Kaveri Hilltop — Ooty
3. Kaveri Backwater — Alleppey

The API never invents a property. Invalid IDs return 404.

## Prerequisites

- **Python**: 3.10+ (Python 3.11 recommended)
- **Node.js**: 18+ & npm (for Frontend Vite dashboard)
- **PostgreSQL**: Running instance with the Kaveri Stays database schema

---

## Execution Commands & Quick Start

### 1. Environment Configuration

Ensure your `.env` file exists and has your database connection string, JWT parameters, and property credentials:

```ini
DATABASE_URL=postgresql+psycopg2://postgres:0963@localhost:5432/kaveri
SECRET_KEY=ZrQOlTswz3fmBwjGBqurXUwAg1W27jHc0ylIUgpGNm0
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
LOGIN_LIMIT=5
LOGIN_WINDOW_SECONDS=60

# --- Owner ---
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD=OwnerPass123

# --- Property 1: Coorg (ID: 1) ---
MANAGER_COORG_EMAIL=manager_coorg@example.com
MANAGER_COORG_PASSWORD=ManagerPass123
STAFF_COORG_EMAIL=reception_coorg@example.com
STAFF_COORG_PASSWORD=ReceptionPass123

# --- Property 2: Ooty (ID: 2) ---
MANAGER_OOTY_EMAIL=manager_ooty@example.com
MANAGER_OOTY_PASSWORD=ManagerPass123
STAFF_OOTY_EMAIL=reception_ooty@example.com
STAFF_OOTY_PASSWORD=ReceptionPass123

# --- Property 3: Alleppey (ID: 3) ---
MANAGER_ALLEPPEY_EMAIL=manager_alleppey@example.com
MANAGER_ALLEPPEY_PASSWORD=ManagerPass123
STAFF_ALLEPPEY_EMAIL=reception_alleppey@example.com
STAFF_ALLEPPEY_PASSWORD=ReceptionPass123
```

---

### 2. Backend Execution (FastAPI + Uvicorn)

#### Windows (PowerShell):
```powershell
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Seed or update default staff and management accounts
python seed_auth.py

# 4. Start the FastAPI backend server
uvicorn app:app --reload --port 8000
```

#### Windows (Command Prompt - CMD):
```cmd
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
python seed_auth.py
uvicorn app:app --reload --port 8000
```

#### Linux / macOS (Bash / Zsh):
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed_auth.py
uvicorn app:app --reload --port 8000
```

---

### 3. Frontend Execution (React + Vite)

In a separate terminal:

```bash
# 1. Install frontend dependencies
npm install

# 2. Start the Vite development server (proxies API requests to :8000)
npm run dev
```

> **Note for Production Build**: Run `npm run build` to compile the frontend assets into the `static/` directory, allowing the FastAPI server to serve the frontend directly at `http://127.0.0.1:8000/`.

---

### 4. Render Cloud Deployment

#### A. Database (Render PostgreSQL)
1. Create a PostgreSQL instance on Render.
2. Restore local schema and data using `pg_restore`:
   ```powershell
   pg_restore --dbname="<RENDER_EXTERNAL_DB_URL>" --no-owner --no-privileges "kaveri_local.dump"
   ```

#### B. Web Service Configuration
- **Runtime**: `Python 3`
- **Build Command**:
  ```bash
  npm install && npm run build && pip install -r requirements.txt && python seed_auth.py
  ```
- **Start Command**:
  ```bash
  uvicorn app:app --host 0.0.0.0 --port $PORT
  ```
- **Environment Variables**: Add `DATABASE_URL` (Render Internal DB URL), `SECRET_KEY`, and the manager/staff credentials listed above.

---

### 5. Application URLs & Endpoints

| Service / Interface | URL | Description |
| :--- | :--- | :--- |
| **Frontend Dev UI** | [http://localhost:3000](http://localhost:3000) | Vite React management & booking dashboard |
| **FastAPI Backend / App** | [http://127.0.0.1:8000](http://127.0.0.1:8000) | Main API root / Served Frontend |
| **Interactive Swagger Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Swagger UI for testing API endpoints |
| **OpenAPI Specification** | [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json) | Raw OpenAPI schema |
| **Health Check** | [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) | API health check endpoint |

## Guest registration

Any valid email can register:

```json
{
  "email": "guest@example.com",
  "password": "GuestPass123",
  "full_name": "Test Guest",
  "phone": "8888888888"
}
```

`role` is not accepted. Pydantic's `extra="forbid"` rejects it with 422.

## Staff/manager/owner

Do not self-register staff. Seeded accounts include:

*   **Owner**: `owner@example.com` (Configurable via `OWNER_PASSWORD`)
*   **Property 1 (Coorg)**: Manager `manager_coorg@example.com` (`MANAGER_COORG_PASSWORD`) / Receptionist `reception_coorg@example.com` or `reception@example.com` (`STAFF_COORG_PASSWORD`)
*   **Property 2 (Ooty)**: Manager `manager_ooty@example.com` or `manager@example.com` (`MANAGER_OOTY_PASSWORD`) / Receptionist `reception_ooty@example.com` (`STAFF_OOTY_PASSWORD`)
*   **Property 3 (Alleppey)**: Manager `manager_alleppey@example.com` (`MANAGER_ALLEPPEY_PASSWORD`) / Receptionist `reception_alleppey@example.com` (`STAFF_ALLEPPEY_PASSWORD`)

Whenever credentials in `.env` are changed, run:

```powershell
python seed_auth.py
```

`seed_auth.py` automatically updates and re-hashes existing passwords.

The property assignment is carried in the authentication record, not in PostgreSQL.

## Swagger authentication

1. POST /auth/login
2. Copy access_token
3. Click Authorize
4. Enter:

```text
Bearer <access_token>
```

5. Test protected endpoints.

## Authorization

- guest: own bookings/payments/reviews only
- staff: assigned property operational access
- manager: assigned property reports and management access
- owner: cross-property access where the operation allows owner

401 = missing/expired/forged token.

403 = authenticated but not permitted.

404 = resource does not exist, or an object is deliberately hidden from the caller.

409 = request conflicts with current database state, such as a double-booking.

422 = request is syntactically valid but a field or business constraint is invalid.

## Booking dates

All dates are `YYYY-MM-DD`.

A stay is `[check_in, check_out)`, so a room checking out on 15 is available to another guest checking in on 15.

## Security

- bcrypt password hashing
- JWT HS256 access tokens
- exp claim on access tokens
- rotated single-use refresh tokens
- refresh token reuse revokes the token family
- strict Pydantic request models
- no client-supplied nightly rate
- sort fields use a whitelist
- generic database error messages
- request IDs in responses
- no password hash in response schemas

## Existing database remains unchanged

Do not run `Base.metadata.create_all()`.

The application maps to the existing tables only.

## Testing

```powershell
pytest -q
```

For coverage:

```powershell
pytest --cov=. --cov-report=term-missing
```

## Assignment evidence still needs to be collected

The assignment asks for more than source code: constraint inventory, original OpenAPI, reconciliation, authorization matrices, Postman environments/collection, attack evidence, EXPLAIN ANALYZE output, query counts, concurrency evidence and written answers.

The source assignment says these are submission artifacts and that Stage 6 requires a Postman collection with four environments and an end-to-end “take a booking” flow. See the supplied assignment before claiming those artifacts are complete.

## Current no-DB-change limitation

The current project files shown during development have no PostgreSQL payment table and no account table. Therefore:

- authentication accounts -> auth_users.json
- refresh tokens -> refresh_tokens.json
- payments/idempotency -> payments.json
- review created_at -> API-generated timestamp

If your actual database contains these tables, stop using the JSON stores and map them through SQLAlchemy instead. That would be the proper version for the full assignment.
