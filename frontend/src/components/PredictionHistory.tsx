
import { useEffect, useState } from "react";
import "./PredictionHistory.css";

const API = "http://127.0.0.1:5000";

type Prediction = {
  id: number;
  study_hours: number;
  screen_time: number;
  sleep_hours: number;
  social_media_usage: string;
  multitasking: string;
  stress_level: number;
  attendance: number;
  productivity_level: string;
  confidence_score: number;
  recommendations: string[];
  created_at: string;
};

export default function PredictionHistory() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPredictions() {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("studyspark_token");

      if (!token) {
        setError("Please sign in again to view your prediction history.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API}/api/predictions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();

        if (response.status === 401) {
          localStorage.removeItem("studyspark_token");
          localStorage.removeItem("studyspark_user");
          throw new Error("Your session has expired. Please sign in again.");
        }

        if (!response.ok) {
          throw new Error(
            data.error || data.message || "Could not load prediction history."
          );
        }

        setPredictions(
          Array.isArray(data.predictions) ? data.predictions : []
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not connect to the StudySpark backend."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPredictions();

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="prediction-history-state">
          Loading your prediction history...
        </div>
      </div>
    );
  }

  return (
    <div className="page prediction-history-page">
      <div className="page-intro">
        <span className="section-kicker">YOUR PROGRESS</span>
        <h1>Prediction history</h1>
        <p>
          Review your previous productivity predictions and the habits
          associated with each result.
        </p>
      </div>

      {error && (
        <div className="prediction-history-state history-error" role="alert">
          {error}
          <p>Check that the backend is running and that you are signed in.</p>
        </div>
      )}

      {!error && predictions.length === 0 && (
        <div className="prediction-history-state">
          <h2>No predictions yet</h2>
          <p>
            Open Productivity Predictor and submit your study habits.
            Your saved predictions will appear here.
          </p>
        </div>
      )}

      {!error && predictions.length > 0 && (
        <>
          <div className="history-summary">
            <div className="history-summary-card">
              <span>Total predictions</span>
              <strong>{predictions.length}</strong>
            </div>
            <div className="history-summary-card">
              <span>Latest result</span>
              <strong>{predictions[0].productivity_level}</strong>
            </div>
          </div>

          <div className="prediction-history-list">
            {predictions.map((prediction) => (
              <article className="prediction-history-card" key={prediction.id}>
                <div className="history-card-header">
                  <div>
                    <span className="history-date">
                      {prediction.created_at
                        ? new Date(prediction.created_at).toLocaleString()
                        : "Date unavailable"}
                    </span>
                    <h2>{prediction.productivity_level} productivity</h2>
                  </div>

                  <span className="history-confidence">
                    {Number(prediction.confidence_score).toFixed(1)}% confidence
                  </span>
                </div>

                <div className="history-metrics">
                  <div>
                    <span>Study time</span>
                    <strong>{prediction.study_hours} hrs</strong>
                  </div>
                  <div>
                    <span>Screen time</span>
                    <strong>{prediction.screen_time} hrs</strong>
                  </div>
                  <div>
                    <span>Sleep</span>
                    <strong>{prediction.sleep_hours} hrs</strong>
                  </div>
                  <div>
                    <span>Attendance</span>
                    <strong>{prediction.attendance}%</strong>
                  </div>
                  <div>
                    <span>Stress</span>
                    <strong>{prediction.stress_level}/10</strong>
                  </div>
                  <div>
                    <span>Social media</span>
                    <strong>{prediction.social_media_usage}</strong>
                  </div>
                  <div>
                    <span>Multitasking</span>
                    <strong>{prediction.multitasking}</strong>
                  </div>
                </div>

                {Array.isArray(prediction.recommendations) &&
                  prediction.recommendations.length > 0 && (
                    <div className="history-recommendations">
                      <h3>Recommendations</h3>
                      <ul>
                        {prediction.recommendations.map((item, index) => (
                          <li key={`${prediction.id}-rec-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
