"""
Financial Integration Service - CSV-driven, minimal workflow.
"""
import csv
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import uuid

BASE_PATH = Path(__file__).resolve().parent.parent
FINANCIAL_DATA_PATH = BASE_PATH / "data" / "financial"


def load_raw_accounts(brand: Optional[str] = None) -> List[Dict]:
    """Load raw account data from CSV."""
    path = FINANCIAL_DATA_PATH / "financial_raw_accounts.csv"
    if not path.exists():
        return []
    
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if brand and row.get("brand", "").upper() != brand.upper():
                continue
            rows.append(dict(row))
    
    return rows


def load_unified_account_mapping() -> Dict[str, Dict]:
    """Load unified account mappings."""
    mappings = {}
    path = FINANCIAL_DATA_PATH / "unified_account_mapping.csv"
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                source_name = row.get("source_account_name", "").strip()
                mappings[source_name] = {
                    "unified_account_name": row.get("unified_account_name", "").strip(),
                    "unified_account_number": row.get("unified_account_number", "").strip()
                }
    return mappings


def load_unified_cost_center_mapping() -> Dict[str, Dict]:
    """Load unified cost center mappings."""
    mappings = {}
    path = FINANCIAL_DATA_PATH / "unified_cost_center_mapping.csv"
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                source_cc = row.get("source_cost_center", "").strip()
                mappings[source_cc] = {
                    "unified_cost_center": row.get("unified_cost_center", "").strip(),
                    "unified_cost_center_name": row.get("unified_cost_center_name", "").strip()
                }
    return mappings


def check_data_quality(brand: Optional[str] = None) -> List[Dict]:
    """Check data quality issues - visible to Maya, read-only, indicates Mapping Governance fix."""
    raw_accounts = load_raw_accounts(brand)
    account_mapping = load_unified_account_mapping()
    cost_center_mapping = load_unified_cost_center_mapping()
    
    issues = []
    
    for row in raw_accounts:
        source_account_name = row.get("source_account_name", "").strip()
        source_cost_center = row.get("source_cost_center", "").strip()
        source_account_number = row.get("source_account_number", "").strip()
        
        # Check for unmapped account
        if source_account_name not in account_mapping:
            issues.append({
                "type": "UNMAPPED_ACCOUNT",
                "message": f"Account '{source_account_name} ({source_account_number})' could not be mapped. Resolve this in Mapping Governance.",
                "source_account_name": source_account_name,
                "source_account_number": source_account_number,
                "brand": row.get("brand", brand.upper() if brand else "")
            })
        
        # Check for unmapped cost center
        if source_cost_center and source_cost_center not in cost_center_mapping:
            issues.append({
                "type": "UNMAPPED_COST_CENTER",
                "message": f"Cost center '{source_cost_center}' could not be mapped. Resolve this in Mapping Governance.",
                "source_account_name": source_account_name,
                "source_account_number": source_account_number,
                "source_cost_center": source_cost_center,
                "brand": row.get("brand", brand.upper() if brand else "")
            })
    
    return issues


def _compute_preview_submission(brand: str) -> List[Dict]:
    """
    Internal function to compute preview submission from raw data using current mappings.
    This performs the harmonization logic.
    """
    raw_accounts = load_raw_accounts(brand)
    account_mapping = load_unified_account_mapping()
    cost_center_mapping = load_unified_cost_center_mapping()
    
    preview = []
    
    for row in raw_accounts:
        source_account_name = row.get("source_account_name", "").strip()
        source_cost_center = row.get("source_cost_center", "").strip()
        
        # Check if both account and cost center are mapped
        if source_account_name in account_mapping and source_cost_center in cost_center_mapping:
            account_map = account_mapping[source_account_name]
            cc_map = cost_center_mapping[source_cost_center]
            
            preview.append({
                "brand": brand.upper(),
                "source_account": row.get("source_account_number", "").strip(),
                "source_account_name": source_account_name,
                "unified_account": account_map["unified_account_number"],
                "unified_account_name": account_map["unified_account_name"],
                "unified_cost_center": cc_map["unified_cost_center"],
                "unified_cost_center_name": cc_map["unified_cost_center_name"],
                "amount": row.get("amount", "").strip()
            })
    
    return preview


def save_preview_submission(brand: str, preview_data: List[Dict]) -> None:
    """Save preview submission data for a brand to CSV (replaces existing data)."""
    preview_path = FINANCIAL_DATA_PATH / f"preview_submission_{brand.lower()}.csv"
    
    # Ensure directory exists
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(preview_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["brand", "source_account", "source_account_name", "unified_account", 
                     "unified_account_name", "unified_cost_center", "unified_cost_center_name", "amount"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(preview_data)
    
    print(f"[FINANCIAL] Preview submission saved for {brand.upper()} - {len(preview_data)} records")


def load_preview_submission(brand: str) -> List[Dict]:
    """Load preview submission data for a brand from CSV."""
    preview_path = FINANCIAL_DATA_PATH / f"preview_submission_{brand.lower()}.csv"
    
    if not preview_path.exists():
        return []
    
    preview = []
    with open(preview_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            preview.append(dict(row))
    
    return preview


def recompute_and_save_preview_submission(brand: str) -> None:
    """
    Recompute preview submission for a brand using latest mappings and save it.
    This replaces any existing preview data.
    """
    preview = _compute_preview_submission(brand)
    save_preview_submission(brand, preview)
    print(f"[FINANCIAL] Preview submission recomputed and saved for {brand.upper()}")


def recompute_preview_submissions_for_all_brands() -> None:
    """
    Recompute and save preview submissions for all brands when mappings change.
    This ensures preview data always reflects current mappings.
    This replaces existing preview data (does not append).
    """
    # Get all unique brands from raw data
    raw_accounts = load_raw_accounts(None)
    brands = set()
    for row in raw_accounts:
        brand = row.get("brand", "").strip().upper()
        if brand:
            brands.add(brand)
    
    if not brands:
        print(f"[FINANCIAL] No brands found in raw data - skipping preview recomputation")
        return
    
    # Recompute preview for each brand (replaces existing preview data)
    for brand in brands:
        brand_lower = brand.lower()
        recompute_and_save_preview_submission(brand_lower)
    
    print(f"[FINANCIAL] Preview submissions recomputed for all brands: {', '.join(sorted(brands))}")


def get_preview_submission(brand: str) -> List[Dict]:
    """
    Get preview submission - loads from stored preview data.
    If stored data doesn't exist, computes it on-the-fly and saves it.
    Always returns the most up-to-date preview based on current mappings.
    """
    # Always compute fresh from current mappings to ensure preview is up-to-date
    # This ensures that even if stored data exists, we return current state
    preview = _compute_preview_submission(brand)
    
    # Save the computed preview (replaces any existing stored data)
    # This ensures stored preview always matches current mappings
    save_preview_submission(brand, preview)
    
    return preview


def submit_to_corporate(brand: str) -> Dict:
    """
    Submit brand data to corporate - create submission record and snapshot.
    Submission eligibility is determined by CURRENT recomputed variances (not stored).
    Blocks submission if there are unmapped accounts or cost centers.
    """
    # Recompute variances dynamically to check eligibility
    variances = calculate_variances(brand)
    
    # Check for blocking variances (unmapped accounts or cost centers)
    blocking_variances = [
        v for v in variances 
        if v.get("variance_type") in ["UNMAPPED_ACCOUNT", "UNMAPPED_COST_CENTER"]
    ]
    
    if blocking_variances:
        blocking_count = len(blocking_variances)
        return {
            "ok": False, 
            "error": f"Cannot submit: {blocking_count} unmapped account(s) or cost center(s) must be resolved first. Please update mappings in Mapping Governance."
        }
    
    # Get preview submission (only fully mapped rows)
    preview = get_preview_submission(brand)
    
    if not preview:
        return {"ok": False, "error": "No data to submit"}
    
    # Generate submission ID
    submission_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    # Write to financial_submissions.csv
    submissions_path = FINANCIAL_DATA_PATH / "financial_submissions.csv"
    submissions = []
    
    if submissions_path.exists():
        with open(submissions_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            submissions = [dict(row) for row in reader]
    
    submissions.append({
        "submission_id": submission_id,
        "brand": brand.upper(),
        "status": "SUBMITTED",
        "timestamp": timestamp
    })
    
    with open(submissions_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["submission_id", "brand", "status", "timestamp"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(submissions)
    
    # Write to financial_submission_rows.csv
    rows_path = FINANCIAL_DATA_PATH / "financial_submission_rows.csv"
    submission_rows = []
    
    if rows_path.exists():
        with open(rows_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            submission_rows = [dict(row) for row in reader]
    
    for row in preview:
        submission_rows.append({
            "submission_id": submission_id,
            "brand": brand.upper(),
            "source_account": row.get("source_account", ""),
            "unified_account": row.get("unified_account", ""),
            "unified_cost_center": row.get("unified_cost_center", ""),
            "amount": row.get("amount", "")
        })
    
    with open(rows_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["submission_id", "brand", "source_account", "unified_account", "unified_cost_center", "amount"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(submission_rows)
    
    return {"ok": True, "submission_id": submission_id, "record_count": len(preview)}


def load_submissions(brand: Optional[str] = None) -> List[Dict]:
    """Load submissions."""
    path = FINANCIAL_DATA_PATH / "financial_submissions.csv"
    if not path.exists():
        return []
    
    submissions = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if brand and row.get("brand", "").upper() != brand.upper():
                continue
            submissions.append(dict(row))
    
    return submissions


def load_submission_rows(submission_id: str) -> List[Dict]:
    """Load rows for a specific submission."""
    path = FINANCIAL_DATA_PATH / "financial_submission_rows.csv"
    if not path.exists():
        return []
    
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("submission_id") == submission_id:
                rows.append(dict(row))
    
    return rows


def get_brand_approved_view(brand: str) -> List[Dict]:
    """Get brand-level approved view - reads from brand_approved_financials.csv filtered by brand."""
    path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
    if not path.exists():
        return []
    
    rows = []
    brand_upper = brand.upper()
    
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("brand", "").upper() == brand_upper:
                # Return format compatible with frontend expectations
                rows.append({
                    "source_account": "",  # Not stored in approved data
                    "unified_account": row.get("unified_account", ""),
                    "unified_cost_center": row.get("unified_cost_center", ""),
                    "amount": row.get("amount", "")
                })
    
    return rows


def get_corporate_unified_view() -> List[Dict]:
    """Get corporate unified view - aggregates from brand_approved_financials.csv by unified_account + unified_cost_center, SUM amounts."""
    path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
    if not path.exists():
        return []
    
    # Load all approved rows
    rows = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = [dict(row) for row in reader]
    
    # Aggregate by unified_account + unified_cost_center, SUM amounts
    aggregated = {}
    
    for row in rows:
        unified_account = row.get("unified_account", "").strip()
        unified_cost_center = row.get("unified_cost_center", "").strip()
        brand = row.get("brand", "").upper()
        amount_str = row.get("amount", "").strip()
        
        try:
            amount = float(amount_str) if amount_str else 0.0
        except:
            amount = 0.0
        
        # Create composite key
        key = (unified_account, unified_cost_center)
        
        if key not in aggregated:
            aggregated[key] = {
                "unified_account": unified_account,
                "unified_cost_center": unified_cost_center,
                "amount": 0.0,
                "brands": set()
            }
        
        aggregated[key]["amount"] += amount
        aggregated[key]["brands"].add(brand)
    
    # Convert to list format (brand NOT a row dimension)
    result = []
    for key, agg in aggregated.items():
        result.append({
            "unified_account": agg["unified_account"],
            "unified_cost_center": agg["unified_cost_center"],
            "amount": str(agg["amount"]),
            "contributing_brands": sorted(list(agg["brands"]))  # Metadata only
        })
    
    # Sort by unified_account, then unified_cost_center
    result.sort(key=lambda x: (x["unified_account"], x["unified_cost_center"]))
    
    return result


def calculate_variances(brand: Optional[str] = None) -> List[Dict]:
    """
    Calculate variances from RAW data + CURRENT mappings.
    Computed dynamically, not dependent on approvals or submissions.
    
    Variance types:
    - UNMAPPED_ACCOUNT: Account name has no unified mapping
    - UNMAPPED_COST_CENTER: Cost center has no unified mapping
    """
    # Load raw data and current mappings
    raw_accounts = load_raw_accounts(brand)
    account_mapping = load_unified_account_mapping()
    cost_center_mapping = load_unified_cost_center_mapping()
    
    variances = []
    
    # A) UNMAPPED_ACCOUNT and UNMAPPED_COST_CENTER (brand-specific)
    for row in raw_accounts:
        source_account_name = row.get("source_account_name", "").strip()
        source_cost_center = row.get("source_cost_center", "").strip()
        source_account_number = row.get("source_account_number", "").strip()
        row_brand = row.get("brand", "").upper()
        
        # A) UNMAPPED_ACCOUNT
        if source_account_name not in account_mapping:
            variances.append({
                "variance_type": "UNMAPPED_ACCOUNT",
                "brand": row_brand,
                "unified_account": "UNMAPPED",
                "source_account_number": source_account_number,
                "source_account_name": source_account_name,
                "source_cost_center": source_cost_center,
                "message": f"Account '{source_account_name} ({source_account_number})' has no unified mapping"
            })
        
        # B) UNMAPPED_COST_CENTER
        if source_cost_center and source_cost_center not in cost_center_mapping:
            unified_account = account_mapping.get(source_account_name, {}).get("unified_account_number", "UNMAPPED")
            variances.append({
                "variance_type": "UNMAPPED_COST_CENTER",
                "brand": row_brand,
                "unified_account": unified_account,
                "source_account_number": source_account_number,
                "source_account_name": source_account_name,
                "source_cost_center": source_cost_center,
                "message": f"Cost center '{source_cost_center}' has no unified mapping"
                })
    
    return variances


def persist_approved_data(submission_id: str, brand: str) -> None:
    """Persist approved submission rows to brand_approved_financials.csv."""
    # Load submission rows
    submission_rows = load_submission_rows(submission_id)
    if not submission_rows:
        return
    
    # Load existing approved data
    approved_path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
    existing_rows = []
    
    if approved_path.exists():
        with open(approved_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            existing_rows = [dict(row) for row in reader]
    
    # Remove any existing rows for this submission_id (in case re-approving)
    existing_rows = [r for r in existing_rows if r.get("submission_id") != submission_id]
    
    # Add new approved rows with approved_timestamp
    approved_timestamp = datetime.now().isoformat()
    for row in submission_rows:
        existing_rows.append({
            "submission_id": submission_id,
            "brand": brand.upper(),
            "unified_account": row.get("unified_account", ""),
            "unified_cost_center": row.get("unified_cost_center", ""),
            "amount": row.get("amount", ""),
            "approved_timestamp": approved_timestamp
        })
    
    # Write back
    with open(approved_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["submission_id", "brand", "unified_account", "unified_cost_center", "amount", "approved_timestamp"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(existing_rows)


def remove_approved_data(submission_id: str) -> None:
    """Remove approved data for a rejected submission."""
    approved_path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
    if not approved_path.exists():
        return
    
    # Load existing approved data
    existing_rows = []
    with open(approved_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        existing_rows = [dict(row) for row in reader]
    
    # Remove rows for this submission_id
    filtered_rows = [r for r in existing_rows if r.get("submission_id") != submission_id]
    
    # Write back
    with open(approved_path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["submission_id", "brand", "unified_account", "unified_cost_center", "amount", "approved_timestamp"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(filtered_rows)


def update_submission_status(submission_id: str, status: str) -> Dict:
    """Update submission status (APPROVED or REJECTED) and persist/remove approved data."""
    path = FINANCIAL_DATA_PATH / "financial_submissions.csv"
    if not path.exists():
        return {"ok": False, "error": "No submissions found"}
    
    submissions = []
    found = False
    submission_brand = None
    
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("submission_id") == submission_id:
                submission_brand = row.get("brand", "")
                row["status"] = status
                found = True
            submissions.append(dict(row))
    
    if not found:
        return {"ok": False, "error": "Submission not found"}
    
    # Update submissions CSV
    with open(path, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ["submission_id", "brand", "status", "timestamp"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(submissions)
    
    # Persist or remove approved data based on status
    if status == "APPROVED" and submission_brand:
        persist_approved_data(submission_id, submission_brand)
    elif status == "REJECTED":
        remove_approved_data(submission_id)
    
    return {"ok": True}


def reset_financial_integration_state() -> Dict:
    """
    Hard reset Financial Integration - completely delete submission history.
    
    STEP 1: Delete all records from financial_submissions.csv (empty file with header only)
    STEP 2: Delete all records from financial_submission_rows.csv (empty file with header only)
    STEP 3: Clear brand_approved_financials.csv (empty file with header only)
    STEP 4: Regenerate Preview Submission for all brands using current mappings
    STEP 5: Variances are computed dynamically, so they automatically reflect current state
    
    After reset:
    - Submission History = EMPTY
    - Brand-Level Approved View = EMPTY
    - Corporate Unified View = EMPTY
    - Preview Submission = Regenerated from raw data + mappings
    - Submit to Corporate = Enabled if no variances exist
    
    Does NOT modify:
    - Raw financial data
    - Mappings
    - Vendor data
    - UI/layout/roles
    """
    reset_steps = []
    
    # STEP 1: Delete all records from financial_submissions.csv (hard reset)
    submissions_path = FINANCIAL_DATA_PATH / "financial_submissions.csv"
    if submissions_path.exists():
        # Read to count how many we're deleting
        with open(submissions_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = sum(1 for _ in reader)
        
        # Create empty file with header only
        with open(submissions_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "status", "timestamp"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        
        reset_steps.append(f"Deleted {count} submission record(s) from financial_submissions.csv")
    else:
        # Create empty file with header
        with open(submissions_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "status", "timestamp"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        reset_steps.append("Created empty financial_submissions.csv")
    
    # STEP 2: Delete all records from financial_submission_rows.csv (hard reset)
    submission_rows_path = FINANCIAL_DATA_PATH / "financial_submission_rows.csv"
    if submission_rows_path.exists():
        # Read to count how many we're deleting
        with open(submission_rows_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = sum(1 for _ in reader)
        
        # Create empty file with header only
        with open(submission_rows_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "source_account", "unified_account", "unified_cost_center", "amount"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        
        reset_steps.append(f"Deleted {count} submission row(s) from financial_submission_rows.csv")
    else:
        # Create empty file with header
        with open(submission_rows_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "source_account", "unified_account", "unified_cost_center", "amount"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        reset_steps.append("Created empty financial_submission_rows.csv")
    
    # STEP 3: Clear brand_approved_financials.csv (empty but keep header)
    approved_path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
    if approved_path.exists():
        # Read to count how many we're deleting
        with open(approved_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = sum(1 for _ in reader)
        
        # Write empty file with just header
        with open(approved_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "unified_account", "unified_cost_center", "amount", "approved_timestamp"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        
        reset_steps.append(f"Deleted {count} approved record(s) from brand_approved_financials.csv")
    else:
        # Create empty file with header
        with open(approved_path, 'w', encoding='utf-8', newline='') as f:
            fieldnames = ["submission_id", "brand", "unified_account", "unified_cost_center", "amount", "approved_timestamp"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
        reset_steps.append("Created empty brand_approved_financials.csv")
    
    # STEP 4: Regenerate Preview Submission for all brands
    try:
        recompute_preview_submissions_for_all_brands()
        reset_steps.append("Regenerated Preview Submission for all brands")
    except Exception as e:
        reset_steps.append(f"Error regenerating preview: {e}")
    
    # STEP 5: Variances are computed dynamically from raw data + current mappings
    # No action needed - calculate_variances() will automatically show only unresolved issues
    
    print(f"[FINANCIAL] Financial Integration hard reset completed - all submission history deleted")
    for step in reset_steps:
        print(f"[FINANCIAL]   - {step}")
    
    return {
        "ok": True,
        "message": "Financial Integration hard reset completed - all submission history deleted",
        "steps": reset_steps
    }
