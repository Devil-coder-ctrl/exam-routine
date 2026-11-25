import { useState } from "react";
import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { courseKey, toDate, startMinutes } from "./utils";

const startAt = (r) => {
  const d = toDate(r.date);
  if (!d) return null;
  const m = startMinutes(r.time);
  if (m !== null) d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

const dayDiff = (r) => {
  const d = toDate(r.date);
  if (!d) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
};

// "upcoming", "started" ba "past"
const stateOf = (r) => {
  const n = dayDiff(r);
  if (n === null) return "upcoming";
  if (n < 0) return "past";
  if (n === 0 && startMinutes(r.time) !== null && startAt(r) <= new Date())
    return "started";
  return "upcoming";
};

// soon = 3 din er moddhe, later = pore, past = shesh
const toneOf = (r) => {
  if (stateOf(r) === "past") return "past";
  const n = dayDiff(r);
  return n !== null && n <= 3 ? "soon" : "later";
};

const leftText = (r) => {
  const st = stateOf(r);
  if (st === "past") return "Finished";
  if (st === "started") return "Started today";

  const n = dayDiff(r);
  const s = startAt(r);
  if (s && startMinutes(r.time) !== null) {
    const diff = s - new Date();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0)
      return `${days} ${days === 1 ? "day" : "days"} ${hours} h left`;
    if (hours > 0) return `${hours} h ${mins} min left`;
    return `${mins} min left`;
  }
  if (n === 0) return "Today";
  return `${n} ${n === 1 ? "day" : "days"} left`;
};

export default function Search() {
  const [code, setCode] = useState("");
  const [list, setList] = useState([]);
  const [shown, setShown] = useState("");
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (e) => {
    e.preventDefault();
    const key = courseKey(code);
    if (!key) return;
    setBusy(true);
    setError("");
    try {
      const q = query(
        collection(db, "routines"),
        where("courseKey", ">=", key),
        where("courseKey", "<=", key + "\uf8ff"),
      );
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => d.data())
        .sort(
          (a, b) => (startAt(a)?.getTime() ?? 0) - (startAt(b)?.getTime() ?? 0),
        );
      setList(rows);
      setShown(code.trim().toUpperCase());
      setSearched(true);
    } catch {
      setError(
        "Could not load the routine. Check your internet and try again.",
      );
    }
    setBusy(false);
  };

  const nextIndex = list.findIndex((r) => stateOf(r) === "upcoming");
  const next = nextIndex >= 0 ? list[nextIndex] : null;

  return (
    <div>
      <section className="hero">
        <h2>Find your exam date</h2>
        <p className="sub">Enter a course code, for example CSE101.</p>

        <form className="search-row" onSubmit={search}>
          <div className="field-search">
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
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              placeholder="Course code"
              value={code}
              aria-label="Course code"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Searching..." : "Search"}
          </button>
        </form>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {searched && list.length === 0 && (
        <p className="empty">
          No exam found for {shown}. Check the course code and try again.
        </p>
      )}

      {list.length > 0 && (
        <>
          <p className="summary">
            {list.length} {list.length === 1 ? "exam" : "exams"} found for{" "}
            <strong>{shown}</strong>
            {next ? (
              <>
                . Next: <strong>{next.course}</strong>,{" "}
                {leftText(next).toLowerCase()}.
              </>
            ) : (
              <>. All finished.</>
            )}
          </p>

          <div className="tiles">
            {list.map((r, i) => {
              const d = toDate(r.date);
              const cls =
                `tile tone-${toneOf(r)}` + (i === nextIndex ? " next" : "");
              const weekday = d
                ? d.toLocaleDateString("en-GB", { weekday: "long" })
                : "";
              const line = [
                weekday,
                r.time,
                r.room,
                r.section && `Section ${r.section}`,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <article className={cls} key={i}>
                  <div className="tile-date">
                    {d ? (
                      <>
                        <span className="day">{d.getDate()}</span>
                        <span className="month">
                          {d.toLocaleDateString("en-GB", { month: "short" })}{" "}
                          {d.getFullYear()}
                        </span>
                      </>
                    ) : (
                      <span className="month">{r.date}</span>
                    )}
                  </div>
                  <div className="tile-body">
                    <h3>{r.course}</h3>
                    {r.title && <p>{r.title}</p>}
                    <p>{line}</p>
                  </div>
                  <span className="when">{leftText(r)}</span>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
