import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import Search from "./Search";
import Upload from "./Upload";

const ADMIN_EMAIL = "rahidahmedrokon60@gmail.com"; // tomar admin email, Firestore rules er shathe mile thakte hobe

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!user) return <Login />;

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
          <button onClick={() => signOut(auth)}>Log out</button>
        </div>
      </header>

      <main className="page">
        <Search />
        {user.email === ADMIN_EMAIL && <Upload />}
      </main>
    </>
  );
}
