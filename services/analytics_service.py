"""
Analytics Service - Read-only analytics computation from existing data.
Does not modify any existing workflows or data structures.
"""
from typing import Dict, List, Optional
from pathlib import Path
import csv
from datetime import datetime
from services.financial_service import (
    load_raw_accounts,
    load_unified_account_mapping,
    load_unified_cost_center_mapping,
    calculate_variances,
    load_submissions,
    FINANCIAL_DATA_PATH
)
from services.vendor_service import harmonize_vendors


def compute_data_quality_analytics(brand: Optional[str] = None) -> Dict:
    """
    Compute data quality metrics from raw financial data and mappings.
    
    Returns:
        - total_raw_rows: Total number of raw financial rows
        - fully_mapped_rows: Rows with both account and cost center mapped
        - unmapped_rows: Total - fully_mapped
        - readiness_percent: Percentage ready to submit
    """
    try:
        raw_accounts = load_raw_accounts(brand)
        account_mapping = load_unified_account_mapping()
        cost_center_mapping = load_unified_cost_center_mapping()
        
        total_raw_rows = len(raw_accounts)
        fully_mapped = 0
        
        for row in raw_accounts:
            source_account_name = row.get("source_account_name", "").strip()
            source_cost_center = row.get("source_cost_center", "").strip()
            
            if source_account_name in account_mapping and source_cost_center in cost_center_mapping:
                fully_mapped += 1
        
        unmapped = total_raw_rows - fully_mapped
        readiness_percent = (fully_mapped / total_raw_rows * 100) if total_raw_rows > 0 else 0.0
        
        return {
            "total_raw_rows": total_raw_rows,
            "fully_mapped_rows": fully_mapped,
            "unmapped_rows": unmapped,
            "readiness_percent": round(readiness_percent, 1)
        }
    except Exception as e:
        print(f"[ANALYTICS] Error computing data quality: {e}")
        return {
            "total_raw_rows": 0,
            "fully_mapped_rows": 0,
            "unmapped_rows": 0,
            "readiness_percent": 0.0
        }


def compute_variance_analytics(brand: Optional[str] = None) -> Dict:
    """
    Compute variance analytics from variances table.
    
    Returns:
        - total_variances: Total count
        - by_type: Dict of variance_type -> count
        - by_brand: Dict of brand -> count
    """
    try:
        variances = calculate_variances(brand)
        
        by_type = {}
        by_brand = {}
        
        for v in variances:
            variance_type = v.get("variance_type", "UNKNOWN")
            variance_brand = v.get("brand", "UNKNOWN")
            
            by_type[variance_type] = by_type.get(variance_type, 0) + 1
            by_brand[variance_brand] = by_brand.get(variance_brand, 0) + 1
        
        return {
            "total_variances": len(variances),
            "by_type": by_type,
            "by_brand": by_brand
        }
    except Exception as e:
        print(f"[ANALYTICS] Error computing variance analytics: {e}")
        return {
            "total_variances": 0,
            "by_type": {},
            "by_brand": {}
        }


def compute_submission_analytics(brand: Optional[str] = None) -> Dict:
    """
    Compute submission analytics from submissions table.
    
    Returns:
        - total_submissions: Total count
        - by_status: Dict of status -> count
        - by_brand: Dict of brand -> count
        - avg_time_to_approve: Average time in hours (if timestamps available)
    """
    try:
        submissions = load_submissions(brand)
        
        by_status = {}
        by_brand = {}
        approval_times = []
        
        for sub in submissions:
            status = sub.get("status", "UNKNOWN")
            sub_brand = sub.get("brand", "UNKNOWN")
            
            by_status[status] = by_status.get(status, 0) + 1
            by_brand[sub_brand] = by_brand.get(sub_brand, 0) + 1
            
            # Try to calculate time to approve if timestamps exist
            if status == "APPROVED":
                timestamp_str = sub.get("timestamp", "")
                if timestamp_str:
                    try:
                        submitted_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        # Check if approved_timestamp exists in brand_approved_financials
                        approved_path = FINANCIAL_DATA_PATH / "brand_approved_financials.csv"
                        if approved_path.exists():
                            with open(approved_path, 'r', encoding='utf-8') as f:
                                reader = csv.DictReader(f)
                                for row in reader:
                                    if row.get("submission_id") == sub.get("submission_id"):
                                        approved_str = row.get("approved_timestamp", "")
                                        if approved_str:
                                            approved_time = datetime.fromisoformat(approved_str.replace('Z', '+00:00'))
                                            hours = (approved_time - submitted_time).total_seconds() / 3600
                                            if hours > 0:
                                                approval_times.append(hours)
                                        break
                    except Exception:
                        pass  # Skip if timestamp parsing fails
        
        avg_time_to_approve = sum(approval_times) / len(approval_times) if approval_times else None
        
        return {
            "total_submissions": len(submissions),
            "by_status": by_status,
            "by_brand": by_brand,
            "avg_time_to_approve": round(avg_time_to_approve, 1) if avg_time_to_approve else None
        }
    except Exception as e:
        print(f"[ANALYTICS] Error computing submission analytics: {e}")
        return {
            "total_submissions": 0,
            "by_status": {},
            "by_brand": {},
            "avg_time_to_approve": None
        }


def compute_mapping_impact_analytics() -> Dict:
    """
    Compute mapping impact analytics (Maya only).
    
    Returns:
        - total_account_mappings: Count of account mappings
        - total_cost_center_mappings: Count of cost center mappings
        - current_variances: Current variance count
        - total_source_accounts: Total unique source accounts in raw data
    """
    try:
        account_mapping = load_unified_account_mapping()
        cost_center_mapping = load_unified_cost_center_mapping()
        
        # Get current variance count
        variances = calculate_variances(None)
        
        # Get total source accounts from raw data
        raw_accounts = load_raw_accounts(None)
        unique_accounts = set()
        for row in raw_accounts:
            account_name = row.get("source_account_name", "").strip()
            if account_name:
                unique_accounts.add(account_name)
        
        return {
            "total_account_mappings": len(account_mapping),
            "total_cost_center_mappings": len(cost_center_mapping),
            "current_variances": len(variances),
            "total_source_accounts": len(unique_accounts)
        }
    except Exception as e:
        print(f"[ANALYTICS] Error computing mapping impact: {e}")
        return {
            "total_account_mappings": 0,
            "total_cost_center_mappings": 0,
            "current_variances": 0,
            "total_source_accounts": 0
        }


def compute_vendor_harmonization_analytics() -> Dict:
    """
    Compute vendor harmonization analytics.
    
    Returns:
        - harmonized_count: Number of vendors that matched across brands
        - unmatched_count: Number of vendors that are standalone
        - vendor_confidence_scores: List of top vendors with confidence scores
    """
    try:
        harmonized_data = harmonize_vendors()
        
        harmonized_count = 0
        unmatched_count = 0
        vendor_confidence_scores = []
        
        for vendor in harmonized_data:
            source_brands = vendor.get("source_brands", "")
            # Check if vendor has multiple source brands (harmonized) or single (unmatched)
            brand_count = len([b for b in ["TMH", "Raymond"] if b in source_brands])
            
            if brand_count > 1:
                harmonized_count += 1
            else:
                unmatched_count += 1
            
            # Calculate confidence score based on data completeness
            name_present = bool(vendor.get("unified_name", "").strip())
            address_present = bool(vendor.get("unified_address", "").strip())
            phone_present = bool(vendor.get("unified_phone", "").strip())
            match_confidence = vendor.get("confidence", 100)
            
            # Confidence calculation:
            # - Name: 30 points (always present in harmonized vendors)
            # - Address: 30 points
            # - Phone: 20 points
            # - Match quality/Harmonization: 20 points
            #   - Harmonized vendors (multiple brands) get full points (harmonization indicates quality)
            #   - Single-brand vendors get points based on match confidence if they tried to match
            confidence_score = 0
            if name_present:
                confidence_score += 30
            if address_present:
                confidence_score += 30
            if phone_present:
                confidence_score += 20
            
            # Match quality points: harmonized vendors get full points, others based on match confidence
            if brand_count > 1:
                # Harmonized vendor - gets full points for successful cross-brand matching
                confidence_score += 20
            else:
                # Single-brand vendor - score based on match confidence
                # Higher match confidence means it was considered for matching but didn't match
                if match_confidence >= 85:
                    confidence_score += 18
                elif match_confidence >= 70:
                    confidence_score += 15
                elif match_confidence >= 50:
                    confidence_score += 10
                else:
                    # Very low match confidence or no match attempt
                    confidence_score += 5
            
            vendor_confidence_scores.append({
                "vendor_name": vendor.get("unified_name", ""),
                "confidence_score": confidence_score,
                "is_harmonized": brand_count > 1
            })
        
        # Sort by confidence score descending and get top 10
        vendor_confidence_scores.sort(key=lambda x: x["confidence_score"], reverse=True)
        top_vendors = vendor_confidence_scores[:10]
        
        return {
            "harmonized_count": harmonized_count,
            "unmatched_count": unmatched_count,
            "vendor_confidence_scores": top_vendors
        }
    except Exception as e:
        print(f"[ANALYTICS] Error computing vendor harmonization analytics: {e}")
        return {
            "harmonized_count": 0,
            "unmatched_count": 0,
            "vendor_confidence_scores": []
        }

