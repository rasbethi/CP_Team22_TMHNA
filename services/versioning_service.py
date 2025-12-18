from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import json

BASE_PATH = Path(__file__).resolve().parent.parent
VERSIONED_SUBMISSIONS_PATH = BASE_PATH / "data" / "versioned_submissions.json"


def load_versioned_submissions() -> Dict[str, List[Dict]]:
    """Load versioned submissions from JSON file."""
    if not VERSIONED_SUBMISSIONS_PATH.exists():
        return {}
    try:
        with open(VERSIONED_SUBMISSIONS_PATH, 'r') as f:
            return json.load(f)
    except:
        return {}


def save_versioned_submissions(submissions: Dict[str, List[Dict]]):
    """Save versioned submissions to JSON file."""
    VERSIONED_SUBMISSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(VERSIONED_SUBMISSIONS_PATH, 'w') as f:
        json.dump(submissions, f, indent=2)


def create_submission_version(brand: str, submission_data: Dict, state: str, user: str) -> Dict:
    """Create a new version of a submission."""
    versions = load_versioned_submissions()
    brand_key = brand.lower()
    
    if brand_key not in versions:
        versions[brand_key] = []
    
    # Get next version number
    existing_versions = versions[brand_key]
    next_version = len(existing_versions) + 1
    
    # Create submission ID if first version
    if next_version == 1:
        submission_id = f"{brand_key}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    else:
        # Use same submission_id as previous version
        submission_id = existing_versions[-1]["submission_id"]
    
    version_entry = {
        "submission_id": submission_id,
        "version_number": next_version,
        "brand": brand,
        "state": state,
        "timestamp": datetime.now().isoformat(),
        "created_by": user,
        "record_count": submission_data.get("record_count", 0),
        "anomaly_count": submission_data.get("anomaly_count", 0),
        "anomalies": submission_data.get("anomalies", []),
        "summary_metrics": {
            "total_records": submission_data.get("record_count", 0),
            "unmapped_accounts": len([a for a in submission_data.get("anomalies", []) if a.get("type") == "unmapped_account"]),
            "unmapped_cost_centers": len([a for a in submission_data.get("anomalies", []) if a.get("type") == "unmapped_cost_center"]),
        }
    }
    
    versions[brand_key].append(version_entry)
    save_versioned_submissions(versions)
    
    return version_entry


def get_submission_versions(brand: str) -> List[Dict]:
    """Get all versions for a brand submission."""
    versions = load_versioned_submissions()
    brand_key = brand.lower()
    return versions.get(brand_key, [])


def get_latest_version(brand: str) -> Optional[Dict]:
    """Get the latest version for a brand."""
    all_versions = get_submission_versions(brand)
    if all_versions:
        return all_versions[-1]
    return None


def compare_versions(brand: str, version1: int, version2: int) -> Dict:
    """Compare two versions of a submission."""
    all_versions = get_submission_versions(brand)
    
    v1 = next((v for v in all_versions if v["version_number"] == version1), None)
    v2 = next((v for v in all_versions if v["version_number"] == version2), None)
    
    if not v1 or not v2:
        return {"error": "One or both versions not found"}
    
    return {
        "version1": v1,
        "version2": v2,
        "differences": {
            "record_count_change": v2["record_count"] - v1["record_count"],
            "anomaly_count_change": v2["anomaly_count"] - v1["anomaly_count"],
            "state_change": v1["state"] != v2["state"],
            "new_anomalies": len(v2["anomalies"]) - len(v1["anomalies"])
        }
    }


def get_all_submission_versions() -> Dict[str, List[Dict]]:
    """Get all versioned submissions (for enterprise view)."""
    return load_versioned_submissions()

