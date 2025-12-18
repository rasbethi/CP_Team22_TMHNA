import os
import warnings
import random
import time

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify

# Suppress harmless resource tracker warnings from multiprocessing libraries
warnings.filterwarnings('ignore', message='.*resource_tracker.*')

from controllers.vendor_controller import vendor_bp
from controllers.mapping_controller import mapping_bp
from controllers.financial_controller import financial_bp
from controllers.analytics_controller import analytics_bp


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'tmhna-dev-secret-key-change-in-production')

    # Register feature blueprints
    app.register_blueprint(vendor_bp)
    app.register_blueprint(mapping_bp)
    app.register_blueprint(financial_bp)
    app.register_blueprint(analytics_bp)

    # Dummy user database for three personas
    USERS = {
        'maya': {'password': 'demo', 'role': 'maya', 'name': 'Maya Patel', 'email': 'maya.patel@tmhna.com'},
        'liam': {'password': 'demo', 'role': 'liam', 'name': 'Liam Anderson', 'email': 'liam.anderson@raymond.com'},
        'ethan': {'password': 'demo', 'role': 'ethan', 'name': 'Ethan Roberts', 'email': 'ethan.roberts@tmh.com'},
    }

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip().lower()
            password = request.form.get("password", "")
            role = request.form.get("role", "")
            
            # Simple validation - just check if username exists and password is 'demo'
            if username in USERS and password == 'demo':
                # Generate 6-digit MFA code
                mfa_code = str(random.randint(100000, 999999))
                mfa_expiry = time.time() + 600  # 10 minutes expiry
                
                # Store MFA code and user info in session (not yet authenticated)
                session['mfa_pending'] = True
                session['mfa_code'] = mfa_code
                session['mfa_expiry'] = mfa_expiry
                session['pending_username'] = username
                session['pending_role'] = role if role else USERS[username]['role']
                session['pending_name'] = USERS[username]['name']
                session['pending_email'] = USERS[username]['email']
                
                # Return JSON with MFA code for popup display
                return jsonify({
                    'success': True,
                    'mfa_required': True,
                    'mfa_code': mfa_code,
                    'email': USERS[username]['email']
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Invalid credentials. Use username and password "demo"'
                }), 401
        
        # If already logged in, redirect to home
        if 'user' in session:
            return redirect(url_for("home"))
        
        return render_template("login.html")
    
    @app.route("/verify-mfa", methods=["POST"])
    def verify_mfa():
        """Verify MFA code and complete login."""
        if not session.get('mfa_pending'):
            return jsonify({'success': False, 'error': 'No pending MFA verification'}), 400
        
        entered_code = request.json.get('code', '').strip()
        stored_code = session.get('mfa_code', '')
        expiry = session.get('mfa_expiry', 0)
        
        # Check if code expired
        if time.time() > expiry:
            session.pop('mfa_pending', None)
            session.pop('mfa_code', None)
            session.pop('mfa_expiry', None)
            return jsonify({'success': False, 'error': 'MFA code has expired. Please login again.'}), 401
        
        # Verify code
        if entered_code == stored_code:
            # Complete login - move pending user data to authenticated session
            session['user'] = session.pop('pending_username')
            session['role'] = session.pop('pending_role')
            session['name'] = session.pop('pending_name')
            session['email'] = session.pop('pending_email')
            session['mfa_verified'] = True
            
            # Clear MFA data
            session.pop('mfa_pending', None)
            session.pop('mfa_code', None)
            session.pop('mfa_expiry', None)
            
            return jsonify({'success': True, 'redirect': url_for('home')})
        else:
            return jsonify({'success': False, 'error': 'Invalid verification code. Please try again.'}), 401

    @app.route("/logout")
    def logout():
        session.clear()
        return redirect(url_for("login"))

    @app.route("/")
    def home():
        if 'user' not in session:
            return redirect(url_for("login"))
        return render_template("home.html")

    return app


if __name__ == "__main__":
    application = create_app()
    port = int(os.environ.get("PORT", 5002))
    application.run(host="0.0.0.0", port=port, debug=True)

