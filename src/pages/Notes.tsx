import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import { db, uid, type Note } from "../db";

export default function Notes() {
  const navigate = useNavigate();

  const notes = useLiveQuery(async () => {
    return db.notes.orderBy("updatedAt").reverse().toArray();
  }, []);

  async function createNote() {
    const now = Date.now();
    const n: Note = {
      id: uid("n_"),
      title: "Untitled",
      createdAt: now,
      updatedAt: now,
    };
    await db.notes.add(n);
    // create initial empty snapshot event so we always have a baseline
    await db.events.add({
      id: uid("e_"),
      noteId: n.id,
      ts: now,
      type: "snapshot",
      snapshotText: "",
      chunkId: String(now),
    });
    navigate(`/note/${n.id}`);
  }

  async function deleteNote(id: string) {
    await db.events.where("noteId").equals(id).delete();
    await db.notes.delete(id);
  }

  return (
    <div>
      <button onClick={createNote} style={{ padding: "8px 12px" }}>
        + New note
      </button>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {(notes ?? []).map((n) => (
          <div
            key={n.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <Link to={`/note/${n.id}`}>{n.title}</Link>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Updated: {new Date(n.updatedAt).toLocaleString()}
              </div>
            </div>

            <button onClick={() => deleteNote(n.id)} style={{ padding: "6px 10px" }}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
