"""
Mapping Governance Controller - Corporate-only (Maya) access.
"""
from flask import Blueprint, jsonify, request, session, render_template, redirect, url_for
from services.mapping_governance_service import (
    load_financial_account_mappings,
    save_financial_account_mappings,
    load_financial_cost_center_mappings,
    save_financial_cost_center_mappings,
    load_vendor_rules,
    save_vendor_rules,
    get_vendor_overrides,
    add_vendor_override
)

mapping_bp = Blueprint("mapping", __name__)


@mapping_bp.route("/mappings")
def mapping_page():
    """Mapping governance page - Maya only."""
    if 'user' not in session:
        return redirect(url_for("login"))
    if session.get('role') != 'maya':
        return redirect(url_for("home"))
    return render_template("mappings.html")


@mapping_bp.route("/api/mappings/financial/accounts")
def get_financial_account_mappings():
    """Get financial account mappings - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    mappings = load_financial_account_mappings()
    return jsonify({"data": mappings})


@mapping_bp.route("/api/mappings/financial/accounts", methods=["POST"])
def update_financial_account_mappings():
    """Update financial account mappings - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    if not data or "mappings" not in data:
        return jsonify({"error": "No mappings provided"}), 400
    
    try:
        save_financial_account_mappings(data["mappings"], session.get('name', 'Unknown'))
        return jsonify({
            "ok": True,
            "message": "Account mappings updated successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mapping_bp.route("/api/mappings/financial/cost-centers")
def get_financial_cost_center_mappings():
    """Get financial cost center mappings - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    mappings = load_financial_cost_center_mappings()
    return jsonify({"data": mappings})


@mapping_bp.route("/api/mappings/financial/cost-centers", methods=["POST"])
def update_financial_cost_center_mappings():
    """Update financial cost center mappings - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    if not data or "mappings" not in data:
        return jsonify({"error": "No mappings provided"}), 400
    
    try:
        save_financial_cost_center_mappings(data["mappings"], session.get('name', 'Unknown'))
        return jsonify({
            "ok": True,
            "message": "Cost center mappings updated successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mapping_bp.route("/api/mappings/vendor")
def get_vendor_rules():
    """Get vendor matching rules - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    rules = load_vendor_rules()
    return jsonify(rules)


@mapping_bp.route("/api/mappings/vendor", methods=["POST"])
def update_vendor_rules():
    """Update vendor matching rules - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    if "confidence_threshold" in data:
        threshold = data["confidence_threshold"]
        if not isinstance(threshold, int) or threshold < 0 or threshold > 100:
            return jsonify({"error": "confidence_threshold must be between 0 and 100"}), 400
    
    try:
        save_vendor_rules(data, session.get('name', 'Unknown'))
        return jsonify({
            "status": "success",
            "message": "Vendor rules updated successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mapping_bp.route("/api/mappings/vendor/overrides", methods=["POST"])
def create_vendor_override():
    """Create a vendor match override - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    unified_name = data.get('unified_name')
    tmh_name = data.get('tmh_name')
    raymond_name = data.get('raymond_name')
    
    if not all([unified_name, tmh_name, raymond_name]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        add_vendor_override(
            unified_name=unified_name,
            tmh_name=tmh_name,
            raymond_name=raymond_name,
            user=session.get('name', 'Unknown')
        )
        return jsonify({
            "status": "success",
            "message": "Vendor override created successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mapping_bp.route("/api/mappings/vendor/overrides")
def list_vendor_overrides():
    """List all vendor overrides - Maya only."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    overrides = get_vendor_overrides()
    return jsonify({"overrides": overrides})
