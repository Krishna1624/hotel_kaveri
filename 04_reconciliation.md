# 04_reconciliation.md — OpenAPI Reconciliation & Differences

This document lists the comparison between the initial hand-written OpenAPI design and the final reveal specification (`05_openapi_reveal_reference.yaml`).

---

## ⚖️ Reconciliation & Design Choices

### 1. Arguable Choices (Where different approaches are valid)

*   **Status Transitions (Action Endpoints vs. Status PATCH)**:
    *   *Our original design:* Evaluated using action endpoints (`/bookings/{id}/check-in`, `/bookings/{id}/check-out`, `/bookings/{id}/cancel`, `/bookings/{id}/no-show`).
    *   *Reveal spec choice:* Aligned. Action endpoints are chosen to represent discrete state transitions in the lifecycle. This isolates business logic rules (e.g., checking in is staff-only, while cancelling is allowed by guests and staff) cleanly into separate route handlers and authorization policies, rather than putting complex condition checks inside a single `PATCH /bookings/{id}` endpoint.
*   **Reports Tree Organization**:
    *   *Our original design:* Placed reports under `/properties/{property_id}/reports/occupancy` to emphasize hierarchical resource structures.
    *   *Reveal spec choice:* Moved reports to `/reports/occupancy?property_id=...`. This is a cleaner RESTful approach for multi-property searches (e.g., an owner requesting reports across all hotels by omitting the property filter). It also centralizes reports authentication policies under `/reports` rather than distributing them across individual property endpoints.

### 2. Non-Arguable Choices (Where there is only one correct design)

*   **HTTP 401 vs. 403**:
    *   *Correct logic:* 401 is raised when credentials/tokens are missing, expired, or cryptographically invalid (identity unknown). 403 is raised when the identity is verified but has insufficient privileges (role mismatch) or violates property scopes. Mixing these up leaks data scopes or permits unauthorized escalation.
*   **Stateless Price Ingestion**:
    *   *Correct logic:* Ingesting the nightly rate or total amount directly in `POST /bookings` from the request body is a severe financial exploit threat. The rate MUST always be computed server-side by looking up active entries in the `rate` table. The API client only provides check-in/out range and room parameters.
*   **Room Double-Bookings (Concurrence)**:
    *   *Correct logic:* Validating availability in Python memory and then inserting is vulnerable to race conditions. The double-booking prevention must be backed by a database-level exclusion constraint (`EXCLUDE USING GIST`) on check-in/out ranges.

### 3. Key Adjustments Made (For reveal compatibility)
- Updated request payload schemas to incorporate `additionalProperties: false` to reject undeclared input parameters.
- Standardized error bodies to always conform to the global `ErrorResponse` envelope containing `code`, `message`, and `request_id` parameters.
