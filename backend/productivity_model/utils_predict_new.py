
from pathlib import Path

import joblib
import pandas as pd


# Locate the newly trained model without touching the old artifacts.
BASE_DIR = Path(__file__).resolve().parent
TRAINING_DIR = (
    BASE_DIR.parent
    / "productivity_training"
    / "training_output"
)

PIPELINE_PATH = TRAINING_DIR / "model_pipeline.joblib"
ENCODER_PATH = TRAINING_DIR / "target_encoder.joblib"

model = None
target_encoder = None


def load_new_artifacts():
    """Load the new pipeline and its target-label encoder."""
    global model, target_encoder

    if not PIPELINE_PATH.exists():
        raise FileNotFoundError(
            f"New model pipeline not found: {PIPELINE_PATH}"
        )

    if not ENCODER_PATH.exists():
        raise FileNotFoundError(
            f"Target encoder not found: {ENCODER_PATH}"
        )

    model = joblib.load(PIPELINE_PATH)
    target_encoder = joblib.load(ENCODER_PATH)

    print("New productivity pipeline loaded successfully.")


def predict(input_data):
    """
    Predict productivity using the new trained pipeline.

    Expected fields:
        study_hours
        screen_time
        sleep_hours
        social_media_usage
        stress_level
        attendance
    """
    global model, target_encoder

    if model is None or target_encoder is None:
        load_new_artifacts()

    expected_features = [
        "study_hours",
        "screen_time",
        "sleep_hours",
        "social_media_usage",
        "stress_level",
        "attendance",
    ]

    missing = [
        feature
        for feature in expected_features
        if feature not in input_data
    ]

    if missing:
        raise ValueError(
            f"Missing prediction features: {', '.join(missing)}"
        )

    # Keep raw input values. The pipeline performs preprocessing itself.
    input_df = pd.DataFrame(
        [{feature: input_data[feature]
          for feature in expected_features}],
        columns=expected_features,
    )

    encoded_prediction = model.predict(input_df)
    productivity_level = target_encoder.inverse_transform(
        encoded_prediction.astype(int)
    )[0]

    confidence_score = 0.0

    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(input_df)[0]
        confidence_score = round(
            float(max(probabilities)) * 100,
            2,
        )

    return {
        "productivity_level": str(productivity_level),
        "confidence_score": confidence_score,
    }
