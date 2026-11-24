import { useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import mammoth from "mammoth";
import { db } from "./firebase";
import { collection, writeBatch, doc } from "firebase/firestore";

const clean = (v) => {
  if (v instanceof Date) {
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${m}-${d}`;
  }
  return String(v ?? "").trim();
};

// table = array of rows, first row = headings
const fromTable = (table) => {
  const [head, ...body] = table;
  const keys = head.map((h) => clean(h).toLowerCase());
  return body
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, clean(r[i])])))
    .filter((r) => r.roll);
};

const readFile = async (file) => {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) =>
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: (res) => resolve(res.data.filter((r) => r.roll)),
        error: reject,
      }),
    );
  }

  if (name.endsWith(".xlsx")) {
    return fromTable(await readXlsxFile(file));
  }

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    const dom = new DOMParser().parseFromString(value, "text/html");
    const table = [...dom.querySelectorAll("table tr")].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    return fromTable(table);
  }

  throw new Error("unsupported");
};

export default function Upload() {
  const [status, setStatus] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus("Reading file...");
    try {
      const rows = await readFile(file);
      if (rows.length === 0) {
        setStatus(
          "No rows found. Check that the first row has: roll, name, course, date, time, room.",
        );
        return;
      }
      setStatus("Uploading...");
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        rows.slice(i, i + 400).forEach((r) => {
          batch.set(doc(collection(db, "routines")), {
            roll: clean(r.roll),
            name: clean(r.name),
            course: clean(r.course),
            date: clean(r.date),
            time: clean(r.time),
            room: clean(r.room),
          });
        });
        await batch.commit();
      }
      setStatus(`Uploaded ${rows.length} rows.`);
    } catch (err) {
      setStatus(
        err.message === "unsupported"
          ? "Use a .csv, .xlsx, or .docx file."
          : "Upload failed. Check the column headings and your admin email.",
      );
    }
  };

  return (
    <section className="admin">
      <h3>Admin: upload routine</h3>
      <p className="sub">
        Upload a CSV, Excel (.xlsx), or Word (.docx) file. The first row must
        be: roll, name, course, date, time, room.
      </p>
      <label className="upload-box">
        <input type="file" accept=".csv,.xlsx,.docx" onChange={handleFile} />
      </label>
      {status && <p className="status">{status}</p>}
    </section>
  );
}
