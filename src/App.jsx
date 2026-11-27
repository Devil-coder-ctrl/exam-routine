import { useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import Login from "./Login";
import Search from "./Search";
import Upload from "./Upload";
import Footer from "./Footer";
import InstallApp from "./InstallApp";
import { touch, sessionExpired, forgetSession } from "./session";

const ADMIN_EMAIL = "rahidahmedrokon60@gmail.com"; // shudhu button dekhanor jonno, asol lock Firestore rules e
const AWAY_MESSAGE = "You were away for a while, so please log in again.";

function VerifyEmail({ user, onDone, onLogout }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setMsg("");
    try {
      await user.reload();
      await user.getIdToken(true);
      if (user.emailVerified) onDone();
      else
        setMsg(
          "Not verified yet. Open the link in the email, then press this button again.",
        );
    } catch {
      setMsg("Could not check. Try again.");
    }
    setBusy(false);
  };

  const resend = async () => {
    setMsg("");
    try {
      await sendEmailVerification(user);
      setMsg("Verification email sent. Check your inbox and spam folder.");
    } catch (err) {
      setMsg(
        err.code === "auth/too-many-requests"
          ? "Please wait a few minutes before asking again."
          : "Could not send the email. Try again.",
      );
    }
  };

  return (
    <div className="verify">
      <div className="auth-card">
        <h2>Verify your email</h2>
        <p className="sub">
          We sent a link to <strong>{user.email}</strong>. Open it, then come
          back here.
        </p>
        {msg && (
          <p className="notice" role="status">
            {msg}
          </p>
        )}
        <div className="gap">
          <button className="btn" onClick={check} disabled={busy}>
            {busy ? "Checking..." : "I have verified"}
          </button>
          <button className="btn ghost" onClick={resend}>
            Send the email again
          </button>
          <button className="btn ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState(null); // user er upload kora file { name, rows }
  const [notice, setNotice] = useState("");
  const [, setTick] = useState(0);

  // Site kholar shomoy: remember me er 5 minute shesh hoye thakle logout kore dao
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u && sessionExpired()) {
        forgetSession();
        setLocal(null);
        setNotice(AWAY_MESSAGE);
        await signOut(auth);
        return; // signOut er por abar eta null user diye cholbe
      }
      if (u) {
        touch();
        setNotice("");
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Site khola thakle "ekhon-o achi" shomoy update koro, ar fire ashle check koro
  useEffect(() => {
    if (!user) return;

    const beat = () => {
      if (document.visibilityState === "visible") touch();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        touch();
        return;
      }
      if (sessionExpired()) {
        forgetSession();
        setLocal(null);
        setNotice(AWAY_MESSAGE);
        signOut(auth);
      } else {
        touch();
      }
    };
    const onLeave = () => touch();

    const id = setInterval(beat, 15000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [user]);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!user) return <Login notice={notice} />;

  // Log out button = puro logout, auto login hobe na
  const logout = () => {
    forgetSession();
    setNotice("");
    setLocal(null);
    signOut(auth);
  };

  if (!user.emailVerified) {
    return (
      <VerifyEmail
        user={user}
        onDone={() => setTick((t) => t + 1)}
        onLogout={logout}
      />
    );
  }

  const isAdmin =
    (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">
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
          </span>
          <span>Exam Routine</span>
        </div>
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {user.email[0].toUpperCase()}
          </span>
          <span className="email">{user.email}</span>
          <InstallApp />
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="page">
        <Search local={local} clearLocal={() => setLocal(null)} />
        <Upload isAdmin={isAdmin} local={local} setLocal={setLocal} />
      </main>

      <Footer />
    </>
  );
}
