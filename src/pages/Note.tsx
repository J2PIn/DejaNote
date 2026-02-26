import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams } from "react-router-dom";
import { db, uid } from "../db";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  const note = useLiveQuery(() => db.notes.get(id), [id]);

  const events = useLiveQuery(async () => {
    return db.events.where("noteId").equals(id).sortBy("ts");
  }, [id]);

  const latestText = useMemo(() => {
    const last = events?.[events.length - 1];
    return last?.snapshotText ?? "";
  }, [events]);

  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "typing" | "saved">("idle");

  // Keep draft synced when switching notes / when history changes due to external factors
  useEffect(() => {
    setDraft(latestText);
  }, [latestText, id]);

  const timerRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<string>("");

  useEffect(() => {
    lastCommittedRef.current = latestText;
  }, [latestText]);

  async function commitSnapshot(text: string) {
    const now = Date.now();
    await db.events.add({
      id: uid("e_"),
      noteId: id,
      ts: now,
      type: "snapshot",
      snapshotText: text,
      chunkId: String(now),
    });
    await db.notes.update(id, { updatedAt: now });
    setStatus("saved");
    // drop to idle after a moment
    window.setTimeout(() => setStatus("idle"), 800);
  }

  function scheduleCommit(nextText: string) {
    setStatus("typing");
    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      const last = lastCommittedRef.current;
      if (nextText !== last) {
        await commitSnapshot(nextText);
      } else {
        setStatus("idle");
      }
    }, 2000);
  }

  async function rename(title: string) {
    const t = title.trim() || "Untitled";
    await db.notes.update(id, { title: t });
  }

  // Ensure we commit when leaving the page / losing focus
  useEffect(() => {
    const onBlur = async () => {
      if (draft !== lastCommittedRef.current) await commitSnapshot(draft);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, id]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input
            defaultValue={note?.title ?? ""}
            onBlur={(e) => rename(e.target.value)}
            placeholder="Title"
            style={{ fontSize: 18, fontWeight: 700, padding: "6px 10px", width: "100%" }}
          />
          <div style={{ fontSize: 12, opacity: 0.7, minWidth: 80, textAlign: "right" }}>
            {status === "typing" ? "typing…" : status === "saved" ? "saved" : ""}
          </div>
        </div>

        <textarea
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            scheduleCommit(v);
          }}
          placeholder="Write… (commits after 2s idle)"
          style={{
            width: "100%",
            minHeight: 520,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 14,
            lineHeight: 1.4,
          }}
        />
      </div>

      <aside style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Timestamped changes</div>

        <div style={{ display: "grid", gap: 10, maxHeight: 620, overflow: "auto" }}>
          {(events ?? []).slice().reverse().map((ev, idx) => {
            const isLatest = idx === 0;
            return (
              <div
                key={ev.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  background: isLatest ? "#fafafa" : "white",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                  — {formatTime(ev.ts)} —
                </div>
                <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {(ev.snapshotText || "").slice(0, 220)}
                  {ev.snapshotText.length > 220 ? "…" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
