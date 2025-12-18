from typing import Dict, List


def calculate_variances(harmonized_data: List[Dict]) -> List[Dict]:
    """Calculate variances by grouping unified accounts and comparing TMH vs Raymond."""
    if not harmonized_data:
        return []
    
    # Separate mapped and unmapped accounts
    mapped_rows = []
    unmapped_rows = []
    
    for row in harmonized_data:
        unified_account = row.get("unified_account_number", "")
        # Check if account is unmapped
        if not unified_account or str(unified_account).strip() == "" or str(unified_account) == "UNMAPPED":
            unmapped_rows.append(row)
        else:
            mapped_rows.append(row)
    
    # Group mapped accounts by unified account number
    unified_groups = {}
    
    for row in mapped_rows:
        unified_account = row.get("unified_account_number", "")
        
        if unified_account not in unified_groups:
            unified_groups[unified_account] = {
                "unified_account_number": unified_account,
                "unified_account_name": row.get("unified_account_name", ""),
                "tmh_records": [],
                "raymond_records": [],
            }
        
        brand = row.get("brand", "")
        if brand == "TMH":
            unified_groups[unified_account]["tmh_records"].append(row)
        elif brand == "Raymond":
            unified_groups[unified_account]["raymond_records"].append(row)
    
    # Build variance list
    variances = []
    
    # Process mapped accounts (grouped by unified account)
    for unified_account, group in unified_groups.items():
        tmh_count = len(group["tmh_records"])
        raymond_count = len(group["raymond_records"])
        
        variance = {
            "unified_account_number": unified_account,
            "unified_account_name": group["unified_account_name"],
            "tmh_count": tmh_count,
            "raymond_count": raymond_count,
            "tmh_records": group["tmh_records"],
            "raymond_records": group["raymond_records"],
        }
        
        # One brand missing entirely
        if tmh_count == 0:
            variance["variance_type"] = "missing_brand"
            variance["message"] = f"Account exists in Raymond only ({raymond_count} records)"
            variances.append(variance)
            continue
        
        if raymond_count == 0:
            variance["variance_type"] = "missing_brand"
            variance["message"] = f"Account exists in TMH only ({tmh_count} records)"
            variances.append(variance)
            continue
        
        # Count mismatch
        if tmh_count != raymond_count:
            variance["variance_type"] = "count_mismatch"
            variance["message"] = f"Record count mismatch (TMH: {tmh_count}, Raymond: {raymond_count})"
            variances.append(variance)
            continue
        
        # Cost center mismatch
        tmh_cc = set(str(r.get("unified_cost_center", "")) for r in group["tmh_records"])
        raymond_cc = set(str(r.get("unified_cost_center", "")) for r in group["raymond_records"])
        
        if tmh_cc != raymond_cc:
            variance["variance_type"] = "cost_center_mismatch"
            variance["message"] = f"Cost center mismatch (TMH: {list(tmh_cc)}, Raymond: {list(raymond_cc)})"
            variances.append(variance)
            continue
        
        # Unmapped cost centers
        has_unmapped_cc = any(
            str(r.get("unified_cost_center", "")) == "UNMAPPED" 
            for r in group["tmh_records"] + group["raymond_records"]
        )
        
        if has_unmapped_cc:
            variance["variance_type"] = "unmapped_cost_center"
            variance["message"] = "Some cost centers could not be mapped"
            variances.append(variance)
    
    # Process unmapped accounts (individual entries, not grouped)
    for row in unmapped_rows:
        brand = row.get("brand", "")
        source_account_number = row.get("source_account_number", "")
        source_account_name = row.get("source_account_name", "")
        
        variance = {
            "unified_account_number": "UNMAPPED",
            "unified_account_name": source_account_name,  # Use source account name instead of generic label
            "tmh_count": 1 if brand == "TMH" else 0,
            "raymond_count": 1 if brand == "Raymond" else 0,
            "tmh_records": [row] if brand == "TMH" else [],
            "raymond_records": [row] if brand == "Raymond" else [],
            "variance_type": "unmapped_account",
            "message": f"Account {source_account_number} ({source_account_name}) could not be mapped to unified COA",
            "source_account_number": source_account_number,
            "source_account_name": source_account_name,
        }
        variances.append(variance)
    
    return variances
