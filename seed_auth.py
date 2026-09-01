"""
Create or update local authentication accounts without changing PostgreSQL.

Set these environment variables before running:
OWNER_EMAIL / OWNER_PASSWORD
MANAGER_COORG_EMAIL / MANAGER_COORG_PASSWORD
MANAGER_OOTY_EMAIL / MANAGER_OOTY_PASSWORD
MANAGER_ALLEPPEY_EMAIL / MANAGER_ALLEPPEY_PASSWORD
STAFF_COORG_EMAIL / STAFF_COORG_PASSWORD
STAFF_OOTY_EMAIL / STAFF_OOTY_PASSWORD
STAFF_ALLEPPEY_EMAIL / STAFF_ALLEPPEY_PASSWORD
"""
import os
from dotenv import load_dotenv
from auth import hash_password, load_users, save_users

load_dotenv()

def upsert_user(email, password, role, property_id=None, guest_id=None):
    if not email or not password:
        return
    users = load_users()
    email_clean = email.strip().lower()
    existing = next((u for u in users if u["email"].lower() == email_clean), None)
    
    if existing:
        existing["password_hash"] = hash_password(password)
        existing["role"] = role
        existing["property_id"] = property_id
        if guest_id is not None:
            existing["guest_id"] = guest_id
        save_users(users)
        print(f"Updated {role} password for: {email_clean} (Property ID: {property_id})")
    else:
        next_id = max([x["id"] for x in users], default=0) + 1
        users.append({
            "id": next_id,
            "email": email_clean,
            "password_hash": hash_password(password),
            "role": role,
            "property_id": property_id,
            "guest_id": guest_id,
        })
        save_users(users)
        print(f"Created {role}: {email_clean} (Property ID: {property_id})")

def main():
    # 1. Owner
    owner_email = os.getenv("OWNER_EMAIL", "owner@example.com")
    owner_pwd = os.getenv("OWNER_PASSWORD", "OwnerPass123")
    upsert_user(owner_email, owner_pwd, "owner")

    # 2. Property 1: Coorg (ID: 1)
    p1_mgr_email = os.getenv("MANAGER_COORG_EMAIL", "manager_coorg@example.com")
    p1_mgr_pwd = os.getenv("MANAGER_COORG_PASSWORD", os.getenv("MANAGER_PASSWORD", "ManagerPass123"))
    upsert_user(p1_mgr_email, p1_mgr_pwd, "manager", property_id=1)

    p1_staff_email = os.getenv("STAFF_COORG_EMAIL", "reception_coorg@example.com")
    p1_staff_pwd = os.getenv("STAFF_COORG_PASSWORD", os.getenv("STAFF_PASSWORD", "ReceptionPass123"))
    upsert_user(p1_staff_email, p1_staff_pwd, "staff", property_id=1)
    upsert_user("reception@example.com", p1_staff_pwd, "staff", property_id=1)

    # 3. Property 2: Ooty (ID: 2)
    p2_mgr_email = os.getenv("MANAGER_OOTY_EMAIL", "manager_ooty@example.com")
    p2_mgr_pwd = os.getenv("MANAGER_OOTY_PASSWORD", os.getenv("MANAGER_PASSWORD", "ManagerPass123"))
    upsert_user(p2_mgr_email, p2_mgr_pwd, "manager", property_id=2)
    upsert_user("manager@example.com", p2_mgr_pwd, "manager", property_id=2)

    p2_staff_email = os.getenv("STAFF_OOTY_EMAIL", "reception_ooty@example.com")
    p2_staff_pwd = os.getenv("STAFF_OOTY_PASSWORD", os.getenv("STAFF_PASSWORD", "ReceptionPass123"))
    upsert_user(p2_staff_email, p2_staff_pwd, "staff", property_id=2)

    # 4. Property 3: Alleppey (ID: 3)
    p3_mgr_email = os.getenv("MANAGER_ALLEPPEY_EMAIL", "manager_alleppey@example.com")
    p3_mgr_pwd = os.getenv("MANAGER_ALLEPPEY_PASSWORD", os.getenv("MANAGER_PASSWORD", "ManagerPass123"))
    upsert_user(p3_mgr_email, p3_mgr_pwd, "manager", property_id=3)

    p3_staff_email = os.getenv("STAFF_ALLEPPEY_EMAIL", "reception_alleppey@example.com")
    p3_staff_pwd = os.getenv("STAFF_ALLEPPEY_PASSWORD", os.getenv("STAFF_PASSWORD", "ReceptionPass123"))
    upsert_user(p3_staff_email, p3_staff_pwd, "staff", property_id=3)

if __name__ == "__main__":
    main()