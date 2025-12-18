from dataclasses import dataclass
from typing import Optional


@dataclass
class VendorRecord:
    unified_vendor_id: str
    vendor_name: str
    normalized_name: str
    address: str
    phone: str
    source_brands: str
    match_confidence: Optional[int] = None

