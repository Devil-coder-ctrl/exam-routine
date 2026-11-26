export const courseKey = (s = "") =>
  String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "");

export const toDate = (s) => {
  if (s instanceof Date) {
    return isNaN(s)
      ? null
      : new Date(s.getFullYear(), s.getMonth(), s.getDate());
  }
  const t = String(s ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(t);
  return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const TIME_RE = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/gi;
const toMin = (m) => {
  let h = +m[1];
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + +m[2];
};
export const startMinutes = (time = "") => {
  const all = [...String(time).matchAll(TIME_RE)];
  return all.length ? toMin(all[0]) : null;
};
export const endMinutes = (time = "") => {
  const all = [...String(time).matchAll(TIME_RE)];
  return all.length > 1 ? toMin(all[1]) : null;
};
