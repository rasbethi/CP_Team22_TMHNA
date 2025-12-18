"""
Analytics Controller - Read-only analytics dashboard.
"""
from flask import Blueprint, render_template, session, jsonify, redirect, url_for
from services.analytics_service import (
    compute_data_quality_analytics,
    compute_variance_analytics,
    compute_submission_analytics,
    compute_mapping_impact_analytics,
    compute_vendor_harmonization_analytics
)

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics")
def analytics_page():
    """Render the Analytics page."""
    if 'user' not in session:
        return redirect(url_for('login'))
    
    role = session.get('role', '')
    if role not in ['maya', 'liam', 'ethan']:
        return redirect(url_for('home'))
    
    return render_template("analytics.html")


@analytics_bp.route("/api/analytics/data-quality")
def get_data_quality_analytics():
    """Get data quality analytics (all roles)."""
    role = session.get('role', '')
    
    if role == 'liam':
        brand = 'raymond'
    elif role == 'ethan':
        brand = 'tmh'
    else:
        brand = None  # Maya sees all
    
    try:
        analytics = compute_data_quality_analytics(brand)
        return jsonify(analytics)
    except Exception as e:
        print(f"[API] ERROR in get_data_quality_analytics: {e}")
        return jsonify({
            "total_raw_rows": 0,
            "fully_mapped_rows": 0,
            "unmapped_rows": 0,
            "readiness_percent": 0.0
        })


@analytics_bp.route("/api/analytics/variances")
def get_variance_analytics():
    """Get variance analytics (all roles)."""
    role = session.get('role', '')
    
    if role == 'liam':
        brand = 'raymond'
    elif role == 'ethan':
        brand = 'tmh'
    else:
        brand = None  # Maya sees all
    
    try:
        analytics = compute_variance_analytics(brand)
        return jsonify(analytics)
    except Exception as e:
        print(f"[API] ERROR in get_variance_analytics: {e}")
        return jsonify({
            "total_variances": 0,
            "by_type": {},
            "by_brand": {}
        })


@analytics_bp.route("/api/analytics/submissions")
def get_submission_analytics():
    """Get submission analytics (all roles)."""
    role = session.get('role', '')
    
    if role == 'liam':
        brand = 'raymond'
    elif role == 'ethan':
        brand = 'tmh'
    else:
        brand = None  # Maya sees all
    
    try:
        analytics = compute_submission_analytics(brand)
        return jsonify(analytics)
    except Exception as e:
        print(f"[API] ERROR in get_submission_analytics: {e}")
        return jsonify({
            "total_submissions": 0,
            "by_status": {},
            "by_brand": {},
            "avg_time_to_approve": None
        })


@analytics_bp.route("/api/analytics/mapping-impact")
def get_mapping_impact_analytics():
    """Get mapping impact analytics (Maya only)."""
    role = session.get('role', '')
    
    if role != 'maya':
        return jsonify({"error": "Unauthorized"}), 403
    
    try:
        analytics = compute_mapping_impact_analytics()
        return jsonify(analytics)
    except Exception as e:
        print(f"[API] ERROR in get_mapping_impact_analytics: {e}")
        return jsonify({
            "total_account_mappings": 0,
            "total_cost_center_mappings": 0,
            "current_variances": 0
        })


@analytics_bp.route("/api/analytics/vendor-harmonization")
def get_vendor_harmonization_analytics():
    """Get vendor harmonization analytics (all roles)."""
    try:
        analytics = compute_vendor_harmonization_analytics()
        return jsonify(analytics)
    except Exception as e:
        print(f"[API] ERROR in get_vendor_harmonization_analytics: {e}")
        return jsonify({
            "harmonized_count": 0,
            "unmatched_count": 0,
            "vendor_confidence_scores": []
        })

