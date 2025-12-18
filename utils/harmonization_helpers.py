import re
from typing import Dict


def normalize_text(value: str) -> str:
    """
    Normalize text for comparison:
    - lowercase
    - strip whitespace
    - remove punctuation
    - collapse internal spaces
    """
    if not isinstance(value, str):
        return ""
    lowered = value.lower().strip()
    cleaned = re.sub(r"[^a-z0-9\s]", " ", lowered)
    collapsed = re.sub(r"\s+", " ", cleaned)
    return collapsed.strip()


def normalize_account_name(name: str) -> str:
    return normalize_text(name)


def normalize_phone(phone: str) -> str:
    if not isinstance(phone, str):
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"({digits[0:3]}) {digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return digits


def normalize_address(address: str) -> str:
    return normalize_text(address)


def build_lookup(items: Dict[str, str]) -> Dict[str, str]:
    """
    Build a reverse lookup using normalized keys.
    """
    return {normalize_text(k): v for k, v in items.items()}

