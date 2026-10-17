import os
import joblib
import pandas as pd
import numpy as np


# =========================================================
# Global model artifacts
# =========================================================

model = None
encoder = None
scaler = None


# =========================================================
# Load saved ML artifacts
# =========================================================

def load_artifacts():
    global model, encoder, scaler

    base_dir = os.path.dirname(os.path.abspath(__file__))

    model_path = os.path.join(base_dir, "model.pkl")
    encoder_path = os.path.join(base_dir, "encoder.pkl")
    scaler_path = os.path.join(base_dir, "scaler.pkl")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file not found: {model_path}"
        )

    if not os.path.exists(encoder_path):
        raise FileNotFoundError(
            f"Encoder file not found: {encoder_path}"
        )

    if not os.path.exists(scaler_path):
        raise FileNotFoundError(
            f"Scaler file not found: {scaler_path}"
        )

    model = joblib.load(model_path)
    encoder = joblib.load(encoder_path)
    scaler = joblib.load(scaler_path)

    print("Model artifacts loaded successfully.")


# =========================================================
# Calculate confidence from decision function
# =========================================================

def calculate_confidence(input_df):
    """
    Calculates a confidence-like percentage.

    The saved LogisticRegression model was created with a
    different scikit-learn version. Therefore predict_proba()
    may fail because of the multi_class compatibility issue.

    We first try predict_proba().
    If that fails, we use decision_function() and convert
    the scores to normalized probabilities using softmax.
    """

    global model

    # -----------------------------------------------------
    # Method 1: predict_proba
    # -----------------------------------------------------

    try:

        if hasattr(model, "predict_proba"):

            probabilities = model.predict_proba(input_df)

            confidence = float(
                np.max(probabilities[0])
            ) * 100

            return round(confidence, 2)

    except Exception as e:

        print(
            "predict_proba unavailable:",
            str(e)
        )

    # -----------------------------------------------------
    # Method 2: decision_function
    # -----------------------------------------------------

    try:

        if hasattr(model, "decision_function"):

            scores = model.decision_function(input_df)

            scores = np.asarray(scores)

            # Binary LogisticRegression can return a single
            # decision score. Convert it into two class scores.
            if scores.ndim == 1:

                score = float(scores[0])

                class_scores = np.array([
                    -score,
                    score
                ])

            else:

                class_scores = scores[0]

            # Prevent numerical overflow.
            class_scores = (
                class_scores -
                np.max(class_scores)
            )

            exp_scores = np.exp(class_scores)

            probabilities = (
                exp_scores /
                np.sum(exp_scores)
            )

            confidence = float(
                np.max(probabilities)
            ) * 100

            return round(confidence, 2)

    except Exception as e:

        print(
            "decision_function confidence failed:",
            str(e)
        )

    # -----------------------------------------------------
    # Fallback
    # -----------------------------------------------------

    return 0.0


# =========================================================
# Main prediction function
# =========================================================

def predict(input_data):
    """
    input_data:
        Dictionary received from the frontend.

    Expected fields:
        study_hours
        screen_time
        sleep_hours
        social_media_usage
        stress_level
        attendance

    Returns:
        productivity_level
        confidence_score
    """

    global model, encoder, scaler

    # -----------------------------------------------------
    # Load artifacts if necessary
    # -----------------------------------------------------

    if model is None:
        load_artifacts()

    if model is None:

        return {
            "productivity_level": "Unknown",
            "confidence_score": 0.0
        }

    # -----------------------------------------------------
    # Expected features
    # -----------------------------------------------------

    expected_features = [
        "study_hours",
        "screen_time",
        "sleep_hours",
        "social_media_usage",
        "stress_level",
        "attendance"
    ]

    # -----------------------------------------------------
    # Create input row
    # -----------------------------------------------------

    row = {}

    for feature in expected_features:

        value = input_data.get(feature, 0)

        row[feature] = [value]

    df_input = pd.DataFrame(row)

    print(
        "Raw input:",
        df_input.to_dict(orient="records")[0]
    )

    # -----------------------------------------------------
    # Encode categorical columns
    # -----------------------------------------------------

    if encoder:

        for col, label_encoder in encoder.items():

            if col not in df_input.columns:
                continue

            value = df_input[col].iloc[0]

            # Convert unknown category to first known class.
            if value not in label_encoder.classes_:

                print(
                    f"Unknown value '{value}' for {col}. "
                    f"Using '{label_encoder.classes_[0]}' instead."
                )

                value = label_encoder.classes_[0]

            encoded_value = label_encoder.transform(
                [value]
            )[0]

            df_input[col] = [encoded_value]

    # -----------------------------------------------------
    # Scale numerical features
    # -----------------------------------------------------

    if scaler:

        numerical_columns = [
            "study_hours",
            "screen_time",
            "sleep_hours",
            "stress_level",
            "attendance"
        ]

        available_columns = [
            col
            for col in numerical_columns
            if col in df_input.columns
        ]

        if available_columns:

            df_input[available_columns] = (
                scaler.transform(
                    df_input[available_columns]
                )
            )

    print(
        "Processed input:",
        df_input.to_dict(orient="records")[0]
    )

    # -----------------------------------------------------
    # Make prediction
    # -----------------------------------------------------

    try:

        prediction = model.predict(df_input)

    except AttributeError as e:

        # Compatibility fix for LogisticRegression models
        # saved using newer scikit-learn versions.

        if "multi_class" in str(e):

            print(
                "Detected LogisticRegression "
                "multi_class compatibility issue."
            )

            # Add a compatible value dynamically.
            try:

                model.__dict__["multi_class"] = "auto"

                prediction = model.predict(
                    df_input
                )

            except Exception as retry_error:

                print(
                    "Prediction retry failed:",
                    str(retry_error)
                )

                raise

        else:

            raise

    # -----------------------------------------------------
    # Calculate confidence
    # -----------------------------------------------------

    confidence = calculate_confidence(
        df_input
    )

    # -----------------------------------------------------
    # Extract predicted class
    # -----------------------------------------------------

    pred_level = prediction[0]

    print(
        "Prediction:",
        pred_level
    )

    print(
        "Confidence:",
        confidence
    )

    # -----------------------------------------------------
    # Return result
    # -----------------------------------------------------

    return {
        "productivity_level": str(pred_level),
        "confidence_score": confidence
    }