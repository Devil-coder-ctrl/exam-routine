import { useState } from "react";
import { auth } from "./firebase";
import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import Footer from "./Footer";
import { rememberOn, forgetSession } from "./session";

const messages = {
  "auth/invalid-credential":
    "Email or password is wrong. If you are new, create an account first.",
  "auth/email-already-in-use":
    "This email already has an account. Log in instead.",
  "auth/weak-password": "Use at least 8 characters for the password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "No internet connection. Try again.",
};

const LogoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="17" rx="3" />
    <path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4" />
  </svg>
);

const Sample = ({ tone, day, month, code, line, when }) => (
  <article className={`tile tone-${tone}`}>
    <div className="tile-date">
      <span className="day">{day}</span>
      <span className="month">{month}</span>
    </div>
    <div className="tile-body">
      <h3>{code}</h3>
      <p>{line}</p>
    </div>
    <span className="when">{when}</span>
  </article>
);

export default function Login({ notice = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      // Tick dile browser e thakbe (5 minute rule shoho), na dile tab bondho korle logout
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence,
      );
      if (remember) rememberOn();
      else forgetSession();

      if (isNew) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        try {
          await sendEmailVerification(cred.user);
        } catch {
          /* resend button is on the next screen */
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      forgetSession();
      setError(messages[err.code] || "Something went wrong. Try again.");
    }
    setBusy(false);
  };

  const reset = async () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Enter your email first, then press Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      if (err.code === "auth/too-many-requests") {
        setError(messages[err.code]);
        return;
      }
    }
    setInfo(
      "If an account exists for this email, a reset link has been sent. Check your spam folder too.",
    );
  };

  const shownInfo = info || notice;

  return (
    <div className="auth">
      <section className="auth-side">
        <div className="logo-row">
          <span className="logo">
            <LogoIcon />
          </span>
          <span>Exam Routine</span>
        </div>

        <h1>Never miss an exam date</h1>
        <p>
          Search a course code and see the date, day, time, room, and how much
          time is left.
        </p>

        <div className="stack" aria-hidden="true">
          <Sample
            tone="later"
            day="8"
            month="Dec 2026"
            code="MAT102"
            line="Tuesday, 10:00 AM, Room 305"
            when="In 13 days"
          />
          <Sample
            tone="soon"
            day="1"
            month="Dec 2026"
            code="ENG201"
            line="Tuesday, 02:00 PM, Room 210"
            when="In 6 days"
          />
          <Sample
            tone="later"
            day="6"
            month="Dec 2026"
            code="CSE101"
            line="Sunday, 10:00 AM, Room 301"
            when="In 11 days"
          />
        </div>
      </section>

      <main className="auth-main">
        <div className="auth-col">
          <form
            className="auth-card"
            key={isNew ? "signup" : "login"}
            onSubmit={submit}
          >
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
            {shownInfo && (
              <p className="notice" role="status">
                {shownInfo}
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
                required
                minLength={isNew ? 8 : undefined}
                autoComplete={isNew ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div className="row-opts">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              {!isNew && (
                <button type="button" className="link-btn" onClick={reset}>
                  Forgot password?
                </button>
              )}
            </div>
            <p className="hint">
              Stay signed in if you come back within 5 minutes. Do not tick this
              on a shared computer.
            </p>

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
                  setInfo("");
                }}
              >
                {isNew ? "Log in" : "Create an account"}
              </button>
            </p>
          </form>

          <Footer />
        </div>
      </main>
    </div>
  );
}
