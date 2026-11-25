import { toISO } from "./utils";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const monthNo = (s) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";

const DATE_PATTERNS = [
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, get: (m) => [+m[1], +m[2], +m[3]] },
  {
    re: /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/,
    get: (m) => [m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]], // din/mash/bochor
  },
  {
    re: new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-,.]*${MON}[\\s\\-,.]*(\\d{4})\\b`,
      "i",
    ),
    get: (m) => [+m[3], monthNo(m[2]), +m[1]],
  },
  {
    re: new RegExp(
      `\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
      "i",
    ),
    get: (m) => [+m[3], monthNo(m[1]), +m[2]],
  },
];

const findDate = (line) => {
  for (const p of DATE_PATTERNS) {
    const m = line.match(p.re);
    if (!m) continue;
    const [y, mo, d] = p.get(m);
    const dt = new Date(y, mo - 1, d);
    if (mo >= 1 && mo <= 12 && dt.getDate() === d)
      return { iso: toISO(dt), text: m[0] };
  }
  return null;
};

const TIME_RE =
  /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?(?:\s*(?:-|–|to)\s*\d{1,2}[:.]\d{2}\s*(am|pm)?)?/i;

const findTime = (line) => {
  const m = line.match(TIME_RE);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return {
    text: m[0].trim().replace(/(\d)\.(\d{2})/g, "$1:$2"),
    raw: m[0].trim(),
  };
};

const ROOM_RE =
  /\b(?:room|rm|hall|lab)\.?\s*(?:no\.?)?\s*[:#-]?\s*[A-Za-z0-9\-\/]+/i;

const BAD = new Set([
  "ROOM",
  "HALL",
  "DATE",
  "TIME",
  "DAY",
  "SEC",
  "BLOCK",
  "FLOOR",
  "LAB",
  "NO",
  "PM",
  "AM",
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "SEPT",
  "OCT",
  "NOV",
  "DEC",
  "YEAR",
  "SET",
  "TERM",
  "EXAM",
  "FALL",
  "FINAL",
  "MID",
  "SEM",
  "BATCH",
]);
const COURSE_RE = /\b([A-Z]{2,4})[\s\-]?(\d{3,4}[A-Z]?(?:\.\d)?)\b/g;

export function parseLines(lines) {
  const out = [];
  let lastDate = "";
  let lastTime = "";

  for (const rawLine of lines) {
    let line = String(rawLine).replace(/\s+/g, " ").trim();
    if (!line) continue;

    const d = findDate(line);
    if (d) line = line.replace(d.text, " ");
    const t = findTime(line);
    if (t) line = line.replace(t.raw, " ");
    const r = line.match(ROOM_RE);
    if (r) line = line.replace(r[0], " ");

    if (d) {
      lastDate = d.iso;
      if (!t) lastTime = "";
    }
    if (t) lastTime = t.text;

    for (const m of line.matchAll(COURSE_RE)) {
      if (BAD.has(m[1])) continue;
      if (/^(19|20)\d{2}$/.test(m[2])) continue;
      out.push({
        course: m[1] + m[2],
        title: "",
        date: lastDate,
        time: lastTime,
        room: r ? r[0].trim() : "",
        section: "",
      });
    }
  }

  const seen = new Set();
  return out.filter((x) => {
    const k = [x.course, x.date, x.time, x.room].join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
