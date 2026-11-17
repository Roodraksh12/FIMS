// SHARED DATA TYPES: The frontend and backend use these same role, status, and record definitions.
export type Role =
  "NEW_FACULTY" | "FACULTY_MENTOR" | "HOD" | "HR_COORDINATOR" | "ADMIN";
export const roles: Record<Role, string> = {
  NEW_FACULTY: "New faculty",
  FACULTY_MENTOR: "Faculty mentor",
  HOD: "Department head",
  HR_COORDINATOR: "HR coordinator",
  ADMIN: "System administrator",
};
export type Pillar = "Documents" | "Mentorship" | "Training";
export type TaskStatus =
  "PENDING" | "UPLOADED" | "VERIFIED" | "COMPLETED" | "REVISION_REQUIRED";
export type PlanStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PENDING_HOD_APPROVAL"
  | "REVISION_REQUIRED"
  | "COMPLETED"
  | "ARCHIVED";
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string;
  active: boolean;
  sessionVersion: number;
}
export interface FacultyProfile {
  id: string;
  userId: string;
  employeeCode: string;
  designation: string;
  joined: string;
  departmentId: string;
  phone?: string;
  inductee: boolean;
}
export interface Department {
  id: string;
  name: string;
  hodUserId: string;
}
export interface InductionPlan {
  id: string;
  facultyId: string;
  status: PlanStatus;
  startDate: string;
  deadline: string;
}
export interface ChecklistTaskTemplate {
  id: string;
  title: string;
  pillar: Pillar;
  mandatory: boolean;
  days: number;
  departmentId?: string;
}
export interface TaskProgress {
  id: string;
  planId: string;
  templateId: string;
  status: TaskStatus;
  due: string;
  remarks: string;
  waiver?: { by: string; reason: string; at: string };
}
export interface DocumentRecord {
  id: string;
  taskId: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
  blob: Blob;
  at: string;
  status:
    "UPLOADED_PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "ARCHIVED";
  remarks: string;
}
export interface MentorAssignment {
  id: string;
  facultyId: string;
  mentorId: string;
  by: string;
  at: string;
  active: boolean;
  reason: string;
}
export interface MentoringInteraction {
  id: string;
  taskId: string;
  assignmentId: string;
  notes: string;
  remarks: string;
  readiness?: number;
  at: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REVISION_REQUIRED";
}
export interface OrientationSession {
  id: string;
  title: string;
  date: string;
  venue: string;
  mandatory: boolean;
  templateId: string;
}
export interface Attendance {
  id: string;
  sessionId: string;
  facultyId: string;
  status: "PRESENT" | "ABSENT";
  by: string;
  at: string;
}
export interface InductionDossier {
  id: string;
  planId: string;
  decision: "PENDING" | "APPROVED" | "RETURNED_WITH_COMMENTS";
  remarks: string;
  at: string;
  history: { action: string; by: string; remarks: string; at: string }[];
}
export interface CompletionCertificate {
  id: string;
  planId: string;
  at: string;
  hodId: string;
  hash: string;
  blob: Blob;
}
export interface Notification {
  id: string;
  userId: string;
  message: string;
  page: string;
  at: string;
  read: boolean;
  emailStatus: "SIMULATED_LOCAL";
}
export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  remarks: string;
  at: string;
}
// A complete workspace snapshot groups all records. The API sends each user the records they can access.
export interface State {
  version: number;
  users: UserAccount[];
  faculty: FacultyProfile[];
  departments: Department[];
  plans: InductionPlan[];
  templates: ChecklistTaskTemplate[];
  tasks: TaskProgress[];
  documents: DocumentRecord[];
  assignments: MentorAssignment[];
  interactions: MentoringInteraction[];
  sessions: OrientationSession[];
  attendance: Attendance[];
  dossiers: InductionDossier[];
  certificates: CompletionCertificate[];
  notifications: Notification[];
  audit: AuditLog[];
}
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
export const date = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(s));
export const time = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
// EDIT PROGRESS RULES: Count satisfied mandatory tasks for the overall progress and each pillar.
export function progress(s: Pick<State, "tasks" | "templates">, planId: string) {
  // Include mandatory tasks for this plan. Optional checklist items do not affect readiness.
  const tasks = s.tasks.filter(
    (t) =>
      t.planId === planId &&
      s.templates.find((x) => x.id === t.templateId)?.mandatory,
  );
  // A task counts as done when verified, completed, or waived. Uploading a file alone does not count.
  const satisfied = (t: TaskProgress) =>
    !!t.waiver || ["VERIFIED", "COMPLETED"].includes(t.status);
  // Calculate the percentage as satisfied divided by total. A pillar with no mandatory tasks is already satisfied.
  const count = (a: TaskProgress[]) => ({
    done: a.filter(satisfied).length,
    total: a.length,
    percent: a.length ? (100 * a.filter(satisfied).length) / a.length : 100,
  });
  return {
    ...count(tasks),
    eligible: tasks.every(satisfied),
    pillars: Object.fromEntries(
      (["Documents", "Mentorship", "Training"] as Pillar[]).map((p) => [
        p,
        count(
          tasks.filter(
            (t) => s.templates.find((x) => x.id === t.templateId)?.pillar === p,
          ),
        ),
      ]),
    ) as Record<Pillar, ReturnType<typeof count>>,
  };
}
// EDIT DEMO DATA: These fictional accounts, tasks, and plans are loaded on first startup or after Reset demo data.
export function seed(): State {
  const at = now();
  // DEMO DEADLINE: Seed tasks are due 14 days after the data is created or reset.
  const deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  // DEMO USERS: Each row supplies ID, display name, email prefix, role, and department.
  const users: UserAccount[] = [
    ["aarav", "Dr. Aarav Sharma", "aarav.sharma", "NEW_FACULTY", "cse"],
    ["rajesh", "Prof. Rajesh Gupta", "rgupta", "FACULTY_MENTOR", "cse"],
    ["sunita", "Dr. Sunita Meena", "hod.cse", "HOD", "cse"],
    ["neha", "Ms. Neha Verma", "hr.induction", "HR_COORDINATOR", "central"],
    ["admin", "Central Administration", "admin", "ADMIN", "central"],
    ["ishita", "Dr. Ishita Rao", "ishita.rao", "NEW_FACULTY", "cse"],
    ["vikram", "Prof. Vikram Singh", "vikram.singh", "FACULTY_MENTOR", "cse"],
    ["kabir", "Dr. Kabir Sethi", "kabir.sethi", "NEW_FACULTY", "ece"],
    ["anita", "Prof. Anita Joshi", "anita.joshi", "FACULTY_MENTOR", "ece"],
    ["ecehod", "Dr. Meera Nair", "hod.ece", "HOD", "ece"],
  ].map(([id, name, email, role, departmentId]) => ({
    id,
    name,
    email: email + "@lnmiit.ac.in",
    role: role as Role,
    departmentId,
    active: true,
    sessionVersion: 1,
  }));
  const faculty = users
    .filter((u) => ["NEW_FACULTY", "FACULTY_MENTOR"].includes(u.role))
    .map((u, i) => ({
      id: "f-" + u.id,
      userId: u.id,
      employeeCode: "LNM-" + (2026101 + i),
      designation:
        u.role === "NEW_FACULTY" ? "Assistant Professor" : "Professor",
      joined: "2026-10-01",
      departmentId: u.departmentId,
      inductee: u.role === "NEW_FACULTY",
    }));
  // DEMO CHECKLIST: Edit task titles, categories, and mandatory flags here. Reset to see seed changes in an existing database.
  const templates: ChecklistTaskTemplate[] = [
    {
      id: "degree",
      title: "Academic qualification certificate",
      pillar: "Documents",
      mandatory: true,
      days: 14,
    },
    {
      id: "joining",
      title: "Signed joining report",
      pillar: "Documents",
      mandatory: true,
      days: 14,
    },
    {
      id: "identity",
      title: "Identity verification",
      pillar: "Documents",
      mandatory: true,
      days: 14,
    },
    {
      id: "research",
      title: "Research & teaching profile",
      pillar: "Documents",
      mandatory: false,
      days: 30,
    },
    {
      id: "orientation",
      title: "Department & laboratory orientation",
      pillar: "Mentorship",
      mandatory: true,
      days: 21,
    },
    {
      id: "syllabus",
      title: "Teaching plan & syllabus review",
      pillar: "Mentorship",
      mandatory: true,
      days: 21,
    },
    {
      id: "policies",
      title: "Institutional policies & pedagogy",
      pillar: "Training",
      mandatory: true,
      days: 28,
    },
    {
      id: "lms",
      title: "LMS essentials workshop",
      pillar: "Training",
      mandatory: true,
      days: 28,
    },
  ];
  const plans: InductionPlan[] = faculty
    .filter((f) => f.inductee)
    .map((f) => ({
      id: "p-" + f.userId,
      facultyId: f.id,
      status: "IN_PROGRESS",
      startDate: "2026-10-01",
      deadline,
    }));
  // STARTING TASK STATUS: Aarav has pre-completed requirements so the demo can focus on upload, mentor sign-off, and approval.
  const tasks: TaskProgress[] = plans.flatMap((p) =>
    templates.map((t) => ({
      id: p.id + "-" + t.id,
      planId: p.id,
      templateId: t.id,
      status: (p.id === "p-aarav"
        ? t.id === "degree" || t.id === "research"
          ? "PENDING"
          : t.id === "orientation"
            ? "PENDING"
            : t.pillar === "Documents"
              ? "VERIFIED"
              : "COMPLETED"
        : "PENDING") as TaskStatus,
      due: deadline,
      remarks: "",
    })),
  );
  const assignments = plans.map((p) => ({
    id: "a-" + p.id,
    facultyId: p.facultyId,
    mentorId:
      p.id === "p-kabir" ? "anita" : p.id === "p-ishita" ? "vikram" : "rajesh",
    by: "neha",
    at,
    active: true,
    reason: "Initial department allocation",
  }));
  const interactions: MentoringInteraction[] = tasks
    .filter(
      (t) =>
        templates.find((x) => x.id === t.templateId)?.pillar === "Mentorship",
    )
    .map((t) => ({
      id: "i-" + t.id,
      taskId: t.id,
      assignmentId: assignments.find(
        (a) => a.facultyId === plans.find((p) => p.id === t.planId)!.facultyId,
      )!.id,
      notes:
        "Reviewed the department facilities and teaching resources. Prepared the induction activity evidence for mentor review.",
      remarks:
        t.status === "COMPLETED" ? "Teaching plan reviewed and approved." : "",
      at,
      status: t.status === "COMPLETED" ? "APPROVED" : "PENDING_REVIEW",
    }));
  // DEMO WORKSHOPS: Edit the workshops shown on Orientation and Training here.
  const sessions: OrientationSession[] = [
    {
      id: "s-policy",
      title: "Institutional policies & pedagogy",
      date: "2026-10-20T04:30:00Z",
      venue: "Academic Block · Seminar Hall",
      mandatory: true,
      templateId: "policies",
    },
    {
      id: "s-lms",
      title: "LMS essentials workshop",
      date: "2026-10-22T08:30:00Z",
      venue: "Computer Centre · Lab 2",
      mandatory: true,
      templateId: "lms",
    },
  ];
  return {
    version: 1,
    users,
    faculty,
    departments: [
      {
        id: "cse",
        name: "Computer Science & Engineering",
        hodUserId: "sunita",
      },
      { id: "ece", name: "Electronics & Communication", hodUserId: "ecehod" },
    ],
    plans,
    templates,
    tasks,
    documents: [],
    assignments,
    interactions,
    sessions,
    attendance: sessions.map((s) => ({
      id: "att-" + s.id,
      sessionId: s.id,
      facultyId: "f-aarav",
      status: "PRESENT",
      by: "neha",
      at,
    })),
    dossiers: [],
    certificates: [],
    notifications: [
      {
        id: "welcome",
        userId: "aarav",
        message:
          "Welcome to LNMIIT. Your induction roadmap is ready. Complete your qualification upload and department orientation review to finish.",
        page: "overview",
        at,
        read: false,
        emailStatus: "SIMULATED_LOCAL",
      },
    ],
    audit: [
      {
        id: "seed",
        actorId: "neha",
        action: "DEMO_INITIALIZED",
        entityId: "cohort",
        remarks:
          "Fictional October 2026 cohort. Previously satisfied items are seeded demonstration records.",
        at,
      },
    ],
  };
}
