import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seed, type State } from "../shared/domain.ts";

// SQLITE STORAGE: The demo saves to backend/data/fims.sqlite. Tests can use their own in-memory database.
const path =
  process.env.FIMS_DB ??
  (process.env.VITEST ? ":memory:" : resolve("backend/data/fims.sqlite"));
if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec(`CREATE TABLE IF NOT EXISTS snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  data TEXT NOT NULL
)`);

// Convert files to base64 for the saved snapshot. load converts them back to Blobs.
async function encode(state: State) {
  const storeFile = async <T extends { blob: Blob }>(record: T) => ({
    ...record,
    blob: {
      bytes: Buffer.from(await record.blob.arrayBuffer()).toString("base64"),
      type: record.blob.type,
    },
  });
  return JSON.stringify({
    ...state,
    documents: await Promise.all(state.documents.map(storeFile)),
    certificates: await Promise.all(state.certificates.map(storeFile)),
  });
}

const initial = seed();
db.prepare("INSERT OR IGNORE INTO snapshot VALUES (1, ?, ?)").run(
  initial.version,
  JSON.stringify(initial),
);

export async function load(): Promise<State> {
  const row = db.prepare("SELECT data FROM snapshot WHERE id = 1").get()!;
  const state = JSON.parse(String(row.data));
  for (const record of [...state.documents, ...state.certificates]) {
    record.blob = new Blob([Buffer.from(record.blob.bytes, "base64")], {
      type: record.blob.type,
    });
  }
  return state;
}

// Save a change only if the version still matches. This protects a newer edit made in another browser session.
export async function commit(expected: number, apply: (s: State) => void) {
  const state = await load();
  const conflict =
    "This record changed in another view. Your data has been refreshed; review it and try again.";
  if (state.version !== expected) throw new Error(conflict);
  apply(state);
  state.version++;
  const data = await encode(state);
  const result = db
    .prepare(
      "UPDATE snapshot SET version = ?, data = ? WHERE id = 1 AND version = ?",
    )
    .run(state.version, data, expected);
  if (result.changes !== 1) throw new Error(conflict);
  return state;
}

// Restore the fictional starting data and advance the version so older screens cannot overwrite it.
export async function reset() {
  const previous = await load();
  return commit(previous.version, (state) => {
    Object.assign(state, seed(), { version: previous.version });
  });
}
