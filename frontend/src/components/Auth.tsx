
import { useState, type FormEvent } from "react";
import "./Auth.css";

const API = "http://127.0.0.1:5000";

// Choose: aurora | particles | bubbles | shooting-stars | fireflies
const ANIMATION = "particles";

type AuthUser = {
  id: number;
  name: string;
  email: string;
};

type AuthProps = {
  onAuthSuccess: (token: string, user: AuthUser) => void;
};

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? { name, email, password }
            : { email, password }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Authentication failed");
      }

      if (!data.token || !data.user) {
        throw new Error("Invalid authentication response");
      }

      onAuthSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`ss-auth-page ss-animation-${ANIMATION}`}>
      <div className="ss-animation-layer" aria-hidden="true">
        {Array.from({ length: 32 }, (_, index) => (
          <span
            key={index}
            className="ss-animation-particle"
            style={{
              "--i": index,
              "--x": `${(index * 37 + 13) % 100}%`,
              "--delay": `${(index * 0.67) % 12}s`,
              "--duration": `${7 + (index % 8)}s`,
              "--size": `${4 + (index % 6) * 3}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="ss-auth-content">
        <div className="ss-auth-brand">
          <div className="ss-auth-logo">
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path
                d="M24 13C17 9 10 10 5 12V35C12 35 16 32 24 37M24 13C31 9 38 10 43 12V35C43 35 32 32 24 37M24 13V37"
                stroke="currentColor"
                strokeWidth="2.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1>StudySpark AI</h1>
          <p>Smart Learning, Smarter You</p>
        </div>

        <div className="ss-auth-card">
          <div className="ss-auth-heading">
            <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
            <p>
              {mode === "login"
                ? "Sign in to continue your learning journey."
                : "Begin your smarter learning journey today."}
            </p>
          </div>

          <div className="ss-auth-switch">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create Account
            </button>
          </div>

          <form className="ss-auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full Name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                required
                minLength={6}
              />
            </label>

            {error && <p className="ss-auth-error" role="alert">{error}</p>}

            <button className="ss-auth-submit" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <p className="ss-auth-footer">
            {mode === "login" ? "New to StudySpark AI?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
