import { useState } from "react";
import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const toDate = (s = "") => {
  const t = String(s).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t)
    ? new Date(t + "T00:00:00")
    : new Date(t);
  return isNaN(d) ? null : d;
};

const daysFromToday = (d) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

const whenText = (n) =>
  n === 0
    ? "Today"
    : n === 1
      ? "Tomorrow"
      : n > 1
        ? `In ${n} days`
        : "Finished";

export default function Search() {
  const [roll, setRoll] = useState("");
  const [list, setList] = useState([]);
  const [shownRoll, setShownRoll] = useState("");
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (e) => {
    e.preventDefault();
    const value = roll.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const q = query(collection(db, "routines"), where("roll", "==", value));
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => ({ ...d.data(), d: toDate(d.data().date) }))
        .sort((a, b) => (a.d && b.d ? a.d - b.d : a.d ? -1 : 1));
      setList(rows);
      setShownRoll(value);
      setSearched(true);
    } catch {
      setError(
        "Could not load the routine. Check your internet and try again.",
      );
    }
    setBusy(false);
  };

  const nextIndex = list.findIndex((r) => r.d && daysFromToday(r.d) >= 0);
  const next = nextIndex >= 0 ? list[nextIndex] : null;
  const studentName = list[0]?.name;

  return (
    <div>
      <h2>Find your exam routine</h2>
      <p className="sub">Enter your roll number to see all your exams.</p>

      <form className="search-row" onSubmit={search}>
        <input
          placeholder="Roll number, for example 101"
          value={roll}
          aria-label="Roll number"
          onChange={(e) => setRoll(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {searched && list.length === 0 && (
        <p className="empty">
          No routine found for roll {shownRoll}. Check the number and try again.
        </p>
      )}

      {list.length > 0 && (
        <>
          <p className="summary">
            {studentName ? (
              <strong>{studentName}</strong>
            ) : (
              <>Roll {shownRoll}</>
            )}
            {next ? (
              <>
                , your next exam is <strong>{next.course}</strong> (
                {whenText(daysFromToday(next.d)).toLowerCase()}).
              </>
            ) : (
              <>, all your exams are finished.</>
            )}
          </p>

          <div className="tiles">
            {list.map((r, i) => {
              const n = r.d ? daysFromToday(r.d) : null;
              const cls =
                "tile" +
                (i === nextIndex ? " next" : "") +
                (n !== null && n < 0 ? " past" : "");
              const weekday = r.d
                ? r.d.toLocaleDateString("en-GB", { weekday: "long" }) + ", "
                : "";
              return (
                <article className={cls} key={i}>
                  <div className="tile-date">
                    {r.d ? (
                      <>
                        <span className="day">{r.d.getDate()}</span>
                        <span className="month">
                          {r.d.toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                      </>
                    ) : (
                      <span className="month">{r.date}</span>
                    )}
                  </div>
                  <div className="tile-body">
                    <h3>{r.course}</h3>
                    <p>
                      {weekday}
                      {r.time}, {r.room}
                    </p>
                  </div>
                  {n !== null && <span className="when">{whenText(n)}</span>}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
