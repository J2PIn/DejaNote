import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "../db";
import { computeLanes, nearestNeighbors, type NotePoint } from "../lib/semantics";

export default function MapPage() {
  const notes = useLiveQuery(async () => {
    const ns = await db.notes.toArray();

    // for each note, fetch latest event snapshot (fast enough for MVP)
    const points: NotePoint[] = [];
    for (const n of ns) {
      const last = await db.events
        .where("[noteId+ts]")
        .between([n.id, -Infinity], [n.id, Infinity])
        .last();

      points.push({
        noteId: n.id,
        title: n.title,
        ts: n.updatedAt,
        text: last?.snapshotText ?? "",
      });
    }

    // newest first
    points.sort((a, b) => b.ts - a.ts);
    return points;
  }, []);

  if (!notes) return <div>Loading…</div>;
  if (notes.length === 0) return <div>No notes yet.</div>;

  const timeMin = Math.min(...notes.map(n => n.ts));
  const timeMax = Math.max(...notes.map(n => n.ts));
  const range = Math.max(1, timeMax - timeMin);

  const { vectors, lanes } = computeLanes(notes.slice().reverse()); // older->newer for nicer lane growth
  const edges = nearestNeighbors(notes, vectors, 2).filter(e => e.w >= 0.35);

  const W = 980;
  const H = 560;
  const pad = 40;
  const laneCount = Math.max(1, lanes.length);
  const laneHeight = (H - pad * 2) / laneCount;

  const laneOf = new Map<string, number>();
  lanes.forEach((lane, li) => lane.noteIds.forEach(id => laneOf.set(id, li)));

  function xOf(ts: number) {
    return pad + ((ts - timeMin) / range) * (W - pad * 2);
  }
  function yOf(noteId: string) {
    const li = laneOf.get(noteId) ?? 0;
    return pad + li * laneHeight + laneHeight / 2;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        Lanes: {lanes.length} • Edges shown when similarity ≥ 0.35 • X = time
      </div>

      <svg width={W} height={H} style={{ border: "1px solid #ddd", borderRadius: 12 }}>
        {/* lane lines */}
        {Array.from({ length: laneCount }).map((_, li) => {
          const y = pad + li * laneHeight + laneHeight / 2;
          return <line key={li} x1={pad} x2={W - pad} y1={y} y2={y} stroke="#eee" />;
        })}

        {/* edges */}
        {edges.map((e, i) => (
          <line
            key={i}
            x1={xOf(notes.find(n => n.noteId === e.a)!.ts)}
            y1={yOf(e.a)}
            x2={xOf(notes.find(n => n.noteId === e.b)!.ts)}
            y2={yOf(e.b)}
            stroke="#ddd"
            strokeWidth={1}
            opacity={Math.min(0.9, Math.max(0.15, e.w))}
          />
        ))}

        {/* nodes */}
        {notes.map((n) => {
          const x = xOf(n.ts);
          const y = yOf(n.noteId);
          return (
            <g key={n.noteId}>
              <title>{n.title}\n{new Date(n.ts).toLocaleString()}</title>
              <circle cx={x} cy={y} r={7} fill="#111" opacity={0.85} />
            </g>
          );
        })}
      </svg>

      <div style={{ display: "grid", gap: 8 }}>
        {notes.slice(0, 12).map((n) => (
          <div key={n.noteId} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <Link to={`/note/${n.noteId}`}>{n.title}</Link>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(n.ts).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
