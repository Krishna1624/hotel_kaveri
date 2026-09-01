# 02_auth_design.md — Identity and Token Design

## Identity Model Defense

For our Kaveri Stays implementation, we separated the authentication credentials from the PostgreSQL relational `guest` table. Credentials reside in a decoupled sidecar schema (mocked as `auth_users.json` for compatibility with the assignment's database scope, or structured as an `accounts` table in production).

### Why decoupling guest credentials is correct:
1. **Domain Isolation**: Staff, managers, and owners are not guests. Putting staff records into a `guest` table to enable credentials would create dirty domain schemas.
2. **Career Transitions**: A guest might one day be hired as hotel staff. If credentials are fused to the guest row, managing the transition without breaking historical guest booking ties is highly complex. With a separate accounts system, a single guest profile remains in the database, and a new account is provisioned for their staff duties.
3. **Passwordless Legacy Records**: Many guests in the database are legacy contacts imported from the old spreadsheets. They do not have accounts or passwords, and may never log in. Fusing passwords to the table forces null values or dummy credentials, whereas decoupling lets guest details exist independently.

---

## Written Answers

### Task 2.6: Claims in the Access Token
Our JWT access token contains the following claims:
- `sub`: Unique account identifier (string). Used to identify the session.
- `email`: User's email address (for UI display and logging).
- `role`: Role string (`guest`, `staff`, `manager`, `owner`). Used for structural route guards.
- `property_id`: The property ID the staff/manager is scoped to (or `null` for guests/owners).
- `guest_id`: The postgres `guest_id` mapping if the user is a registered guest.

**Deliberately Kept Out:**
- Password hashes (never serialize credentials).
- Personal info (addresses, phone numbers) to prevent bloating the token payload.
- Refresh tokens (which have different lifecycles and expiration limits).

*Note:* Anyone who intercepts a JWT can decode and read all of its claims because JWTs are base64-encoded and signed, not encrypted. Cryptographic signature ensures integrity, not confidentiality.

### Task 2.8: The Fired Manager Scenario (Instant Revocation)
If a manager is fired at 10:00 but their token is valid until 10:15:
- **What happens:** In a stateless system, the manager can still access all manager endpoints until 10:15.
- **Remediation Choices:**
  1. *Allow drift*: Let it expire in 15 minutes. This is standard for low-risk systems.
  2. *Blacklisting*: Store the account ID in a fast-access database/cache (like Redis) with a TTL of 15 minutes when fired. Every request verifies that the token signature is valid AND that the token is not on the blacklist.
- **Cost:** Implementing instant blacklists requires a database/cache call on *every single request*, which strips away the performance advantages of stateless JWT tokens.

### Task 2.9: Property Scope Allocation
- **Our Choice:** Scoping is embedded in the token (`property_id` claim) at login.
- **Transfer Mid-Shift:** If a manager is transferred mid-shift, they will continue to have access to their old property (Ooty) for the remaining lifetime of the access token (max 15 minutes). When the client calls `/auth/refresh`, the new property scope (Coorg) will be queried and encoded into the new access token.

### Task 2.12: HS256 vs RS256
- **Current choice:** HS256 (Symmetric signing). A single monolithic backend service issues and verifies tokens, so keeping a shared secret key is secure and fast.
- **Why switch to RS256:** If Kaveri Stays scales to a distributed microservice architecture (e.g. separate billing service, room service, booking service, and auth server). Under RS256, the auth server holds the private key to sign tokens, and downstream microservices can verify tokens using the public key without needing access to the private signing secret.
