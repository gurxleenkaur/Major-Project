
import json
import os
from datetime import datetime, timezone

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from werkzeug.security import generate_password_hash, check_password_hash


# =====================================================
# DATABASE CONFIGURATION
# =====================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATABASE_PATH = os.path.join(BASE_DIR, "studyspark_auth.db")

DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()


# =====================================================
# USER TABLE
# =====================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================
# PREDICTION HISTORY TABLE
# =====================================================

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    study_hours = Column(Float, nullable=False)
    screen_time = Column(Float, nullable=False)
    sleep_hours = Column(Float, nullable=False)
    social_media_usage = Column(String(20), nullable=False)
    multitasking = Column(String(10), nullable=False)
    stress_level = Column(Float, nullable=False)
    attendance = Column(Float, nullable=False)

    productivity_level = Column(String(50), nullable=False)
    confidence_score = Column(Float, nullable=False)
    recommendations = Column(Text, nullable=False, default="[]")

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# Create tables if they do not already exist.
Base.metadata.create_all(bind=engine)


# =====================================================
# USER FUNCTIONS
# =====================================================

def create_user(name, email, password):
    db = SessionLocal()

    try:
        name = name.strip()
        email = email.strip().lower()

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing_user:
            return None

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


def authenticate_user(email, password):
    db = SessionLocal()

    try:
        email = email.strip().lower()

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if user is None:
            return None

        if not check_password_hash(user.password_hash, password):
            return None

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }

    finally:
        db.close()


def get_user_by_id(user_id):
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == user_id).first()

        if user is None:
            return None

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }

    finally:
        db.close()


# =====================================================
# SAVE A PRODUCTIVITY PREDICTION
# =====================================================

def save_prediction(data, result, user_id):
    db = SessionLocal()

    try:
        prediction = Prediction(
            user_id=user_id,
            study_hours=data["study_hours"],
            screen_time=data["screen_time"],
            sleep_hours=data["sleep_hours"],
            social_media_usage=data["social_media_usage"],
            multitasking=data["multitasking"],
            stress_level=data["stress_level"],
            attendance=data["attendance"],
            productivity_level=result["productivity_level"],
            confidence_score=result["confidence_score"],
            recommendations=json.dumps(
                result.get("recommendations", [])
            ),
        )

        db.add(prediction)
        db.commit()
        db.refresh(prediction)

        return prediction.id

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# =====================================================
# GET PREDICTIONS FOR ONE USER
# =====================================================

def get_predictions(user_id):
    db = SessionLocal()

    try:
        predictions = (
            db.query(Prediction)
            .filter(Prediction.user_id == user_id)
            .order_by(Prediction.created_at.desc())
            .all()
        )

        results = []

        for prediction in predictions:
            results.append({
                "id": prediction.id,
                "study_hours": prediction.study_hours,
                "screen_time": prediction.screen_time,
                "sleep_hours": prediction.sleep_hours,
                "social_media_usage": prediction.social_media_usage,
                "multitasking": prediction.multitasking,
                "stress_level": prediction.stress_level,
                "attendance": prediction.attendance,
                "productivity_level": prediction.productivity_level,
                "confidence_score": prediction.confidence_score,
                "recommendations": json.loads(
                    prediction.recommendations or "[]"
                ),
                "created_at": (
                    prediction.created_at.isoformat()
                    if prediction.created_at
                    else None
                ),
            })

        return results

    finally:
        db.close()
