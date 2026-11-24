import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import Search from "./Search";
import Upload from "./Upload";

const ADMIN_EMAIL = "rahidahmedrokon60@gmail.com"; // must match your admin email

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
        <span className="brand">Exam Routine</span>
        <div className="who">
          <span>{user.email}</span>
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
