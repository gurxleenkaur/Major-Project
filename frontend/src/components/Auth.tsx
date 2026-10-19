import { useState, type FormEvent } from "react";
import "./Auth.css";

const API = "http://127.0.0.1:5000";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(mode === "register" ? { name: name.trim() } : {}),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Authentication failed. Please try again."
        );
      }

      if (!data.token || !data.user) {
        throw new Error("The server returned an invalid response.");
      }

      onAuthSuccess(data.token, data.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to StudySpark's backend."
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
  }

  return (
    <main className="ss-auth-page">
      <section
        className={`ss-auth-card ${
          mode === "register" ? "ss-auth-card-register" : ""
        }`}
      >
        {/* Brand */}
        <div className="ss-auth-brand">
          <div className="ss-auth-logo">S</div>

          <div>
            <span>
              StudySpark <strong>AI</strong>
            </span>

            <span className="ss-auth-tagline">
              Smart Learning, Smarter You
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="ss-auth-heading">
          <span className="ss-auth-eyebrow">
            YOUR PERSONAL LEARNING SPACE
          </span>

          <h1>
            {mode === "login"
              ? "Welcome back."
              : "Start learning smarter."}
          </h1>

          <p>
            {mode === "login"
              ? "Sign in to continue your learning journey."
              : "Create an account to access your StudySpark workspace."}
          </p>
        </div>

        {/* Login / registration switch */}
        <div className="ss-auth-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
            aria-pressed={mode === "login"}
          >
            Sign in
          </button>

          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => changeMode("register")}
            aria-pressed={mode === "register"}
          >
            Create account
          </button>
        </div>

        {/* Authentication form */}
        <form onSubmit={handleSubmit} className="ss-auth-form">
          {mode === "register" && (
            <label>
              Full name

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
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
              placeholder="At least 6 characters"
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </label>

          {error && (
            <p className="ss-auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="ss-auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in to StudySpark"
                : "Create my account"}

            {!loading && (
              <span aria-hidden="true">→</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="ss-auth-footer">
          Your learning workspace, all in one place.
        </p>
      </section>
    </main>
  );
}