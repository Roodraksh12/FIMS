import type { State, Role, UserAccount, InductionPlan } from "./domain";
export interface Session {
  userId: string;
  version: number;
  nonce: string;
}
let session: Session | null = null;
try {
  session = JSON.parse(localStorage.getItem("fims-session") || "null");
} catch {
  /* no persisted session */
}
export const getSession = () => session;
export function selectAccount(u: UserAccount | null) {
  session = u
    ? { userId: u.id, version: u.sessionVersion, nonce: crypto.randomUUID() }
    : null;
  try {
    localStorage.setItem("fims-session", JSON.stringify(session));
  } catch {
    /* session remains in memory */
  }
}
export function principal(s: State, expected?: Session): UserAccount {
  if (!session || (expected && expected.nonce !== session.nonce))
    throw new Error(
      "Your session changed. Please retry from the current account.",
    );
  const u = s.users.find((u) => u.id === session!.userId);
  if (!u?.active || u.sessionVersion !== session.version)
    throw new Error("Your session has expired. Please log in again.");
  return u;
}
export function allow(u: UserAccount, ...permitted: Role[]) {
  if (!permitted.includes(u.role))
    throw new Error("Your account is not authorized for this action.");
}
export function scope(s: State, u: UserAccount, p: InductionPlan) {
  const f = s.faculty.find((f) => f.id === p.facultyId)!;
  if (u.role === "NEW_FACULTY" && f.userId === u.id) return;
  if (
    u.role === "FACULTY_MENTOR" &&
    s.assignments.some(
      (a) => a.active && a.facultyId === f.id && a.mentorId === u.id,
    )
  )
    return;
  if (
    u.role === "HOD" &&
    s.departments.some((d) => d.id === f.departmentId && d.hodUserId === u.id)
  )
    return;
  if (["HR_COORDINATOR", "ADMIN"].includes(u.role)) return;
  throw new Error(
    u.role === "FACULTY_MENTOR"
      ? "You are not the assigned mentor for this faculty member."
      : "This dossier does not belong to your department or account.",
  );
}
export function visiblePlans(s: State, u: UserAccount) {
  return s.plans.filter((p) => {
    try {
      scope(s, u, p);
      return true;
    } catch {
      return false;
    }
  });
}
