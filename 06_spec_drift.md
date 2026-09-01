# 06_spec_drift.md — Spec Drift & OpenAPI Synchronization

## Task 6.1 Differences
We checked the automatically generated specification from FastAPI (`/openapi.json`) against our handwritten `03_openapi_original.yaml` and recorded the following differences:

1.  **Validation Error Structure**:
    *   FastAPI automatically injects default `HTTPValidationError` schemas for `422` validation responses. Our hand-written spec declared unified `ErrorResponse` envelopes for validation failures.
2.  **Security Schemes**:
    *   FastAPI automatically registers security requirements at the path level when using `Depends(HTTPBearer)`. The generated spec has detailed definitions for `bearerAuth` fields under security parameters.
3.  **Role Attributes**:
    *   FastAPI does not automatically output custom attributes like `x-roles` into the generated OpenAPI document unless specifically configured inside the route description or path metadata.

---

## Stage 6 Written Answers

### Task 6.12: The Authority of the Spec
We have three documents describing the API surface:
1.  `05_openapi_final.yaml` (Hand-written design contract)
2.  FastAPI generated spec `/openapi.json` (Active code reality)
3.  Postman collection (`06_postman_collection.json`) (Testing specification)

**Which one is authoritative?**
The **generated specification (`/openapi.json`)** from FastAPI is the single source of truth because it represents the actual code running in production. A hand-written document or a Postman collection is static and can drift, but `/openapi.json` is generated directly from our Pydantic schemas and route annotations at runtime.

**How to stop them from drifting:**
We should integrate a **schema check test in the CI/CD pipeline**:
- During testing, the pipeline automatically boots the FastAPI instance in-process.
- Downloads the active `/openapi.json`.
- Runs a diff tool against `05_openapi_final.yaml`. If there is any discrepancy, the build fails.
This enforces that any change to the endpoints or validation models in code requires an updated design spec, maintaining alignment.
