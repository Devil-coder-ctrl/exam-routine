import { useState } from "react";
import { db } from "./firebase";
import { collection, writeBatch, doc, getDocs } from "firebase/firestore";
import { readAnyFile } from "./readFile";
import { courseKey, toDate, toISO } from "./utils";

const MSG = {
  unsupported:
    "This file type is not supported. Use CSV, Excel (.xlsx), Word (.docx), PDF, or a photo (PNG/JPG).",
  legacy:
    "Old .doc and .xls files are not supported. Open the file and save it as .docx or .xlsx, then upload again.",
};

export default function Upload({ isAdmin, local, setLocal }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const handleFile = async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;
    setBusy(true);
    setStatus("Reading file...");
    try {
      const rows = await readAnyFile(file, setStatus);
      if (rows.length === 0) {
        setStatus(
          "No exams found in this file. It needs course codes like CSE101 and dates.",
        );
      } else {
        setLocal({ name: file.name, rows });
        const bad = rows.filter((r) => !toDate(r.date)).length;
        setStatus(
          `Loaded ${rows.length} exams from ${file.name}.` +
            (bad ? ` ${bad} have no valid date.` : ""),
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error(err);
      setStatus(
        MSG[err.message] ||
          "Could not read this file. Try another format or a clearer file.",
      );
    }
    setBusy(false);
    input.value = "";
  };

  const edit = (i, f, v) =>
    setLocal((l) => ({
      ...l,
      rows: l.rows.map((r, j) => (j === i ? { ...r, [f]: v } : r)),
    }));
  const remove = (i) =>
    setLocal((l) => ({ ...l, rows: l.rows.filter((_, j) => j !== i) }));

  const publish = async () => {
    const clean = local.rows
      .map((r) => {
        const d = toDate(r.date);
        return {
          course: (r.course || "").trim(),
          title: (r.title || "").trim(),
          date: d ? toISO(d) : "",
          time: (r.time || "").trim(),
          room: (r.room || "").trim(),
          slot: (r.slot || "").trim(),
          faculty: (r.faculty || "").trim(),
        };
      })
      .filter((r) => r.course && r.date);

    if (clean.length === 0) {
      setStatus(
        "Nothing to publish. Every exam needs a course code and a valid date.",
      );
      return;
    }

    setBusy(true);
    setStatus("Publishing...");
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
      const skipped = local.rows.length - clean.length;
      setStatus(
        `Published ${clean.length} exams for everyone.` +
          (skipped ? ` ${skipped} skipped (course or date missing).` : ""),
      );
    } catch (err) {
      console.error(err);
      setStatus(
        "Publish failed. Check that you are logged in as the admin email used in the Firestore rules.",
      );
    }
    setBusy(false);
  };

  return (
    <section className="admin">
      <h3>Upload a routine file</h3>
      <p className="sub">
        Use a CSV, Excel, Word, PDF, or a photo. The file is read on your
        device, and you can search it right away.
      </p>

      <label className={"file-btn" + (busy ? " disabled" : "")}>
        <span>{busy ? "Please wait..." : "Choose file"}</span>
        <input type="file" onChange={handleFile} disabled={busy} />
      </label>

      {status && <p className="status">{status}</p>}

      {isAdmin && local && (
        <div className="publish">
          <p className="sub">
            Admin: publish this file so every student can search it on the
            website.
          </p>

          <button
            type="button"
            className="link-btn"
            onClick={() => setShowTable(!showTable)}
          >
            {showTable ? "Hide" : "Review"} all {local.rows.length} exams
          </button>

          {showTable && (
            <div className="preview">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Date (YYYY-MM-DD)</th>
                    <th>Time</th>
                    <th>Title</th>
                    <th>Faculty</th>
                    <th>Room</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {local.rows.map((r, i) => (
                    <tr key={i}>
                      {[
                        "course",
                        "date",
                        "time",
                        "title",
                        "faculty",
                        "room",
                      ].map((f) => (
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
          )}

          <label className="opt">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            <span>Replace the old routine</span>
          </label>
          <button className="btn" onClick={publish} disabled={busy}>
            Publish {local.rows.length} exams for everyone
          </button>
        </div>
      )}
    </section>
  );
}
