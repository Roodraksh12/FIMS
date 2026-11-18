import type { State, UserAccount } from "../../shared/domain";
import { ApiError, clearToken, getToken, post, request } from "./api";

// The browser receives record details first. File bytes are fetched separately when the user previews or downloads a file.
export type Workspace = Omit<State, "documents" | "certificates"> & {
  currentUser: UserAccount | null;
  remindersDue: boolean;
  documents: Omit<State["documents"][number], "blob">[];
  certificates: Omit<State["certificates"][number], "blob">[];
};

export async function load(): Promise<Workspace> {
  const token = getToken();
  const signedOut = () =>
    ({
      currentUser: null,
      remindersDue: false,
      version: 0,
      users: [],
      faculty: [],
      departments: [],
      plans: [],
      templates: [],
      tasks: [],
      documents: [],
      assignments: [],
      interactions: [],
      sessions: [],
      attendance: [],
      dossiers: [],
      certificates: [],
      notifications: [],
      audit: [],
    }) as Workspace;
  if (!token) return signedOut();
  try {
    return await request<Workspace>("/state");
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      token === getToken()
    ) {
      clearToken();
      return signedOut();
    }
    throw error;
  }
}

// Poll for newer workspace data so two demo sessions see each other's saved changes.
export function subscribe(fn: () => void) {
  const timer = window.setInterval(fn, 2500);
  return () => window.clearInterval(timer);
}

export async function reset() {
  await post("/reset", null);
  clearToken();
}
