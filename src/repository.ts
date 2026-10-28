import { openDB } from "idb";
import { seed, type State } from "./domain";
const db = () =>
  openDB("fims-prototype-v1", 1, {
    upgrade(d) {
      d.createObjectStore("state");
    },
  });
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("fims-updates")
    : null;
const listeners = new Set<() => void>();
channel?.addEventListener("message", () => listeners.forEach((f) => f()));
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function notify() {
  listeners.forEach((f) => f());
  channel?.postMessage("changed");
}
export async function load(): Promise<State> {
  const d = await db();
  const tx = d.transaction("state", "readwrite");
  let state = (await tx.store.get("current")) as State | undefined;
  if (!state) {
    state = seed();
    await tx.store.put(state, "current");
  }
  await tx.done;
  return state;
}
export async function commit(
  expected: number,
  apply: (s: State) => void,
): Promise<State> {
  const d = await db();
  const tx = d.transaction("state", "readwrite");
  try {
    const state = (await tx.store.get("current")) as State;
    if (state.version !== expected)
      throw new Error(
        "This record changed in another view. Your data has been refreshed; review it and try again.",
      );
    apply(state);
    state.version++;
    await tx.store.put(state, "current");
    await tx.done;
    notify();
    return state;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await tx.done.catch(() => {});
    throw e;
  }
}
export async function reset() {
  const d = await db();
  const tx = d.transaction("state", "readwrite");
  const previous = (await tx.store.get("current")) as State | undefined;
  const fresh = seed();
  fresh.version = (previous?.version ?? 0) + 1;
  await tx.store.put(fresh, "current");
  await tx.done;
  notify();
  return fresh;
}
