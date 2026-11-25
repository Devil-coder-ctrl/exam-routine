// "CSE 101", "cse-101" → "CSE101"
export const courseKey = (s = "") =>
  String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "");

// 2026-12-05, 05/12/2026 (din/mash/bochor), "5 Dec 2026" shob porte pare
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

// "10:00 AM" ba "14:30" theke minute ber kore. "10:00 AM - 1:00 PM" hole prothom time ta nei
export const startMinutes = (time = "") => {
  const m = String(time).match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
};
