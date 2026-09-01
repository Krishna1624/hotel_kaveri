# 03_authorization_matrix.md — Authorization Matrix

This document defines the structural access control configuration for every API route against the four defined user roles (`guest`, `staff`, `manager`, `owner`).

---

## Authorization Access Matrix

| Endpoint | Guest | Staff | Manager | Owner | Scope & Ownership Controls |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `POST /auth/register` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public self-registration (creates guest account only). |
| `POST /auth/login` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public authentication. |
| `POST /auth/refresh` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public session token rotation. |
| `POST /auth/logout` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Authenticated session revocation. |
| `GET /auth/me` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Profile retrieval of current authenticated user. |
| `GET /properties` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public directory of hotels. |
| `GET /properties/{id}` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public hotel details. |
| `GET /properties/{id}/rooms` | Denied | **Allowed** | **Allowed** | **Allowed** | Scoped to assigned property for staff/managers. |
| `GET /properties/{id}/availability` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public room availability search. |
| `GET /properties/{id}/reviews` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Public property review logs. |
| `GET /bookings` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Row Filtered**: Guest sees own stays. Staff/Manager see assigned property. Owner sees all. |
| `POST /bookings` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Guest books own. Staff/Manager books for guest in assigned property. Owner has global booking rights. |
| `GET /bookings/{id}` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | **Object Scoped**: Guest sees own. Staff/Manager sees assigned property booking. Owner sees all. |
| `POST /bookings/{id}/check-in` | Denied | **Allowed** | **Allowed** | **Allowed** | Scoped to assigned property for staff/managers. |
| `POST /bookings/{id}/check-out` | Denied | **Allowed** | **Allowed** | **Allowed** | Scoped to assigned property for staff/managers. |
| `POST /bookings/{id}/cancel` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Guest cancels own booking. Staff/Manager/Owner cancels scoped. |
| `POST /bookings/{id}/no-show` | Denied | **Allowed** | **Allowed** | **Allowed** | Scoped to assigned property for staff/managers. |
| `GET /bookings/{id}/payments` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Guest sees own payments. Staff/Manager/Owner sees scoped. |
| `POST /bookings/{id}/payments` | **Allowed** | **Allowed** | **Allowed** | **Allowed** | Guest pays own booking. Staff/Manager/Owner registers desk payment. |
| `POST /bookings/{id}/review` | **Allowed** | Denied | Denied | Denied | Guest writes review for own booking post check-out. |
| `GET /reports/occupancy` | Denied | Denied | **Allowed** | **Allowed** | Manager scoped to property, Owner sees all properties. |
| `GET /reports/adr` | Denied | Denied | **Allowed** | **Allowed** | Manager scoped to property, Owner sees all properties. |
| `GET /reports/revpar` | Denied | Denied | **Allowed** | **Allowed** | Manager scoped to property, Owner sees all properties. |
| `GET /reports/revenue` | Denied | Denied | Denied | **Allowed** | Owner only. Managers and below are denied. |
| `GET /guests` | Denied | **Allowed** | **Allowed** | **Allowed** | Guest list lookup. Staff/Manager/Owner only. |
| `GET /guests/{id}` | Denied | **Allowed** | **Allowed** | **Allowed** | Guest details lookup. Staff/Manager/Owner only. |

---

## Scoping & Object Ownership Rule Logic

1. **Manager Property Scope Transfer**:
   A manager's `property_id` is encoded directly inside their JWT token claims. If a manager gets transferred to a different property mid-shift, their current session token will continue to access the previous property's records until it expires (max 15 minutes) or they log out. 

2. **Public Routing Guidelines**:
   Public routes require no authentication token (`x-roles: [public]`). However, if a valid token is provided, the API reads the token context to adjust guest lookup references or filter scoping.

3. **Stateless Claims versus Request Queries**:
   Guest references (`guest_id`) are resolved directly from the JWT claims for guest accounts, eliminating client-side manipulation attacks (e.g. attempting to create a booking or review for another guest's ID). For staff and managers, the `guest_id` is supplied in the request body since they are booking on behalf of another user.
