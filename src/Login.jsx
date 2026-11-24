import { useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const messages = {
  "auth/invalid-credential":
    "Email or password is wrong. If you are new, create an account first.",
  "auth/email-already-in-use":
    "This email already has an account. Log in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/invalid-email": "Enter a valid email address.",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isNew) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(messages[err.code] || "Something went wrong. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="auth">
      <section className="auth-side">
        <h1>Your exam routine, one search away</h1>
        <p>
          Log in with your email, enter your roll number, and see every exam
          with its date, time, and room.
        </p>

        <article className="tile" aria-hidden="true">
          <div className="tile-date">
            <span className="day">6</span>
            <span className="month">Dec</span>
          </div>
          <div className="tile-body" style={{ color: "#10243e" }}>
            <h3>CSE101</h3>
            <p>Sunday, 10:00 AM, Room 301</p>
          </div>
          <span className="when">In 12 days</span>
        </article>
      </section>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit}>
          <h2>{isNew ? "Create your account" : "Welcome back"}</h2>
          <p className="sub">
            {isNew
              ? "Sign up once, then search any time."
              : "Log in to see your exam routine."}
          </p>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              minLength={6}
              required
              autoComplete={isNew ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Please wait..." : isNew ? "Create account" : "Log in"}
          </button>

          <p className="switch">
            {isNew ? "Already have an account? " : "New here? "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setIsNew(!isNew);
                setError("");
              }}
            >
              {isNew ? "Log in" : "Create an account"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
