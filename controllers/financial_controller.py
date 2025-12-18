"""
Financial Integration Controller - CSV-driven workflow.
"""
from flask import Blueprint, jsonify, session, request, render_template, redirect, url_for
from services.financial_service import (
    load_raw_accounts,
    check_data_quality,
    get_preview_submission,
    submit_to_corporate,
    load_submissions,
    load_submission_rows,
    get_brand_approved_view,
    get_corporate_unified_view,
    calculate_variances,
    update_submission_status,
    reset_financial_integration_state
)

financial_bp = Blueprint("financial", __name__)


@financial_bp.route("/financial")
def financial_page():
    """Render the Financial Integration page."""
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template("financial.html")


@financial_bp.route("/api/financial/raw")
def get_raw_accounts():
    """Get raw account data (Brand Controller only)."""
    role = session.get('role', '')
    
    if role == 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    brand = 'tmh' if role == 'ethan' else 'raymond'
    
    try:
        raw = load_raw_accounts(brand)
        return jsonify({"data": raw})
    except Exception as e:
        print(f"[API] ERROR in get_raw_accounts: {e}")
        return jsonify({"data": [], "error": str(e)})


@financial_bp.route("/api/financial/records-count")
def get_financial_records_count():
    """Get count of financial records (all roles)."""
    role = session.get('role', '')
    
    try:
        from services.financial_service import load_raw_accounts
        
        if role == 'maya':
            # Maya sees all records
            all_records = load_raw_accounts(None)
            return jsonify({"count": len(all_records)})
        elif role == 'liam':
            # Raymond brand controller
            raymond_records = load_raw_accounts('raymond')
            return jsonify({"count": len(raymond_records)})
        elif role == 'ethan':
            # TMH brand controller
            tmh_records = load_raw_accounts('tmh')
            return jsonify({"count": len(tmh_records)})
        else:
            return jsonify({"count": 0})
    except Exception as e:
        print(f"[API] ERROR in get_financial_records_count: {e}")
        return jsonify({"count": 0, "error": str(e)})


@financial_bp.route("/api/financial/quality/<brand>")
def get_data_quality(brand):
    """Get data quality issues - Maya sees all brands, Brand Controllers see their brand only."""
    role = session.get('role', '')
    brand_lower = brand.lower()
    
    # Maya can see all brands, Brand Controllers only their brand
    if role == 'liam' and brand_lower != 'raymond':
        return jsonify({"error": "Unauthorized"}), 403
    if role == 'ethan' and brand_lower != 'tmh':
        return jsonify({"error": "Unauthorized"}), 403
    if role not in ['maya', 'liam', 'ethan']:
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        issues = check_data_quality(brand)
        return jsonify({
            "brand": brand.upper(),
            "issue_count": len(issues),
            "issues": issues
        })
    except Exception as e:
        print(f"[API] ERROR in get_data_quality: {e}")
        return jsonify({
            "brand": brand.upper(),
            "issue_count": 0,
            "issues": [],
            "error": str(e)
        })


@financial_bp.route("/api/financial/preview/<brand>")
def get_preview(brand):
    """
    Get preview submission (Brand Controller only).
    Recomputes variances dynamically to show current status.
    """
    role = session.get('role', '')
    brand_lower = brand.lower()
    
    if role == 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    if role == 'liam' and brand_lower != 'raymond':
        return jsonify({"error": "Unauthorized"}), 403
    if role == 'ethan' and brand_lower != 'tmh':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        # Recompute variances dynamically (never cached)
        from services.financial_service import calculate_variances
        variances = calculate_variances(brand)
        blocking_variances = [
            v for v in variances 
            if v.get("variance_type") in ["UNMAPPED_ACCOUNT", "UNMAPPED_COST_CENTER"]
        ]
        
        preview = get_preview_submission(brand)
        return jsonify({
            "brand": brand.upper(),
            "records": preview,
            "record_count": len(preview),
            "variance_count": len(variances),
            "blocking_variance_count": len(blocking_variances),
            "can_submit": len(blocking_variances) == 0
        })
    except Exception as e:
        print(f"[API] ERROR in get_preview: {e}")
        return jsonify({
            "brand": brand.upper(),
            "records": [],
            "record_count": 0,
            "variance_count": 0,
            "blocking_variance_count": 0,
            "can_submit": False,
            "error": str(e)
        })


@financial_bp.route("/api/financial/submit/<brand>", methods=["POST"])
def submit_brand(brand):
    """Submit brand to corporate (Brand Controller only)."""
    role = session.get('role', '')
    brand_lower = brand.lower()
    
    if role == 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    if role == 'liam' and brand_lower != 'raymond':
        return jsonify({"error": "Unauthorized"}), 403
    if role == 'ethan' and brand_lower != 'tmh':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        result = submit_to_corporate(brand)
        return jsonify(result)
    except Exception as e:
        print(f"[API] ERROR in submit_brand: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@financial_bp.route("/api/financial/submissions")
def get_submissions():
    """Get submissions."""
    role = session.get('role', '')
    
    brand = None
    if role == 'liam':
        brand = 'raymond'
    elif role == 'ethan':
        brand = 'tmh'
    # Maya sees all
    
    try:
        submissions = load_submissions(brand)
        return jsonify({"data": submissions})
    except Exception as e:
        print(f"[API] ERROR in get_submissions: {e}")
        return jsonify({"data": [], "error": str(e)})


@financial_bp.route("/api/financial/submission/<submission_id>/rows")
def get_submission_rows(submission_id):
    """Get rows for a specific submission."""
    try:
        rows = load_submission_rows(submission_id)
        return jsonify({"data": rows})
    except Exception as e:
        print(f"[API] ERROR in get_submission_rows: {e}")
        return jsonify({"data": [], "error": str(e)})


@financial_bp.route("/api/financial/brand-approved/<brand>")
def get_brand_approved(brand):
    """Get brand-level approved view (Corporate only)."""
    role = session.get('role', '')
    
    # Maya must be authorized - return empty array instead of 403 to prevent "Unauthorized" message
    if role != 'maya':
        return jsonify({"data": []})
    
    try:
        approved = get_brand_approved_view(brand)
        return jsonify({"data": approved})
    except Exception as e:
        print(f"[API] ERROR in get_brand_approved: {e}")
        # Return empty array on error, not error object, to prevent frontend "Unauthorized" message
        return jsonify({"data": []})


@financial_bp.route("/api/financial/corporate-unified")
def get_corporate_unified():
    """Get corporate unified view - aggregated by unified_account + unified_cost_center (Corporate only)."""
    role = session.get('role', '')
    
    if role != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        unified = get_corporate_unified_view()
        return jsonify({"data": unified})
    except Exception as e:
        print(f"[API] ERROR in get_corporate_unified: {e}")
        return jsonify({"data": [], "error": str(e)})


@financial_bp.route("/api/financial/variances")
def get_variances():
    """Get variances - Brand Controllers see their brand only, Maya sees all."""
    role = session.get('role', '')
    
    # Both Brand Controllers and Maya can see variances
    if role not in ['maya', 'liam', 'ethan']:
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        # Brand Controllers see their brand only, Maya sees all (brand=None)
        brand = None
        if role == 'liam':
            brand = 'raymond'
        elif role == 'ethan':
            brand = 'tmh'
        # role == 'maya' -> brand = None (sees all)
        
        variances = calculate_variances(brand)
        return jsonify({"data": variances})
    except Exception as e:
        print(f"[API] ERROR in get_variances: {e}")
        # Return empty array on error, not error object
        return jsonify({"data": []})


@financial_bp.route("/api/financial/submission/<submission_id>/status", methods=["POST"])
def update_status(submission_id):
    """Update submission status (Corporate only)."""
    role = session.get('role', '')
    
    if role != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json() or {}
    status = data.get("status")
    
    if status not in ["APPROVED", "REJECTED"]:
        return jsonify({"error": "Invalid status"}), 400
    
    try:
        result = update_submission_status(submission_id, status)
        return jsonify(result)
    except Exception as e:
        print(f"[API] ERROR in update_status: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@financial_bp.route("/api/financial/reset-state", methods=["POST"])
def reset_financial_state():
    """Reset Financial Integration to clean pre-submission state (Corporate only)."""
    role = session.get('role', '')
    
    if role != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        result = reset_financial_integration_state()
        return jsonify(result)
    except Exception as e:
        print(f"[API] ERROR in reset_financial_state: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500
