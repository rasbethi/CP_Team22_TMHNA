from io import StringIO
from pathlib import Path
from typing import Dict, List

import pandas as pd
from thefuzz import fuzz

from models.vendor_model import VendorRecord
from utils.harmonization_helpers import normalize_text, normalize_phone, normalize_address
from services.mapping_governance_service import load_vendor_rules, get_vendor_overrides, get_vendor_manual_merges

BASE_PATH = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_PATH / "data"


def load_raw_vendor_data() -> Dict[str, List[Dict]]:
    """
    Load raw vendor data from CSV files.
    Supports both new format (vendor_id, address, city, state, country) and old format (Vendor_Name, Address, Phone).
    """
    def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [col.strip().replace(" ", "_") for col in df.columns]
        return df
    
    def normalize_vendor_format(records: List[Dict]) -> List[Dict]:
        """Normalize vendor data to standard internal structure."""
        normalized = []
        for row in records:
            # Handle new format (vendor_id, vendor_name, address, city, state, country, phone)
            if "vendor_name" in row and "vendor_id" in row:
                # Build full address from components
                address_parts = [
                    str(row.get("address", "")),
                    str(row.get("city", "")),
                    str(row.get("state", "")),
                    str(row.get("country", ""))
                ]
                full_address = ", ".join([p for p in address_parts if p.strip()])
                
                normalized.append({
                    "Vendor_Name": str(row.get("vendor_name", "")),
                    "Address": full_address,
                    "Phone": str(row.get("phone", "")),  # Include phone from CSV
                })
            # Handle old format (Vendor_Name, Address, Phone)
            else:
                normalized.append({
                    "Vendor_Name": str(row.get("Vendor_Name", "")),
                    "Address": str(row.get("Address", "")),
                    "Phone": str(row.get("Phone", "")),
                })
        return normalized
    
    # Try new format first, fall back to old format
    tmh = None
    raymond = None
    
    if (DATA_PATH / "tmh_vendors.csv").exists():
        tmh = normalize_columns(pd.read_csv(DATA_PATH / "tmh_vendors.csv"))
    elif (DATA_PATH / "TMH_Vendors.csv").exists():
        tmh = normalize_columns(pd.read_csv(DATA_PATH / "TMH_Vendors.csv"))
    
    if (DATA_PATH / "raymond_vendors.csv").exists():
        raymond = normalize_columns(pd.read_csv(DATA_PATH / "raymond_vendors.csv"))
    elif (DATA_PATH / "Raymond_Vendors.csv").exists():
        raymond = normalize_columns(pd.read_csv(DATA_PATH / "Raymond_Vendors.csv"))
    
    if tmh is None or raymond is None:
        return {
            "tmh": [],
            "raymond": [],
        }
    
    # Normalize to standard format
    tmh_records = normalize_vendor_format(tmh.to_dict(orient="records"))
    raymond_records = normalize_vendor_format(raymond.to_dict(orient="records"))
    
    return {
        "tmh": tmh_records,
        "raymond": raymond_records,
    }


def harmonize_vendors() -> List[Dict]:
    raw = load_raw_vendor_data()
    
    # Load vendor rules from governance service
    rules = load_vendor_rules()
    confidence_threshold = rules.get("confidence_threshold", 85)
    name_weight = rules.get("name_weight", 0.7)
    address_weight = rules.get("address_weight", 0.3)
    overrides = get_vendor_overrides()
    
    unified: List[VendorRecord] = []
    next_id = 1

    def find_match(candidate: Dict) -> Dict:
        # Check manual overrides first
        for override_key, override in overrides.items():
            if override.get("tmh_name") == candidate.get("Vendor_Name") or override.get("raymond_name") == candidate.get("Vendor_Name"):
                # Check if we already have this unified vendor
                for record in unified:
                    if record.vendor_name == override.get("unified_name"):
                        return {"record": record, "score": 100}
        
        best = None
        best_score = 0
        for record in unified:
            score = fuzz.token_set_ratio(record.normalized_name, candidate["normalized_name"])
            address_score = fuzz.token_set_ratio(
                normalize_address(record.address), normalize_address(candidate["Address"])
            )
            combined = int((score * name_weight) + (address_score * address_weight))
            if combined > best_score:
                best_score = combined
                best = record
        return {"record": best, "score": best_score}

    def add_record(row: Dict, source: str):
        nonlocal next_id
        normalized_name = normalize_text(row.get("Vendor_Name", ""))
        candidate = {
            "Vendor_Name": row.get("Vendor_Name", ""),
            "Address": row.get("Address", ""),
            "Phone": normalize_phone(row.get("Phone", "")),
            "normalized_name": normalized_name,
        }
        match = find_match(candidate)
        if match["record"] and match["score"] >= confidence_threshold:
            match["record"].source_brands = f"{match['record'].source_brands}, {source}"
            match["record"].match_confidence = match["score"]
        else:
            unified.append(
                VendorRecord(
                    unified_vendor_id=f"V{next_id:04d}",
                    vendor_name=candidate["Vendor_Name"],
                    normalized_name=candidate["normalized_name"],
                    address=candidate["Address"],
                    phone=candidate["Phone"],
                    source_brands=source,
                    match_confidence=match["score"] if match["record"] else 100,
                )
            )
            next_id += 1

    for tmh_row in raw["tmh"]:
        add_record(tmh_row, "TMH")

    for raymond_row in raw["raymond"]:
        add_record(raymond_row, "Raymond")

    # Apply manual merges
    manual_merges = get_vendor_manual_merges()
    merged_vendor_ids = set()
    
    for merge_key, merge_info in manual_merges.items():
        vendor_ids_to_merge = merge_info.get("vendor_ids", [])
        if len(vendor_ids_to_merge) < 2:
            continue
        
        # Find records to merge
        records_to_merge = [r for r in unified if r.unified_vendor_id in vendor_ids_to_merge]
        if len(records_to_merge) < 2:
            continue
        
        # Create merged record
        all_source_brands = set()
        for r in records_to_merge:
            all_source_brands.update(r.source_brands.split(", "))
        
        merged_record = VendorRecord(
            unified_vendor_id=vendor_ids_to_merge[0],  # Use first ID as the merged ID
            vendor_name=merge_info.get("unified_name", records_to_merge[0].vendor_name),
            normalized_name=normalize_text(merge_info.get("unified_name", records_to_merge[0].vendor_name)),
            address=merge_info.get("unified_address", records_to_merge[0].address),
            phone=merge_info.get("unified_phone", records_to_merge[0].phone),
            source_brands=", ".join(sorted(all_source_brands)),
            match_confidence=100
        )
        
        # Remove merged records and add the merged one
        unified = [r for r in unified if r.unified_vendor_id not in vendor_ids_to_merge]
        unified.append(merged_record)
        merged_vendor_ids.update(vendor_ids_to_merge[1:])  # Track which IDs were merged

    # Auto-merge vendors with same normalized name OR same address+phone
    # This automatically merges vendors like "SteelWorks Inc" and "Steel Works Incorporated"
    processed_ids = set()
    auto_merged_vendor_ids = set()
    
    for i, record1 in enumerate(unified):
        if record1.unified_vendor_id in processed_ids or record1.unified_vendor_id in auto_merged_vendor_ids:
            continue
        
        # Normalize for comparison
        normalized_name1 = record1.normalized_name
        normalized_phone1 = normalize_phone(record1.phone)
        normalized_address1 = normalize_address(record1.address)
        # Handle address normalization (remove common abbreviations)
        normalized_address1_clean = normalized_address1.replace("street", "").replace("st", "").replace("avenue", "").replace("ave", "").replace("road", "").replace("rd", "").replace("boulevard", "").replace("blvd", "")
        
        vendors_to_merge = [record1]
        
        for j, record2 in enumerate(unified[i+1:], start=i+1):
            if record2.unified_vendor_id in processed_ids or record2.unified_vendor_id in auto_merged_vendor_ids:
                continue
            
            normalized_name2 = record2.normalized_name
            normalized_phone2 = normalize_phone(record2.phone)
            normalized_address2 = normalize_address(record2.address)
            normalized_address2_clean = normalized_address2.replace("street", "").replace("st", "").replace("avenue", "").replace("ave", "").replace("road", "").replace("rd", "").replace("boulevard", "").replace("blvd", "")
            
            # Check if should merge: same normalized name OR same address+phone
            name_match = normalized_name1 == normalized_name2 and len(normalized_name1) > 0
            address_phone_match = (normalized_address1_clean == normalized_address2_clean and 
                                  normalized_phone1 == normalized_phone2 and 
                                  len(normalized_address1_clean) > 0 and len(normalized_phone1) > 0)
            
            if name_match or address_phone_match:
                vendors_to_merge.append(record2)
                processed_ids.add(record2.unified_vendor_id)
        
        # If we found vendors to merge, create merged record
        if len(vendors_to_merge) > 1:
            all_source_brands = set()
            for r in vendors_to_merge:
                all_source_brands.update(r.source_brands.split(", "))
            
            # Use the first vendor's name and data as the merged record
            merged_record = VendorRecord(
                unified_vendor_id=vendors_to_merge[0].unified_vendor_id,
                vendor_name=vendors_to_merge[0].vendor_name,
                normalized_name=vendors_to_merge[0].normalized_name,
                address=vendors_to_merge[0].address,
                phone=vendors_to_merge[0].phone,
                source_brands=", ".join(sorted(all_source_brands)),
                match_confidence=100
            )
            
            # Remove merged records
            merge_ids = [r.unified_vendor_id for r in vendors_to_merge]
            unified = [r for r in unified if r.unified_vendor_id not in merge_ids]
            unified.append(merged_record)
            
            # Track merged IDs (except the first one which becomes the merged ID)
            auto_merged_vendor_ids.update(merge_ids[1:])
        
        processed_ids.add(record1.unified_vendor_id)

    # Convert to required format
    result = []
    for record in unified:
        # Skip records that were merged into others (from manual merges or auto-merge)
        if record.unified_vendor_id in merged_vendor_ids or record.unified_vendor_id in auto_merged_vendor_ids:
            continue
            
        has_tmh = "TMH" in record.source_brands
        has_raymond = "Raymond" in record.source_brands
        
        result.append({
            "unified_vendor_id": record.unified_vendor_id,
            "unified_name": record.vendor_name,
            "tmh_source_name": record.vendor_name if has_tmh else "",
            "raymond_source_name": record.vendor_name if has_raymond else "",
            "unified_address": record.address,
            "unified_phone": record.phone,
            "confidence": record.match_confidence or 100,
            "source_brands": record.source_brands
        })
    
    return result


def harmonized_vendors_csv() -> str:
    rows = harmonize_vendors()
    df = pd.DataFrame(rows)
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return buffer.read()


def raw_vendors_csv(brand: str = None) -> str:
    """Export raw vendor data as CSV. If brand is specified, export only that brand."""
    raw_data = load_raw_vendor_data()
    
    # Determine which vendors to export
    if brand and brand.lower() == "tmh":
        vendors = [(v.copy(), "TMH") for v in raw_data.get("tmh", [])]
    elif brand and brand.lower() == "raymond":
        vendors = [(v.copy(), "Raymond") for v in raw_data.get("raymond", [])]
    else:
        # Default: combine all vendors
        vendors = []
        for vendor in raw_data.get("tmh", []):
            vendors.append((vendor.copy(), "TMH"))
        for vendor in raw_data.get("raymond", []):
            vendors.append((vendor.copy(), "Raymond"))
    
    # Add source brand column
    all_vendors = []
    for vendor, source_brand in vendors:
        vendor["Source_Brand"] = source_brand
        all_vendors.append(vendor)
    
    df = pd.DataFrame(all_vendors)
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return buffer.read()

