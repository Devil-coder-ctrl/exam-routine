import { useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";
import { db } from "./firebase";
import { collection, writeBatch, doc, getDocs } from "firebase/firestore";
import { courseKey, toDate, toISO } from "./utils";
import { parseLines } from "./parseText";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const ALIASES = {
  course: ["course", "coursecode", "code", "courseno", "subjectcode"],
  title: ["title", "coursetitle", "coursename", "subject", "subjectname"],
  date: ["date", "examdate"],
  time: ["time", "examtime", "starttime"],
  room: ["room", "roomno", "hall", "venue"],
  section: ["section", "sec"],
};

const norm = (h) =>
  String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const fieldOf = (h) =>
  Object.keys(ALIASES).find((k) => ALIASES[k].includes(norm(h)));
const text = (v) => (v instanceof Date ? "" : String(v ?? "").trim());
const cellText = (v) =>
  v instanceof Date
    ? toISO(new Date(v.getTime() + 12 * 3600 * 1000))
    : String(v ?? "").trim();

const dateText = (v) => {
  if (v instanceof Date) v = new Date(v.getTime() + 12 * 3600 * 1000);
  const d = toDate(v);
  return d ? toISO(d) : "";
};

const tidy = (r) => ({
  course: text(r.course),
  title: text(r.title),
  date: dateText(r.date),
  time: text(r.time),
  room: text(r.room),
  section: text(r.section),
});

const fromTable = (table) => {
  if (!table.length) return [];
  const fields = table[0].map(fieldOf);
  return table.slice(1).map((r) => {
    const o = {};
    fields.forEach((f, i) => {
      if (f) o[f] = r[i];
    });
    return o;
  });
};

// Heading thik thakle table hishebe, na hole text hishebe pore
const fromGrid = (grid) => {
  const rows = fromTable(grid)
    .map(tidy)
    .filter((r) => r.course);
  if (rows.length) return rows;
  return parseLines(grid.map((r) => r.map(cellText).join(" ")));
};

const ocr = async (source, onStatus) => {
  const { data } = await Tesseract.recognize(source, "eng", {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onStatus(`Reading image... ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return data.text.split("\n");
};

const readPdf = async (file, onStatus) => {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() })
    .promise;
  let lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const rows = new Map();
    content.items.forEach((it) => {
      if (!it.str || !it.str.trim()) return;
      const key = Math.round(it.transform[5] / 4);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(it);
    });
    [...rows.keys()]
      .sort((a, b) => b - a)
      .forEach((k) =>
        lines.push(
          rows
            .get(k)
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map((it) => it.str)
            .join(" "),
        ),
      );
  }

  // Text na pele (scan kora PDF) page ke chobi baniye OCR kori
  if (lines.join("").replace(/\s/g, "").length < 20) {
    lines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onStatus(`Reading page ${i} of ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport })
        .promise;
      lines.push(...(await ocr(canvas, onStatus)));
    }
  }
  return parseLines(lines);
};

const readFile = async (file, onStatus) => {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) =>
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (res) => resolve(fromGrid(res.data)),
        error: reject,
      }),
    );
  }

  if (name.endsWith(".xlsx")) return fromGrid(await readXlsxFile(file));

  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const dom = new DOMParser().parseFromString(value, "text/html");
    const fromTables = [...dom.querySelectorAll("table")].flatMap((t) =>
      fromTable(
        [...t.querySelectorAll("tr")].map((tr) =>
          [...tr.children].map((td) => td.textContent),
        ),
      )
        .map(tidy)
        .filter((r) => r.course),
    );
    if (fromTables.length) return fromTables;
    const raw = await mammoth.extractRawText({ arrayBuffer: buf });
    return parseLines(raw.value.split("\n"));
  }

  if (name.endsWith(".pdf")) return readPdf(file, onStatus);

  if (/\.(png|jpe?g|bmp)$/.test(name)) {
    onStatus("Reading image...");
    return parseLines(await ocr(file, onStatus));
  }

  throw new Error("unsupported");
};

export default function Upload() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRows(null);
    setBusy(true);
    setStatus("Reading file...");
    try {
      const list = await readFile(file, setStatus);
      if (list.length === 0) {
        setStatus(
          "No exams found in this file. Check that it has course codes like CSE101 and dates.",
        );
      } else {
        setRows(list);
        setStatus(
          `Found ${list.length} exams. Check the table, fix any mistakes, then save.`,
        );
      }
    } catch (err) {
      setStatus(
        err.message === "unsupported"
          ? "Use .csv, .xlsx, .docx, .pdf, .png, or .jpg. For old .doc or .xls files, save them as .docx or .xlsx first."
          : "Could not read this file. Try another format.",
      );
    }
    setBusy(false);
    e.target.value = "";
  };

  const edit = (i, field, value) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const remove = (i) => setRows(rows.filter((_, j) => j !== i));

  const save = async () => {
    const clean = rows
      .map((r) => {
        const d = toDate(r.date);
        return {
          course: r.course.trim(),
          title: (r.title || "").trim(),
          date: d ? toISO(d) : "",
          time: (r.time || "").trim(),
          room: (r.room || "").trim(),
          section: (r.section || "").trim(),
        };
      })
      .filter((r) => r.course && r.date);

    if (clean.length === 0) {
      setStatus(
        "Nothing to save. Every exam needs a course code and a valid date.",
      );
      return;
    }

    setBusy(true);
    setStatus("Saving...");
    try {
      if (replace) {
        const old = await getDocs(collection(db, "routines"));
        for (let i = 0; i < old.docs.length; i += 400) {
          const b = writeBatch(db);
          old.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
          await b.commit();
        }
      }
      for (let i = 0; i < clean.length; i += 400) {
        const batch = writeBatch(db);
        clean.slice(i, i + 400).forEach((r) => {
          batch.set(doc(collection(db, "routines")), {
            ...r,
            courseKey: courseKey(r.course),
          });
        });
        await batch.commit();
      }
      const skipped = rows.length - clean.length;
      setStatus(
        `Saved ${clean.length} exams.` +
          (skipped ? ` ${skipped} skipped (course or date missing).` : ""),
      );
      setRows(null);
    } catch {
      setStatus("Save failed. Check your admin email and the Firestore rules.");
    }
    setBusy(false);
  };

  return (
    <section className="admin">
      <h3>Admin: upload routine</h3>
      <p className="sub">
        Upload a CSV, Excel, Word, PDF, or image file. You can check and fix the
        exams before saving.
      </p>

      <label className="upload-box">
        <input
          type="file"
          accept=".csv,.xlsx,.docx,.pdf,.png,.jpg,.jpeg,.bmp"
          onChange={handleFile}
          disabled={busy}
        />
      </label>

      {status && <p className="status">{status}</p>}

      {rows && (
        <>
          <div className="preview">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Title</th>
                  <th>Date (YYYY-MM-DD)</th>
                  <th>Time</th>
                  <th>Room</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {["course", "title", "date", "time", "room"].map((f) => (
                      <td key={f}>
                        <input
                          value={r[f] || ""}
                          onChange={(e) => edit(i, f, e.target.value)}
                          style={
                            f === "date" && !toDate(r.date)
                              ? { borderColor: "#b3261e" }
                              : null
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="x"
                        onClick={() => remove(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="opt">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>Replace the old routine</span>
          </label>
          <button className="btn" onClick={save} disabled={busy}>
            Save {rows.length} exams to the website
          </button>
        </>
      )}
    </section>
  );
}
