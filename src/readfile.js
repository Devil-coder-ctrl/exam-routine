import Papa from "papaparse";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { toDate, toISO } from "./utils";
import { parseLines, normTime } from "./parseText";

const ALIASES = {
  course: ["course", "coursecode", "code", "courseno", "subjectcode"],
  title: ["title", "coursetitle", "coursename", "subject", "subjectname"],
  date: ["date", "examdate"],
  time: ["time", "examtime", "starttime"],
  room: ["room", "roomno", "hall", "venue"],
  slot: ["slot"],
  faculty: ["faculty", "teacher", "instructor", "facultyname"],
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
  time: normTime(text(r.time)),
  room: text(r.room),
  slot: text(r.slot),
  faculty: text(r.faculty),
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

// Heading thakle table hishebe, na hole line por line text hishebe pore
const fromGrid = (grid) => {
  const rows = fromTable(grid)
    .map(tidy)
    .filter((r) => r.course);
  if (rows.length) return rows;
  return parseLines(grid.map((r) => r.map(cellText).join(" ")));
};

const shrink = async (file, max = 2200) => {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  } catch {
    return file;
  }
};

const ocr = async (source, onStatus) => {
  const mod = await import("tesseract.js");
  const Tesseract = mod.default || mod;
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
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;
  let lines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    onStatus(`Reading page ${p} of ${pdf.numPages}...`);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({
        s: i.str,
        x: i.transform[4],
        y: i.transform[5],
        w: i.width || 0,
      }));

    // Ek line er item gulo ek shathe joro
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    let cur = [];
    let curY = null;
    for (const it of items) {
      if (curY === null || Math.abs(it.y - curY) <= 3) {
        if (curY === null) curY = it.y;
        cur.push(it);
      } else {
        rows.push(cur);
        cur = [it];
        curY = it.y;
      }
    }
    if (cur.length) rows.push(cur);

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      let s = row[0].s;
      for (let i = 1; i < row.length; i++) {
        const gap = row[i].x - (row[i - 1].x + row[i - 1].w);
        s += (gap > 1.5 ? " " : "") + row[i].s;
      }
      lines.push(s);
    }
  }

  // Text na pele (scan kora PDF) page ke chobi baniye OCR kori
  if (lines.join("").replace(/\s/g, "").length < 20) {
    lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onStatus(`Reading page ${p} of ${pdf.numPages}...`);
      const page = await pdf.getPage(p);
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

export async function readAnyFile(file, onStatus = () => {}) {
  const name = file.name.toLowerCase();
  const isImage =
    (file.type || "").startsWith("image/") ||
    /\.(png|jpe?g|bmp|webp)$/.test(name);
  let rows;

  if (name.endsWith(".csv")) {
    rows = await new Promise((resolve, reject) =>
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (res) => resolve(fromGrid(res.data)),
        error: reject,
      }),
    );
  } else if (name.endsWith(".xlsx")) {
    const mod = await import("read-excel-file");
    const readXlsxFile = mod.default || mod;
    rows = fromGrid(await readXlsxFile(file));
  } else if (name.endsWith(".docx")) {
    const mod = await import("mammoth");
    const mammoth = mod.default || mod;
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const dom = new DOMParser().parseFromString(value, "text/html");
    rows = [...dom.querySelectorAll("table")].flatMap((t) =>
      fromTable(
        [...t.querySelectorAll("tr")].map((tr) =>
          [...tr.children].map((td) => td.textContent),
        ),
      ).map(tidy),
    );
    if (!rows.some((r) => r.course)) {
      const raw = await mammoth.extractRawText({ arrayBuffer: buf });
      rows = parseLines(raw.value.split("\n"));
    }
  } else if (name.endsWith(".pdf")) {
    rows = await readPdf(file, onStatus);
  } else if (isImage) {
    onStatus("Reading image...");
    rows = parseLines(await ocr(await shrink(file), onStatus));
  } else if (name.endsWith(".txt")) {
    rows = parseLines((await file.text()).split("\n"));
  } else if (name.endsWith(".doc") || name.endsWith(".xls")) {
    throw new Error("legacy");
  } else {
    throw new Error("unsupported");
  }

  return rows.filter((r) => r.course);
}
