from datetime import date, datetime, timezone
from decimal import Decimal
def nights(check_in: date, check_out: date) -> int:
    return (check_out - check_in).days
def money(value: Decimal) -> str:
    return f"{Decimal(value):.2f}"
def utcnow():
    return datetime.now(timezone.utc)