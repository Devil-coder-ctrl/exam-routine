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
    get: (m) => [m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]], // din.mash.bochor
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

// "8:30 10:00" ba "8:30 AM - 10:00 AM" duto-i pore
const TIME_RANGE_RE =
  /\b(\d{1,2})[:.](\d{2})\s*(am|pm)?(?:\s*(?:-|–|—|to)?\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?)?/i;

const to12 = (h, m, ap) => {
  h = +h;
  const mm = String(m).padStart(2, "0");
  if (ap) return `${h}:${mm} ${ap.toUpperCase()}`;
  if (h >= 12) return `${h === 12 ? 12 : h - 12}:${mm} PM`;
  if (h >= 1 && h <= 6) return `${h}:${mm} PM`; // 2:30 mane bikel, rat na
  return `${h === 0 ? 12 : h}:${mm} AM`;
};

const findTime = (line) => {
  const m = line.match(TIME_RANGE_RE);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const hasEnd = m[4] !== undefined && +m[4] <= 23 && +m[5] <= 59;
  const start = to12(m[1], m[2], m[3]);
  return {
    text: hasEnd ? `${start} - ${to12(m[4], m[5], m[6])}` : start,
    raw: m[0],
  };
};

export const normTime = (s) => {
  const t = String(s ?? "").trim();
  return t ? (findTime(t)?.text ?? t) : "";
};

const ROOM_RE =
  /\b(?:room|rm|hall|lab)\b\.?\s*(?:no\.?)?\s*[:#-]?\s*[A-Za-z]{0,3}\d[A-Za-z0-9\-\/]*/i;

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
  "SLOT",
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

// CSE437.1, MAT261.10, CSE4041.1, ENG105.39 shob porbe
const COURSE_RE = /\b([A-Z]{2,4})[\s-]?(\d{3,4}[A-Z]?(?:\.\d{1,3})?)\b/g;

export function parseLines(lines) {
  const out = [];
  let lastDate = "";
  let lastTime = "";

  for (const rawLine of lines) {
    let line = String(rawLine).replace(/\s+/g, " ").trim();
    if (!line) continue;

    const slotMatch = line.match(/^slot[-\s]?[A-Za-z0-9]+/i);
    const slot = slotMatch ? slotMatch[0].replace(/\s+/g, "") : "";
    if (slotMatch) line = line.slice(slotMatch[0].length).trim();

    const d = findDate(line);
    if (d) line = line.replace(d.text, " ");
    const t = findTime(line);
    if (t) line = line.replace(t.raw, " ");
    const r = line.match(ROOM_RE);
    if (r) line = line.replace(r[0], " ");
    line = line.replace(/\s+/g, " ").trim();

    if (d) {
      lastDate = d.iso;
      if (!t) lastTime = "";
    }
    if (t) lastTime = t.text;

    const matches = [...line.matchAll(COURSE_RE)].filter(
      (m) => !BAD.has(m[1]) && !/^(19|20)\d{2}$/.test(m[2]),
    );
    if (!matches.length) continue;

    let title = "";
    let faculty = "";
    if (matches.length === 1) {
      const m = matches[0];
      const tail = line.slice(m.index + m[0].length).trim();
      const open = tail.indexOf("[");
      const close = tail.indexOf("]");
      title = (open >= 0 ? tail.slice(0, open) : tail).trim().slice(0, 90);
      faculty = close >= 0 ? tail.slice(close + 1).trim() : "";
    }

    for (const m of matches) {
      out.push({
        course: m[1] + m[2],
        title,
        date: lastDate,
        time: lastTime,
        room: r ? r[0].trim() : "",
        slot,
        faculty,
      });
    }
  }

  const seen = new Set();
  return out.filter((x) => {
    const k = [x.course, x.date, x.time].join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
