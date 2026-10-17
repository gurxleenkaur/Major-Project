
import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import (
    OneHotEncoder,
    StandardScaler,
    LabelEncoder,
)
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report


# =========================================================
# Paths
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset.csv"

# Separate output directory: never overwrite the live model.
OUTPUT_DIR = BASE_DIR / "training_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = OUTPUT_DIR / "model_pipeline.joblib"
TARGET_ENCODER_PATH = OUTPUT_DIR / "target_encoder.joblib"
METRICS_PATH = OUTPUT_DIR / "training_metrics.json"


# =========================================================
# Load and validate dataset
# =========================================================

if not DATASET_PATH.exists():
    raise FileNotFoundError(
        f"Dataset not found: {DATASET_PATH}\n"
        "Place dataset.csv beside train_model.py."
    )

df = pd.read_csv(DATASET_PATH)

required_columns = [
    "study_hours_per_day",
    "phone_usage_hours",
    "youtube_hours",
    "gaming_hours",
    "social_media_hours",
    "sleep_hours",
    "stress_level",
    "attendance_percentage",
    "productivity_score",
]

missing = [col for col in required_columns if col not in df.columns]

if missing:
    raise ValueError(
        f"Dataset is missing required columns: {missing}\n"
        f"Available columns: {df.columns.tolist()}"
    )

# Convert required columns to numeric values.
for col in required_columns:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Remove rows with missing or invalid required values.
df = df.dropna(subset=required_columns).copy()

if df.empty:
    raise ValueError("No valid rows remain after cleaning the dataset.")


# =========================================================
# Feature engineering
# =========================================================

df["study_hours"] = df["study_hours_per_day"]

df["screen_time"] = (
    df["phone_usage_hours"]
    + df["youtube_hours"]
    + df["gaming_hours"]
    + df["social_media_hours"]
)

df["social_media_usage"] = np.select(
    [
        df["social_media_hours"] >= 5,
        df["social_media_hours"] >= 2,
    ],
    [
        "High",
        "Medium",
    ],
    default="Low",
)

# Match the target definitions from Lifewise.
df["productivity_level"] = np.select(
    [
        df["productivity_score"] >= 65,
        df["productivity_score"] >= 40,
    ],
    [
        "High",
        "Medium",
    ],
    default="Low",
)


# =========================================================
# Prepare features and target
# =========================================================

feature_names = [
    "study_hours",
    "screen_time",
    "sleep_hours",
    "social_media_usage",
    "stress_level",
    "attendance",
]

df["attendance"] = df["attendance_percentage"]

numeric_features = [
    "study_hours",
    "screen_time",
    "sleep_hours",
    "stress_level",
    "attendance",
]

categorical_features = ["social_media_usage"]

X = df[feature_names].copy()
y = df["productivity_level"].copy()

if y.nunique() < 2:
    raise ValueError(
        "At least two productivity classes are required for training."
    )

# Stratification preserves class proportions in both splits.
class_counts = y.value_counts()

stratify_target = (
    y if len(class_counts) > 1 and class_counts.min() >= 2
    else None
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=stratify_target,
)

# Fit target encoding on training labels only.
target_encoder = LabelEncoder()
y_train_encoded = target_encoder.fit_transform(y_train)

# Use the same fitted target encoder for test labels.
y_test_encoded = target_encoder.transform(y_test)


# =========================================================
# Preprocessing
# =========================================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "numeric",
            StandardScaler(),
            numeric_features,
        ),
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features,
        ),
    ],
)


# =========================================================
# Candidate models
# =========================================================

models = {
    "Logistic Regression": LogisticRegression(
        max_iter=2000,
        random_state=42,
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    ),
}

# XGBoost is optional. The other models can still be trained
# if XGBoost is not installed.
try:
    from xgboost import XGBClassifier

    models["XGBoost"] = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )

except ImportError:
    print("XGBoost is not installed; skipping that model.")


# =========================================================
# Train and evaluate
# =========================================================

results = {}
best_pipeline = None
best_name = None
best_accuracy = -1.0

print(f"\nValid dataset rows: {len(df)}")
print(f"Training rows: {len(X_train)}")
print(f"Testing rows: {len(X_test)}")
print(f"Productivity classes: {list(target_encoder.classes_)}")
print("\nTraining candidate models...\n")

for name, classifier in models.items():
    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    # Each candidate gets its own fitted preprocessing pipeline.
    pipeline.fit(X_train, y_train_encoded)

    predictions = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test_encoded, predictions)

    results[name] = {
        "accuracy": round(float(accuracy), 4),
    }

    print(f"{name}: {accuracy:.4f}")

    print(
        classification_report(
            y_test_encoded,
            predictions,
            labels=np.arange(len(target_encoder.classes_)),
            target_names=target_encoder.classes_,
            zero_division=0,
        )
    )

    if accuracy > best_accuracy:
        best_accuracy = accuracy
        best_name = name
        best_pipeline = pipeline


# =========================================================
# Save NEW artifacts only
# =========================================================

joblib.dump(best_pipeline, MODEL_PATH)
joblib.dump(target_encoder, TARGET_ENCODER_PATH)

metrics = {
    "best_model": best_name,
    "test_accuracy": round(float(best_accuracy), 4),
    "dataset_rows": int(len(df)),
    "training_rows": int(len(X_train)),
    "testing_rows": int(len(X_test)),
    "feature_names": feature_names,
    "numeric_features": numeric_features,
    "categorical_features": categorical_features,
    "target_classes": target_encoder.classes_.tolist(),
    "candidate_results": results,
}

with open(METRICS_PATH, "w", encoding="utf-8") as file:
    json.dump(metrics, file, indent=4)

print("\nTraining complete.")
print(f"Best model: {best_name}")
print(f"Test accuracy: {best_accuracy:.4f}")
print(f"New pipeline: {MODEL_PATH}")
print(f"Target encoder: {TARGET_ENCODER_PATH}")
print(f"Metrics: {METRICS_PATH}")
print("\nExisting StudySpark model artifacts were not modified.")
