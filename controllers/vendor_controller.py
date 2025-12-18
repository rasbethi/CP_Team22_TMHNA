from flask import Blueprint, jsonify, render_template, Response, session, redirect, url_for, request

from services.vendor_service import load_raw_vendor_data, harmonize_vendors, harmonized_vendors_csv, raw_vendors_csv
from services.mapping_governance_service import add_vendor_manual_merge

vendor_bp = Blueprint("vendors", __name__)


@vendor_bp.route("/vendors")
def vendor_page():
    if 'user' not in session:
        return redirect(url_for("login"))
    return render_template("vendors.html")


@vendor_bp.route("/api/vendors/raw")
def vendor_raw():
    return jsonify(load_raw_vendor_data())


@vendor_bp.route("/api/vendors/harmonized")
def vendor_harmonized():
    return jsonify({"data": harmonize_vendors()})


@vendor_bp.route("/api/vendors/harmonized/csv")
def vendor_harmonized_csv():
    csv_content = harmonized_vendors_csv()
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=unified_vendors.csv"},
    )


@vendor_bp.route("/api/vendors/raw/csv")
def vendor_raw_csv():
    brand = request.args.get("brand", "").lower()  # Get brand from query parameter
    csv_content = raw_vendors_csv(brand if brand in ["tmh", "raymond"] else None)
    
    filename = f"raw_vendors_{brand}.csv" if brand in ["tmh", "raymond"] else "raw_vendors.csv"
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@vendor_bp.route("/api/vendors/merge", methods=["POST"])
def merge_vendors():
    """Merge multiple vendor records into one unified vendor."""
    if session.get('role') != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    vendor_ids = data.get("vendor_ids")
    unified_name = data.get("unified_name")
    unified_address = data.get("unified_address", "")
    unified_phone = data.get("unified_phone", "")
    
    if not vendor_ids or not isinstance(vendor_ids, list) or len(vendor_ids) < 2:
        return jsonify({"error": "At least 2 vendor IDs required for merge"}), 400
    
    if not unified_name:
        return jsonify({"error": "unified_name is required"}), 400
    
    try:
        user = session.get('name', 'Unknown')
        result = add_vendor_manual_merge(
            vendor_ids=vendor_ids,
            unified_name=unified_name,
            unified_address=unified_address,
            unified_phone=unified_phone,
            user=user
        )
        return jsonify(result)
    except Exception as e:
        print(f"[API] ERROR in merge_vendors: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500

