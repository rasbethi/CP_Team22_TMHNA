"""
Mapping Governance Service - Corporate-only (Maya) access to financial mappings.
"""
import csv
from pathlib import Path
from typing import Dict, List
from datetime import datetime

BASE_PATH = Path(__file__).resolve().parent.parent
FINANCIAL_DATA_PATH = BASE_PATH / "data" / "financial"
VENDOR_RULES_PATH = BASE_PATH / "data" / "vendor_rules.json"


# Financial Mappings (CSV-based)
def load_financial_account_mappings() -> List[Dict]:
    """Load unified account mappings."""
    path = FINANCIAL_DATA_PATH / "unified_account_mapping.csv"
    if not path.exists():
        return []
    
    mappings = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            mappings.append(dict(row))
    
    return mappings


def save_financial_account_mappings(mappings: List[Dict], user: str):
    """Save unified account mappings and automatically trigger re-harmonization."""
    path = FINANCIAL_DATA_PATH / "unified_account_mapping.csv"
    
    with open(path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["source_account_name", "unified_account_name", "unified_account_number"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(mappings)
    
    print(f"[MAPPING] Account mappings updated by {user} at {datetime.now().isoformat()}")
    
    # Automatically recompute preview submissions for all affected brands
    try:
        from services.financial_service import recompute_preview_submissions_for_all_brands
        recompute_preview_submissions_for_all_brands()
        print(f"[MAPPING] Preview submissions automatically recomputed after account mapping update")
    except Exception as e:
        print(f"[MAPPING] ERROR: Failed to recompute preview submissions: {e}")


def load_financial_cost_center_mappings() -> List[Dict]:
    """Load unified cost center mappings."""
    path = FINANCIAL_DATA_PATH / "unified_cost_center_mapping.csv"
    if not path.exists():
        return []
    
    mappings = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        # Check if headers are correct
        expected_headers = ["source_cost_center", "unified_cost_center", "unified_cost_center_name"]
        if reader.fieldnames != expected_headers:
            # File might be missing header - skip first row and use expected headers
            f.seek(0)
            first_line = f.readline().strip()
            # If first line doesn't look like a header, it's data
            if first_line and not first_line.startswith('source_cost_center'):
                # Rewind and read with expected headers
                f.seek(0)
                # Skip first line (it's data, not header)
                f.readline()
                reader = csv.DictReader(f, fieldnames=expected_headers)
        
        for row in reader:
            # Only add if it has the expected keys
            if all(key in row for key in expected_headers):
                mappings.append({
                    "source_cost_center": row.get("source_cost_center", "").strip(),
                    "unified_cost_center": row.get("unified_cost_center", "").strip(),
                    "unified_cost_center_name": row.get("unified_cost_center_name", "").strip()
                })
    
    return mappings


def save_financial_cost_center_mappings(mappings: List[Dict], user: str):
    """Save unified cost center mappings and automatically trigger re-harmonization."""
    path = FINANCIAL_DATA_PATH / "unified_cost_center_mapping.csv"
    
    # Ensure directory exists
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["source_cost_center", "unified_cost_center", "unified_cost_center_name"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()  # Always write header
        writer.writerows(mappings)
    
    print(f"[MAPPING] Cost center mappings updated by {user} at {datetime.now().isoformat()} - saved {len(mappings)} mappings")
    
    # Automatically recompute preview submissions for all affected brands
    try:
        from services.financial_service import recompute_preview_submissions_for_all_brands
        recompute_preview_submissions_for_all_brands()
        print(f"[MAPPING] Preview submissions automatically recomputed after cost center mapping update")
    except Exception as e:
        print(f"[MAPPING] ERROR: Failed to recompute preview submissions: {e}")


# Vendor Rules (JSON-based, unchanged)
def load_vendor_rules() -> Dict:
    """Load vendor matching rules from JSON file."""
    import json
    if not VENDOR_RULES_PATH.exists():
        return {
            "confidence_threshold": 85,
            "name_weight": 0.7,
            "address_weight": 0.3,
            "normalization_rules": {
                "lowercase": True,
                "remove_punctuation": True,
                "collapse_spaces": True
            },
            "manual_overrides": {},
            "last_updated": datetime.now().isoformat(),
            "updated_by": "system"
        }
    try:
        with open(VENDOR_RULES_PATH, 'r') as f:
            return json.load(f)
    except:
        return {}


def save_vendor_rules(rules: Dict, user: str):
    """Save vendor matching rules to JSON file."""
    import json
    rules["last_updated"] = datetime.now().isoformat()
    rules["updated_by"] = user
    VENDOR_RULES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(VENDOR_RULES_PATH, 'w') as f:
        json.dump(rules, f, indent=2)


def add_vendor_override(unified_name: str, tmh_name: str, raymond_name: str, user: str):
    """Add a manual vendor match override."""
    rules = load_vendor_rules()
    if "manual_overrides" not in rules:
        rules["manual_overrides"] = {}
    
    override_key = f"{tmh_name}||{raymond_name}"
    rules["manual_overrides"][override_key] = {
        "unified_name": unified_name,
        "tmh_name": tmh_name,
        "raymond_name": raymond_name,
        "created_by": user,
        "created_at": datetime.now().isoformat()
    }
    
    save_vendor_rules(rules, user)


def get_vendor_overrides() -> Dict:
    """Get all vendor match overrides."""
    rules = load_vendor_rules()
    return rules.get("manual_overrides", {})


def add_vendor_manual_merge(vendor_ids: List[str], unified_name: str, unified_address: str, unified_phone: str, user: str) -> Dict:
    """
    Add a manual vendor merge - unifies multiple vendor records into one.
    
    Args:
        vendor_ids: List of unified_vendor_id strings to merge (e.g., ["V0001", "V0002"])
        unified_name: The unified vendor name to use
        unified_address: The unified address to use
        unified_phone: The unified phone to use
        user: User performing the merge
    """
    import json
    rules = load_vendor_rules()
    
    if "manual_merges" not in rules:
        rules["manual_merges"] = {}
    
    # Create a merge key from sorted vendor IDs
    merge_key = "||".join(sorted(vendor_ids))
    
    rules["manual_merges"][merge_key] = {
        "vendor_ids": sorted(vendor_ids),
        "unified_name": unified_name,
        "unified_address": unified_address,
        "unified_phone": unified_phone,
        "merged_by": user,
        "merged_at": datetime.now().isoformat(),
        "confidence": 100
    }
    
    save_vendor_rules(rules, user)
    print(f"[VENDOR] Manual merge created by {user}: {len(vendor_ids)} vendors merged")
    
    return {"ok": True, "merge_key": merge_key}


def get_vendor_manual_merges() -> Dict:
    """Get all manual vendor merges."""
    rules = load_vendor_rules()
    return rules.get("manual_merges", {})
