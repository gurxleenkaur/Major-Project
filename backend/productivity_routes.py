
import os
import logging
from datetime import datetime, timezone

import jwt
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request

from productivity_model.utils_predict_new import (
    predict as run_new_productivity_prediction,
)

from productivity_model.utils_predict import (
    predict as run_productivity_prediction,
)
from productivity_model.utils_recommend import (
    generate_recommendations,
)
from auth_database import get_user_by_id, save_prediction

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=False)

productivity_bp = Blueprint("productivity", __name__)


def get_optional_user_id():
    """Allow anonymous predictions; authenticate users when a token is supplied."""
    authorization = request.headers.get("Authorization", "").strip()

    if not authorization:
        return None

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise ValueError("Invalid authorization header.")

    secret = os.environ.get("STUDYSPARK_JWT_SECRET")
    if not secret:
        raise RuntimeError("StudySpark JWT secret is not configured.")

    payload = jwt.decode(
        parts[1],
        secret,
        algorithms=["HS256"],
    )

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        raise ValueError("Invalid authentication token.")

    user = get_user_by_id(user_id)
    if user is None:
        raise ValueError("User no longer exists.")

    return user["id"]


@productivity_bp.route("/api/productivity/predict", methods=["POST"])
def predict_productivity():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Please provide valid JSON input."}), 400

        numeric_fields = {
            "study_hours": (0, 12),
            "screen_time": (0, 12),
            "sleep_hours": (3, 12),
            "stress_level": (1, 10),
            "attendance": (0, 100),
        }

        values = {}

        for field, (minimum, maximum) in numeric_fields.items():
            try:
                value = float(data[field])
            except (KeyError, TypeError, ValueError):
                return jsonify({
                    "error": f"Enter a valid number for {field}."
                }), 400

            if not minimum <= value <= maximum:
                return jsonify({
                    "error": f"{field} must be between {minimum} and {maximum}."
                }), 400

            values[field] = value

        social_media = data.get("social_media_usage")
        multitasking = data.get("multitasking")

        if social_media not in ("Low", "Medium", "High"):
            return jsonify({
                "error": "Social media usage must be Low, Medium, or High."
            }), 400

        if multitasking not in ("Yes", "No"):
            return jsonify({
                "error": "Multitasking must be Yes or No."
            }), 400

        model_input = {
            **values,
            "social_media_usage": social_media,
        }

        prediction = run_new_productivity_prediction(model_input)

        recommendation_input = {
            **model_input,
            "multitasking": multitasking,
        }

        recommendations = generate_recommendations(recommendation_input)

        result = {
            "productivity_level": prediction["productivity_level"],
            "confidence_score": prediction["confidence_score"],
            "recommendations": recommendations,
        }

        # Save the prediction only when a valid logged-in user is supplied.
        try:
            user_id = get_optional_user_id()
        except jwt.ExpiredSignatureError:
            return jsonify({
                "error": "Session expired. Please log in again."
            }), 401
        except (jwt.InvalidTokenError, ValueError):
            return jsonify({
                "error": "Invalid or expired authentication token. Please log in again."
            }), 401

        if user_id is not None:
            prediction_inputs = {
                **values,
                "social_media_usage": social_media,
                "multitasking": multitasking,
            }

            saved = save_prediction(prediction_inputs, result, user_id)

            if saved is not None:
                result["prediction_id"] = saved

        return jsonify(result), 200

    except Exception:
        logging.exception("Productivity prediction failed")
        return jsonify({
            "error": (
                "Prediction failed. Check the StudySpark "
                "backend terminal for the detailed error."
            )
        }), 500
