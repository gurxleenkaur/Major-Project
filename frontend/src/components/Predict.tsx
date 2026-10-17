import type { CSSProperties } from "react";
import { useState } from "react";

import "./Predict.css";

import {
  Activity,
  Brain,
  CheckCircle2,
  Moon,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  BarChart3,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface PredictionResult {
  productivity_level: string;
  confidence_score: number;
  recommendations: string[];
  prediction_id?: number;
}

const Predict = () => {
  
  // USER INPUTS
  

  const [studyHours, setStudyHours] = useState(4);

  const [screenTime, setScreenTime] = useState(3);

  const [sleepHours, setSleepHours] = useState(7);

  const [socialMediaUsage, setSocialMediaUsage] =
    useState("Medium");

  const [multitasking, setMultitasking] =
    useState("Yes");

  const [stressLevel, setStressLevel] =
    useState(5);

  const [attendance, setAttendance] =
    useState(85);

  
  // STATE
  

  const [result, setResult] =
    useState<PredictionResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  
  // PREDICT
  

  const handlePredict = async () => {
    setLoading(true);
    setError("");

    try {
    
      
      // SEND PREDICTION REQUEST
      

      
const token = localStorage.getItem("studyspark_token");

const response = await fetch(
  "http://127.0.0.1:5000/api/productivity/predict",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      study_hours: studyHours,
      screen_time: screenTime,
      sleep_hours: sleepHours,
      social_media_usage: socialMediaUsage,
      multitasking,
      stress_level: stressLevel,
      attendance,
    }),
  }
);

    const data = await response.json();

if (response.status === 401) {
  localStorage.removeItem("studyspark_token");
  localStorage.removeItem("studyspark_user");

  throw new Error(
    "Your session has expired. Please log in again."
  );
}

if (!response.ok) {
  throw new Error(data?.error || "Prediction failed.");
}
      
      // FOR DASHBOARD
      
      const predictionData = {
        ...data,

        habits: {
          studyHours,

          screenTime,

          sleepHours,

          stressLevel,

          attendance,

          socialMediaUsage,

          multitasking,
        },
      };

      // UPDATE RESULT
      

      setResult(data);

      // SAVE LATEST PREDICTION LOCALLY

      localStorage.setItem(
        "studyspark_prediction",
        JSON.stringify(
          predictionData
        )
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the prediction service."
      );
    } finally {
      setLoading(false);
    }
  };

  // RESET
  

  const resetPrediction = () => {
    setResult(null);
    setError("");
  };
  
  // LEVEL CLASS
  
  const getLevelClass = () => {
    if (!result) {
      return "";
    }

    const level =
      result.productivity_level.toLowerCase();

    if (level.includes("high")) {
      return "high";
    }

    if (level.includes("low")) {
      return "low";
    }

    return "medium";
  };

  // =====================================================
  // LEVEL TEXT
  // =====================================================

  const getLevelTitle = () => {
    if (!result) {
      return "";
    }

    const level =
      result.productivity_level.toLowerCase();

    if (level.includes("high")) {
      return "Highly Productive";
    }

    if (level.includes("low")) {
      return "Needs Improvement";
    }

    return "Moderately Productive";
  };

  // =====================================================
  // CONFIDENCE
  // =====================================================

  const confidence = result
    ? Math.min(
        100,
        Math.max(
          0,
          result.confidence_score
        )
      )
    : 0;

  // =====================================================
  // RETURN
  // =====================================================

  return (
    <div className="lw-predict-page">

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="lw-bg-glow lw-glow-one" />

      <div className="lw-bg-glow lw-glow-two" />

      <div className="lw-bg-glow lw-glow-three" />

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="lw-header">

        <div className="lw-eyebrow">

          <Sparkles size={14} />

          AI POWERED ANALYSIS

        </div>

        <h1>
          Productivity Predictor
        </h1>

        <p className="lw-subtitle">
          Understand your daily habits and discover
          how they affect your productivity.
        </p>

      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="lw-main-layout">

        {/* =================================================
            LEFT — HABITS
        ================================================= */}

        <section className="lw-habits-panel">

          {/* SECTION HEADING */}

          <div className="lw-section-heading">

            <div className="lw-section-icon">

              <Activity size={20} />

            </div>

            <div>

              <h2>
                Your Daily Habits
              </h2>

              <p>
                Tell us about your typical day
              </p>

            </div>

          </div>

          {/* =================================================
              INPUT GRID
          ================================================= */}

          <div className="lw-input-grid">

            {/* ================= STUDY ================= */}

            <div className="lw-input-card study-card">

              <div className="lw-input-top">

                <div className="lw-input-icon">

                  <Brain size={20} />

                </div>

                <div>

                  <h3>
                    Study Hours
                  </h3>

                  <span>
                    Per day
                  </span>

                </div>

                <strong>
                  {studyHours}h
                </strong>

              </div>

              <input
                type="range"
                min="0"
                max="12"
                value={studyHours}
                onChange={(e) =>
                  setStudyHours(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <div className="lw-range-labels">

                <span>
                  0h
                </span>

                <span>
                  6h
                </span>

                <span>
                  12h
                </span>

              </div>

            </div>

            {/* ================= SCREEN ================= */}

            <div className="lw-input-card screen-card">

              <div className="lw-input-top">

                <div className="lw-input-icon">

                  <Smartphone size={20} />

                </div>

                <div>

                  <h3>
                    Screen Time
                  </h3>

                  <span>
                    Per day
                  </span>

                </div>

                <strong>
                  {screenTime}h
                </strong>

              </div>

              <input
                type="range"
                min="0"
                max="12"
                value={screenTime}
                onChange={(e) =>
                  setScreenTime(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <div className="lw-range-labels">

                <span>
                  0h
                </span>

                <span>
                  6h
                </span>

                <span>
                  12h
                </span>

              </div>

            </div>

            {/* ================= SLEEP ================= */}

            <div className="lw-input-card sleep-card">

              <div className="lw-input-top">

                <div className="lw-input-icon">

                  <Moon size={20} />

                </div>

                <div>

                  <h3>
                    Sleep
                  </h3>

                  <span>
                    Per night
                  </span>

                </div>

                <strong>
                  {sleepHours}h
                </strong>

              </div>

              <input
                type="range"
                min="3"
                max="12"
                value={sleepHours}
                onChange={(e) =>
                  setSleepHours(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <div className="lw-range-labels">

                <span>
                  3h
                </span>

                <span>
                  7h
                </span>

                <span>
                  12h
                </span>

              </div>

            </div>

            {/* ================= STRESS ================= */}

            <div className="lw-input-card stress-card">

              <div className="lw-input-top">

                <div className="lw-input-icon">

                  <Target size={20} />

                </div>

                <div>

                  <h3>
                    Stress Level
                  </h3>

                  <span>
                    How stressed do you feel?
                  </span>

                </div>

                <strong>
                  {stressLevel}/10
                </strong>

              </div>

              <input
                type="range"
                min="1"
                max="10"
                value={stressLevel}
                onChange={(e) =>
                  setStressLevel(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <div className="lw-range-labels">

                <span>
                  Relaxed
                </span>

                <span>
                  Moderate
                </span>

                <span>
                  Very stressed
                </span>

              </div>

            </div>

            {/* ================= SOCIAL MEDIA ================= */}

            <div className="lw-input-card option-card">

              <div className="lw-option-heading">

                <div>

                  <h3>
                    Social Media Usage
                  </h3>

                  <span>
                    Daily usage level
                  </span>

                </div>

                <div className="lw-mini-dot purple" />

              </div>

              <div className="lw-options">

                {[
                  "Low",
                  "Medium",
                  "High",
                ].map((option) => (

                  <button
                    type="button"
                    key={option}
                    className={
                      socialMediaUsage === option
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSocialMediaUsage(
                        option
                      )
                    }
                  >
                    {option}
                  </button>

                ))}

              </div>

            </div>

            {/* ================= MULTITASKING ================= */}

            <div className="lw-input-card option-card">

              <div className="lw-option-heading">

                <div>

                  <h3>
                    Multitasking
                  </h3>

                  <span>
                    Do you multitask while studying?
                  </span>

                </div>

                <div className="lw-mini-dot blue" />

              </div>

              <div className="lw-options two">

                {[
                  "No",
                  "Yes",
                ].map((option) => (

                  <button
                    type="button"
                    key={option}
                    className={
                      multitasking === option
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setMultitasking(
                        option
                      )
                    }
                  >
                    {option}
                  </button>

                ))}

              </div>

            </div>

            {/* ================= ATTENDANCE ================= */}

            <div className="lw-input-card attendance-card">

              <div className="lw-input-top">

                <div className="lw-input-icon">

                  <CheckCircle2 size={20} />

                </div>

                <div>

                  <h3>
                    Attendance
                  </h3>

                  <span>
                    College attendance
                  </span>

                </div>

                <strong>
                  {attendance}%
                </strong>

              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={attendance}
                onChange={(e) =>
                  setAttendance(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <div className="lw-range-labels">

                <span>
                  0%
                </span>

                <span>
                  50%
                </span>

                <span>
                  100%
                </span>

              </div>

            </div>

          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (

            <div className="lw-error">

              <span>
                ⚠
              </span>

              <span>
                {error}
              </span>

            </div>

          )}

          {/* =================================================
              PREDICT BUTTON
          ================================================= */}

          <button
            type="button"
            className="lw-predict-button"
            onClick={handlePredict}
            disabled={loading}
          >

            {loading ? (

              <>

                <span className="lw-spinner" />

                Analyzing Your Habits...

              </>

            ) : (

              <>

                <Sparkles size={19} />

                Predict My Productivity

              </>

            )}

          </button>

        </section>

        {/* =================================================
            RIGHT — AI RESULT
        ================================================= */}

        <aside
          className={`lw-result-panel ${
            result ? "has-result" : ""
          }`}
        >

          {/* =================================================
              RESULT HEADER
          ================================================= */}

          <div className="lw-result-header">

            <div className="lw-result-icon">

              <TrendingUp size={19} />

            </div>

            <div>

              <span>
                AI PRODUCTIVITY ANALYSIS
              </span>

              <p>
                Machine learning assessment
              </p>

            </div>

          </div>

          {/* =================================================
              EMPTY STATE
          ================================================= */}

          {!result ? (

            <div className="lw-result-empty">

              <div className="lw-orb">

                <Brain size={42} />

              </div>

              <h2>
                Ready to Analyze
              </h2>

              <p>
                Adjust your daily habits on the
                left and let AI predict your
                productivity level.
              </p>

              <div className="lw-empty-points">

                <div>

                  <span>
                    01
                  </span>

                  <p>
                    Enter your habits
                  </p>

                </div>

                <div>

                  <span>
                    02
                  </span>

                  <p>
                    Run AI analysis
                  </p>

                </div>

                <div>

                  <span>
                    03
                  </span>

                  <p>
                    Get personalized insights
                  </p>

                </div>

              </div>

              <div className="lw-ready-badge">

                <ShieldCheck size={14} />

                ML MODEL READY

              </div>

            </div>

          ) : (

            /* =================================================
               RESULT STATE
            ================================================= */

            <div className="lw-result-content">

              {/* =================================================
                  MAIN CONFIDENCE RING
              ================================================= */}

              <div className="lw-productivity-score">

                <div
                  className="lw-score-ring"
                  style={
                    {
                      "--confidence":
                        `${confidence}%`,
                    } as CSSProperties
                  }
                >

                  <div className="lw-score-inner">

                    <BarChart3 size={21} />

                    <span className="lw-score-number">
                      {confidence.toFixed(0)}
                    </span>

                    <small>
                      % confidence
                    </small>

                  </div>

                </div>

                <p className="lw-score-caption">
                  AI MODEL CONFIDENCE
                </p>

              </div>

              {/* =================================================
                  CONFIDENCE MINI CARD
              ================================================= */}

              <div className="lw-confidence-card">

                <div className="lw-confidence-icon">

                  <Zap size={16} />

                </div>

                <div>

                  <span>
                    PREDICTION CERTAINTY
                  </span>

                  <strong>
                    {result.confidence_score.toFixed(2)}%
                  </strong>

                </div>

              </div>

              {/* =================================================
                  PRODUCTIVITY LEVEL
              ================================================= */}

              <div className="lw-prediction-section">

                <div className="lw-predicted-label">

                  PREDICTED PRODUCTIVITY LEVEL

                </div>

                <h2
                  className={`lw-level ${getLevelClass()}`}
                >
                  {getLevelTitle()}
                </h2>

                <div
                  className={`lw-category ${getLevelClass()}`}
                >
                  {result.productivity_level}
                </div>

              </div>

              {/* =================================================
                  RECOMMENDATIONS
              ================================================= */}

              <div className="lw-recommendations">

                <div className="lw-rec-header">

                  <div className="lw-rec-icon">

                    <Sparkles size={17} />

                  </div>

                  <div>

                    <h3>
                      Personalized Insights
                    </h3>

                    <p>
                      AI-generated recommendations
                      based on your habits.
                    </p>

                  </div>

                </div>

                <div className="lw-rec-list">

                  {result.recommendations.map(
                    (recommendation, index) => (

                      <div
                        className="lw-recommendation"
                        key={index}
                      >

                        <span>
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <p>
                          {recommendation}
                        </p>

                      </div>

                    )
                  )}

                </div>

              </div>

              {/* =================================================
                  RESET
              ================================================= */}

              <button
                type="button"
                className="lw-reset-button"
                onClick={
                  resetPrediction
                }
              >

                <RotateCcw size={15} />

                Try Another Prediction

              </button>

            </div>

          )}

        </aside>

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer className="lw-footer">

        <span>

          <ShieldCheck size={11} />

        </span>

        Built using Machine Learning for
        Academic Productivity Enhancement

      </footer>

    </div>
  );
};

export default Predict;