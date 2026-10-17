import os
from datetime import datetime, timedelta, timezone
from functools import wraps

from dotenv import load_dotenv
import jwt
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

# Load the Backend/.env file before reading the JWT secret.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=False)

from auth_database import (
    create_user,
    authenticate_user,
    get_user_by_id,
    get_predictions,
)

auth_bp = Blueprint("auth", __name__)


JWT_SECRET = os.environ.get("STUDYSPARK_JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError(
        "Set the STUDYSPARK_JWT_SECRET environment variable before starting Flask."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def create_token(user):
    now = datetime.now(timezone.utc)

    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def token_required(function):
    @wraps(function)
    def decorated(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        parts = authorization.split(" ", 1)

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authentication required."}), 401

        try:
            payload = jwt.decode(
                parts[1],
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
            )

            user_id = payload.get("user_id")

            if not isinstance(user_id, int):
                return jsonify({"error": "Invalid token."}), 401

            user = get_user_by_id(user_id)

            if user is None:
                return jsonify({"error": "User no longer exists."}), 401

            return function(user, *args, **kwargs)

        except jwt.ExpiredSignatureError:
            return jsonify({
                "error": "Session expired. Please log in again."
            }), 401

        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid or expired token."}), 401

    return decorated


# =====================================================
# REGISTER
# =====================================================

@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request body."}), 400

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not name:
        return jsonify({"error": "Name is required."}), 400

    if len(name) > 100:
        return jsonify({"error": "Name must be 100 characters or fewer."}), 400

    if not email or "@" not in email or len(email) > 255:
        return jsonify({"error": "Please enter a valid email."}), 400

    if not isinstance(password, str) or len(password) < 6:
        return jsonify({
            "error": "Password must contain at least 6 characters."
        }), 400

    try:
        user = create_user(name, email, password)

        if user is None:
            return jsonify({
                "error": "An account with this email already exists."
            }), 409

        return jsonify({
            "message": "Account created successfully.",
            "token": create_token(user),
            "user": user,
        }), 201

    except IntegrityError:
        return jsonify({
            "error": "An account with this email already exists."
        }), 409

    except Exception:
        import logging
        logging.exception("StudySpark registration failed")
        return jsonify({"error": "Registration failed."}), 500


# =====================================================
# LOGIN
# =====================================================

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request body."}), 400

    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not email or not isinstance(password, str) or not password:
        return jsonify({
            "error": "Email and password are required."
        }), 400

    try:
        user = authenticate_user(email, password)

        if user is None:
            return jsonify({
                "error": "Invalid email or password."
            }), 401

        return jsonify({
            "message": "Login successful.",
            "token": create_token(user),
            "user": user,
        }), 200

    except Exception:
        import logging
        logging.exception("StudySpark login failed")
        return jsonify({"error": "Login failed."}), 500


# =====================================================
# CURRENT USER
# =====================================================

@auth_bp.route("/api/auth/me", methods=["GET"])
@token_required
def current_user(user):
    return jsonify({"user": user}), 200


# =====================================================
# PREDICTION HISTORY
# =====================================================

@auth_bp.route("/api/predictions", methods=["GET"])
@token_required
def prediction_history(user):
    try:
        predictions = get_predictions(user["id"])

        return jsonify({"predictions": predictions}), 200

    except Exception:
        import logging
        logging.exception("Could not retrieve prediction history")
        return jsonify({
            "error": "Unable to retrieve prediction history."
        }), 500
