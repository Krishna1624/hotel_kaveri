"""
Create local authentication accounts without changing PostgreSQL.

Set these environment variables before running:
OWNER_EMAIL / OWNER_PASSWORD
MANAGER_EMAIL / MANAGER_PASSWORD / MANAGER_PROPERTY_ID
STAFF_EMAIL / STAFF_PASSWORD / STAFF_PROPERTY_ID

For a real deployment, replace this JSON-file credential store with the
database account design required by the assignment.
"""
import os
from auth import hash_password, load_users, save_users
def add(email, password, role, property_id=None, guest_id=None):
    users = load_users()
    if any(x["email"].lower() == email.lower() for x in users):
        print(f"{email} already exists")
        return
    next_id = max([x["id"] for x in users], default=0) + 1
    users.append({
        "id": next_id,
        "email": email.lower(),
        "password_hash": hash_password(password),
        "role": role,
        "property_id": property_id,
        "guest_id": guest_id,
    })
    save_users(users)
    print(f"Created {role}: {email}")
def main():
    if os.getenv("OWNER_EMAIL") and os.getenv("OWNER_PASSWORD"):
        add(os.environ["OWNER_EMAIL"], os.environ["OWNER_PASSWORD"], "owner")
    if os.getenv("MANAGER_EMAIL") and os.getenv("MANAGER_PASSWORD"):
        add(
            os.environ["MANAGER_EMAIL"],
            os.environ["MANAGER_PASSWORD"],
            "manager",
            int(os.getenv("MANAGER_PROPERTY_ID", "1")),
        )
    if os.getenv("STAFF_EMAIL") and os.getenv("STAFF_PASSWORD"):
        add(
            os.environ["STAFF_EMAIL"],
            os.environ["STAFF_PASSWORD"],
            "staff",
            int(os.getenv("STAFF_PROPERTY_ID", "1")),
        )
if __name__ == "__main__":
    main()