import Dexie, { Table } from "dexie";

export type Note = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteEvent = {
  id: string;
  noteId: string;
  ts: number;              // timestamp in ms
  type: "snapshot";        // MVP: only snapshots
  snapshotText: string;    // full text snapshot
  chunkId: string;         // groups rapid edits (we'll use ts as chunkId)
};

export class AppDB extends Dexie {
  notes!: Table<Note, string>;
  events!: Table<NoteEvent, string>;

  constructor() {
    super("murphy_notes_db");
    this.version(1).stores({
      notes: "id, updatedAt, createdAt",
      events: "id, noteId, ts, [noteId+ts]",
    });
  }
}

export const db = new AppDB();

export function uid(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}
