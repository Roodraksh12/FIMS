import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  LayoutDashboard,
  Files,
  Users,
  GraduationCap,
  ClipboardCheck,
  Award,
  Bell,
  Settings,
  ScrollText,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Plus,
  Download,
  FileText,
  Upload,
  Search,
  Menu,
  X,
  CalendarDays,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Clock3,
  TriangleAlert,
  BookOpen,
  Building2,
} from "lucide-react";
import {
  type UserAccount,
  type Role,
  type TaskProgress,
  type Pillar,
  roles,
  progress,
  label,
  date,
  time,
} from "../../shared/domain";
import { load, subscribe, reset, type Workspace as State } from "./repository";
import { getToken, signIn, signOut } from "./api";
import { serviceClient } from "./services";
import { validateFile } from "../../shared/files";
import { FacultySubmission, HRInductionRecords } from "./DossierPages";

// EDIT NAVIGATION LABELS: Change the text you see in the sidebar here. Keep the page keys such as overview and reports.
const names: Record<string, string> = {
  overview: "Overview",
  documents: "My documents",
  verification: "Document verification",
  mentorship: "Mentorship",
  training: "Orientation & training",
  approvals: "Induction dossiers",
  certificate: "Certificates",
  people: "Faculty & mentors",
  reports: "Reports & audit",
  notifications: "Notifications",
  settings: "Administration",
};
const icons: Record<string, typeof Files> = {
  overview: LayoutDashboard,
  documents: Files,
  verification: ClipboardCheck,
  mentorship: Users,
  training: GraduationCap,
  approvals: BookOpen,
  certificate: Award,
  people: Users,
  reports: ScrollText,
  notifications: Bell,
  settings: Settings,
};
// EDIT ROLE MENUS: Each list controls which screens a role sees. Server permissions are checked separately in backend/gateway.ts.
const menus: Record<Role, string[]> = {
  NEW_FACULTY: [
    "overview",
    "documents",
    "mentorship",
    "training",
    "approvals",
    "certificate",
    "reports",
    "notifications",
  ],
  FACULTY_MENTOR: [
    "overview",
    "mentorship",
    "training",
    "reports",
    "notifications",
  ],
  HOD: [
    "overview",
    "approvals",
    "training",
    "certificate",
    "reports",
    "notifications",
  ],
  HR_COORDINATOR: [
    "overview",
    "verification",
    "people",
    "training",
    "approvals",
    "certificate",
    "reports",
    "notifications",
  ],
  ADMIN: ["overview", "settings", "reports", "notifications"],
};
const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Prof\.|Ms\.)\s*/, "")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
// STATUS BADGES: This helper chooses a color for a status. The shared label helper formats its text.
function Badge({ value }: { value: string }) {
  const positive = ["VERIFIED", "COMPLETED", "APPROVED", "PRESENT"].includes(
    value,
  );
  const caution = [
    "REVISION_REQUIRED",
    "REJECTED",
    "RETURNED_WITH_COMMENTS",
    "ABSENT",
  ].includes(value);
  return (
    <span
      className={
        "badge " + (positive ? "positive" : caution ? "caution" : "neutral")
      }
    >
      <span />
      {value === "UPLOADED_PENDING_VERIFICATION"
        ? "Awaiting verification"
        : label(value)}
    </span>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <CheckCircle2 size={30} />
      <h3>{title}</h3>
      <p>{children || "There are no items to display here yet."}</p>
    </div>
  );
}
// SHARED DIALOG: Change popup layout or close behavior here. Find each popup's content near modal.kind below.
function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="dialog-heading"
    >
      <div className="dialog-head">
        <h2 id="dialog-heading">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
// SHARED DIALOG FORM: Handles submission for popup forms. The sign-in form below has its own submit handler.
function Form({
  children,
  onSubmit,
  busy,
  text = "Save changes",
  secondary,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => void;
  busy: boolean;
  text?: string;
  secondary?: ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
      <div className="form-actions">
        {secondary}
        <button className="button primary" disabled={busy} type="submit">
          {busy ? "Saving…" : text}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
// SHARED FORM FIELD: This component wraps its input in a label. Place extra buttons outside the Field.
function Field({
  name,
  title,
  children,
  defaultValue = "",
  type = "text",
  required = false,
}: {
  name: string;
  title: string;
  children?: ReactNode;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      {title}
      {children || (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
        />
      )}
    </label>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// MAIN SCREEN: This component holds sign-in, role dashboards, navigation, and most workflow dialogs.
export default function App() {
  // PAGE STATE: The workspace comes from the server. The URL hash selects the page, and planId selects the faculty record.
  const [state, setState] = useState<State | null>(null),
    [user, setUser] = useState<UserAccount | null>(null),
    [page, setPage] = useState(location.hash.slice(1) || "overview"),
    [planId, setPlanId] = useState("p-aarav");
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState<{ kind: string; id?: string } | null>(null),
    [query, setQuery] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [hash, setHash] = useState(""),
    [preview, setPreview] = useState<string | null>(null);
  const [hrDossierId, setHrDossierId] = useState<string | null>(null);
  // SIGN-IN INPUT STATE: These hold the typed email and password. Add local form options here, such as password visibility.
  const [loginEmail, setLoginEmail] = useState(""),
    [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // LOAD THE WORKSPACE: Refresh the signed-in user's records. Background refresh lets different browser sessions see saved changes.
  const refresh = async (background = false) => {
    const token = getToken();
    try {
      const result = await load();
      if (getToken() && getToken() !== token) return;
      if (token && !getToken() && result.currentUser) return;
      setState((current) =>
        current &&
        current.currentUser?.id === result.currentUser?.id &&
        (current.version > result.version ||
          (current.version === result.version && current.remindersDue === result.remindersDue))
          ? current
          : result,
      );
      setUser(result.currentUser);
      setError((previous) => previous === "Could not reach the FIMS server. Check that npm run dev is running." ? "" : previous);
    } catch {
      if (!background) setError("Could not reach the FIMS server. Check that npm run dev is running.");
    }
  };
  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh(true));
  }, []);
  useEffect(() => {
    const fn = () => {
      setPage(location.hash.slice(1) || "overview");
      setQuery("");
    };
    addEventListener("hashchange", fn);
    return () => removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (state?.remindersDue && user)
      void serviceClient(state.version).reminders().catch(() => {});
  }, [state?.version, user?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const navigate = (p: string) => {
    location.hash = p;
    setMobile(false);
    setError("");
  };
  const open = (kind: string, id?: string) => {
    setModal({ kind, id });
    setError("");
    setFile(null);
    setHash("");
  };
  const close = () => {
    setModal(null);
    setError("");
    setPreview(null);
  };
  // RUN A SAVE ACTION: Prevent duplicate clicks, call the API, then refresh the screen and show a success or error message.
  async function run(
    work: () => Promise<unknown>,
    message = "Changes saved.",
    dismiss = true,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
      setToast(message);
      if (dismiss) close();
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please retry.",
      );
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  // SIGN-IN ACTION: The form sends credentials to the API. The server verifies credentials before creating a session.
  const login = async (input: { email: string; password: string }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(input);
      setShowPassword(false);
      setLoginPassword("");
      await refresh();
      setPlanId("p-aarav");
      setHrDossierId(null);
      navigate("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };
  const logout = () => {
    void signOut().catch(() => {});
    setUser(null);
    setModal(null);
    setError("");
    void refresh();
  };
  if (!state)
    return (
      <div className="loading">
        <img src="/lnmiit-logo.jpeg" alt="LNMIIT" />
        <h2>Preparing your workspace…</h2>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  // EDIT THE SIGN-IN SCREEN: The block below contains the welcome text, email and password inputs, submit button, and demo accounts.
  if (!user)
    return (
      <main className="login">
        <section className="login-story">
          <div className="institute">
            <img src="/lnmiit-logo.jpeg" alt="LNMIIT crest" />
            <span>
              THE LNM INSTITUTE OF
              <br />
              INFORMATION TECHNOLOGY, JAIPUR
            </span>
          </div>
          <div className="login-copy">
            <span className="wordmark">
              FIMS<span> / Faculty Induction</span>
            </span>
            <h1>Faculty induction</h1>
            <p>
              Manage your joining documents, orientation sessions and
              departmental approvals.
            </p>
            <ol className="joining-steps">
              <li>
                <strong>Submit your documents</strong>
                <span>Upload the required scans for HR to verify.</span>
              </li>
              <li>
                <strong>Complete your orientation</strong>
                <span>Attend training and meet with your assigned mentor.</span>
              </li>
              <li>
                <strong>Get the final sign-off</strong>
                <span>
                  Submit your completed record to the department head.
                </span>
              </li>
            </ol>
          </div>
          <div className="login-footer">
            CS314 · SOFTWARE DEVELOPMENT LABORATORY <span>TEAM T077</span>
          </div>
        </section>
        <section className="login-form">
          <div className="login-form-inner">
            <span className="local-label">
              <span />
              Local academic prototype
            </span>
            <h2>Sign in to FIMS</h2>
            <p className="muted">Use your institutional email to continue.</p>
            <form
              // SIGN-IN SUBMIT: Pass the typed email and password to login without reloading the page.
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void login({ email: loginEmail, password: loginPassword });
              }}
            >
              {/* EMAIL FIELD: Change its label or placeholder here. The onChange below saves what the user types. */}
              <Field name="email" title="Institutional email">
                <input
                  type="email"
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@lnmiit.ac.in"
                  required
                />
              </Field>
              {/* PASSWORD FIELD: The button flips visibility without submitting the form. */}
              <div className="field">
                <label htmlFor="login-password">Password</label>
                <div className="login-password-control">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    aria-controls="login-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {error && (
                <div role="alert" className="alert error">
                  {error}
                </div>
              )}
              {/* SIGN-IN BUTTON: Change the visible wording here. This button submits the form above. */}
              <button className="button primary wide">
                Sign in <ArrowRight size={18} />
              </button>
            </form>
            <p className="fine">Sign in with the credentials assigned to your account.</p>
          </div>
        </section>
      </main>
    );
  // SIGNED-IN DATA: The following helpers choose the active plan, resolve display names, and calculate screen data from the workspace.
  const s = state,
    u = user,
    service = () => serviceClient(s.version);
  const plans = s.plans,
    plan = plans.find((p) => p.id === planId) || plans[0];
  const faculty = plan ? s.faculty.find((f) => f.id === plan.facultyId)! : null;
  const facultyUser = faculty
    ? s.users.find((u) => u.id === faculty.userId)!
    : null;
  const stats = plan ? progress(s, plan.id) : null;
  const taskRows = plan ? s.tasks.filter((t) => t.planId === plan.id) : [];
  const template = (t: TaskProgress) =>
    s.templates.find((x) => x.id === t.templateId)!;
  const person = (id: string) =>
    s.users.find((u) => u.id === id)?.name || "Archived account";
  const dept = (id: string) =>
    s.departments.find((d) => d.id === id)?.name || "Central administration";
  const unread = s.notifications.filter(
    (n) => n.userId === u.id && !n.read,
  ).length;
  const actualPage = menus[u.role].includes(page) ? page : "overview";
  // ROLE-SPECIFIC PAGE NAMES: The dossier page has a different name for faculty, HR, and HOD.
  const pageLabel = (key: string) =>
    key === "approvals"
      ? u.role === "NEW_FACULTY"
        ? "My submission"
        : u.role === "HR_COORDINATOR"
          ? "Induction records"
          : "Review & approve"
      : names[key];
  const pageTitle =
    actualPage === "approvals"
      ? u.role === "NEW_FACULTY"
        ? "My induction submission"
        : u.role === "HR_COORDINATOR"
          ? "Faculty induction records"
          : "Review & approve inductions"
      : names[actualPage];
  const locked =
    !!plan &&
    ["COMPLETED", "ARCHIVED", "PENDING_HOD_APPROVAL"].includes(plan.status);
  const dossier = plan ? s.dossiers.find((d) => d.planId === plan.id) : null;
  const assignment = plan
    ? s.assignments.find((a) => a.facultyId === plan.facultyId && a.active)
    : null;
  // HR QUEUE FILTER: Only documents waiting for verification appear in the review queue.
  const pendingDocs = s.documents.filter(
    (d) => d.status === "UPLOADED_PENDING_VERIFICATION",
  );
  // TASK SEARCH: Compare the search box text with each task's title without matching letter case.
  const filteredTasks = taskRows.filter((t) =>
    template(t).title.toLowerCase().includes(query.toLowerCase()),
  );
  const section = (
    title: string,
    subtitle: string,
    children: ReactNode,
    action?: ReactNode,
  ) => (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
  // FACULTY RECORD PICKER: The chosen plan controls which faculty member's tasks and records appear.
  const planPicker =
    plans.length > 1 ? (
      <label className="plan-picker">
        Faculty record
        <select
          aria-label="Faculty record"
          value={plan?.id || ""}
          onChange={(e) => {
            setPlanId(e.target.value);
            setQuery("");
          }}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {person(s.faculty.find((f) => f.id === p.facultyId)!.userId)}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  // PILLAR CARDS: Change how Documents, Mentorship, and Training progress are displayed here.
  const pillarDisplay = stats && (
    <div className="pillars">
      {(["Documents", "Mentorship", "Training"] as Pillar[]).map((p, i) => {
        const x = stats.pillars[p];
        const Icon = [Files, Users, GraduationCap][i];
        return (
          <div className="pillar" key={p}>
            <div>
              <Icon size={19} />
              <span>{p}</span>
              <strong>{Math.round(x.percent)}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: x.percent + "%" }} />
            </div>
            <small>
              {x.done} of {x.total} requirements satisfied
            </small>
          </div>
        );
      })}
    </div>
  );
  // NEXT ACTION: Work out what to show based on the selected plan's progress and status.
  const nextStep = plan
    ? plan.status === "COMPLETED"
      ? "Your induction is complete. Your certificate is ready."
      : plan.status === "PENDING_HOD_APPROVAL"
        ? "Your dossier is with the department head for final review."
        : stats?.eligible
          ? "All required milestones are satisfied. Submit your dossier for final review."
          : "Complete the remaining mandatory requirements to submit your induction."
    : "";
  // DOSSIER SUBMIT BUTTON: UI conditions decide availability here. Services.submit enforces readiness on the server.
  const submitButton =
    plan && ["NEW_FACULTY", "HR_COORDINATOR"].includes(u.role) && !locked ? (
      <button
        className="button primary"
        disabled={!stats?.eligible || busy}
        onClick={() =>
          void run(
            () => service().submit(plan.id),
            "Dossier submitted for HOD review.",
          )
        }
      >
        Submit for final review <ArrowUpRight size={16} />
      </button>
    ) : null;
  // DOCUMENT PICKER: Validate the file and show its hash before upload. The backend checks the upload again.
  async function chooseFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setFile(f);
    setHash("");
    try {
      const result = await validateFile(f);
      setHash(result.hash);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function showDocument(id: string) {
    await run(
      async () => {
        const d = await service().document(id);
        setPreview(URL.createObjectURL(d.blob));
        setModal({ kind: "preview", id });
      },
      "Document opened.",
      false,
    );
  }
  // SHARED TASK TABLE: Change common task cards, status, and empty-list messages here.
  const taskTable = (
    rows: TaskProgress[],
    actions: (t: TaskProgress) => ReactNode,
  ) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Status</th>
            <th>Due date</th>
            <th className="align-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <div className="table-title">
                  <span
                    className={
                      "file-icon " +
                      (template(t).pillar === "Mentorship" ? "gold" : "")
                    }
                  >
                    <FileText size={19} />
                  </span>
                  <div>
                    <strong>{template(t).title}</strong>
                    <small>
                      {template(t).mandatory ? "Required" : "Optional"}
                      {t.remarks ? " · " + t.remarks : ""}
                      {t.waiver ? " · Waiver: " + t.waiver.reason : ""}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                {t.waiver ? (
                  <Badge value="COMPLETED" />
                ) : (
                  <Badge value={t.status} />
                )}
              </td>
              <td className="muted">
                {date(t.due)}
                {new Date(t.due) < new Date() &&
                  !["VERIFIED", "COMPLETED"].includes(t.status) &&
                  !t.waiver && <small className="overdue">Overdue</small>}
              </td>
              <td className="align-right">{actions(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty title="No matching requirements" />}
    </div>
  );
  // COMPLIANCE COUNTS: Count pending mandatory tasks and check their due dates for overdue work.
  const compliance = (id: string) => {
    const pending = s.tasks.filter(
      (t) =>
        t.planId === id &&
        template(t).mandatory &&
        !t.waiver &&
        !["VERIFIED", "COMPLETED"].includes(t.status),
    );
    return {
      pending: pending.length,
      overdue: pending.filter((t) => new Date(t.due).getTime() < Date.now())
        .length,
    };
  };
  // EDIT A SCREEN: Search for actualPage followed by its page key. Each branch below renders one sidebar screen.
  let content: ReactNode;
  // FACULTY DASHBOARD AND ROLE HOME PAGES: Edit progress cards, next steps, and role summaries here.
  if (actualPage === "overview") {
    if (u.role === "NEW_FACULTY" && plan && stats) {
      content = (
        <>
          <div className="welcome">
            <div>
              <h1>My induction</h1>
              <p>
                {u.name} · {dept(faculty!.departmentId)}
              </p>
            </div>
            <span className="date-chip">
              <CalendarDays size={16} />
              {date(new Date().toISOString())}
            </span>
          </div>
          <div className="faculty-record">
            <span>
              <strong>{faculty!.employeeCode}</strong>Employee code
            </span>
            <span>
              <strong>{date(faculty!.joined)}</strong>Date of joining
            </span>
            <span>
              <strong>{date(plan.deadline)}</strong>Complete induction by
            </span>
            <Badge value={plan.status} />
          </div>
          <div className="faculty-layout">
            <div className="faculty-work">
              {section(
                stats.eligible
                  ? "Ready for the next step"
                  : "Still to be completed",
                stats.eligible
                  ? nextStep
                  : `${stats.total - stats.done} required items remain. Select an item to see what is needed.`,
                <div className="next-list">
                  {taskRows
                    .filter(
                      (t) =>
                        template(t).mandatory &&
                        !["VERIFIED", "COMPLETED"].includes(t.status) &&
                        !t.waiver,
                    )
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() =>
                          navigate(
                            template(t).pillar === "Documents"
                              ? "documents"
                              : template(t).pillar === "Mentorship"
                                ? "mentorship"
                                : "training",
                          )
                        }
                      >
                        <span className="step-dot">
                          {template(t).pillar === "Documents" ? (
                            <Files size={19} />
                          ) : template(t).pillar === "Mentorship" ? (
                            <Users size={19} />
                          ) : (
                            <GraduationCap size={19} />
                          )}
                        </span>
                        <span>
                          <strong>{template(t).title}</strong>
                          <small>
                            {t.status === "UPLOADED"
                              ? "Submitted · waiting for HR verification"
                              : t.status === "REVISION_REQUIRED"
                                ? t.remarks || "Changes requested"
                                : template(t).pillar === "Mentorship"
                                  ? "Waiting for mentor sign-off"
                                  : template(t).pillar === "Training"
                                    ? "Attendance or completion needs to be recorded"
                                    : "Upload a clear PDF, JPG or PNG, up to 5 MB"}
                          </small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  {stats.eligible && (
                    <div className="completion-next">
                      <CheckCircle2 />
                      <p>{nextStep}</p>
                      {submitButton}
                      {plan.status === "COMPLETED" && (
                        <button
                          className="button primary"
                          onClick={() => navigate("certificate")}
                        >
                          Download certificate <Download size={17} />
                        </button>
                      )}
                    </div>
                  )}
                </div>,
              )}
              <div className="submission-note">
                <Clock3 size={17} />
                <p>
                  Once every required item is complete, submit your dossier to
                  the department head for approval. Uploading a document alone
                  does not mark it as verified.
                </p>
              </div>
            </div>
            <aside className="faculty-aside" aria-label="Induction details">
              <section className="progress-summary">
                <h2>Completion</h2>
                <div className="completion-count">
                  <strong>
                    {stats.done}
                    <span> / {stats.total}</span>
                  </strong>
                  <p>required items complete</p>
                </div>
                {pillarDisplay}
              </section>
              <section className="mentor-note">
                <h2>Your mentor</h2>
                <div className="mentor-person">
                  <span className="avatar large">
                    {assignment ? initials(person(assignment.mentorId)) : "—"}
                  </span>
                  <div>
                    <strong>
                      {assignment
                        ? person(assignment.mentorId)
                        : "Not yet assigned"}
                    </strong>
                    <small>
                      {faculty!.departmentId.toUpperCase()} · Faculty mentor
                    </small>
                  </div>
                </div>
                {assignment && (
                  <p className="mentor-email">
                    {s.users.find((x) => x.id === assignment.mentorId)?.email}
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() => navigate("mentorship")}
                >
                  Meetings & feedback <ArrowRight size={16} />
                </button>
              </section>
            </aside>
          </div>
          {section(
            "Induction checklist",
            `${stats.done} of ${stats.total} required items complete. Optional items do not affect approval.`,
            taskTable(taskRows, (t) => (
              <button
                className="text-button"
                onClick={() =>
                  navigate(
                    template(t).pillar === "Documents"
                      ? "documents"
                      : template(t).pillar === "Training"
                        ? "training"
                        : "mentorship",
                  )
                }
              >
                View details <ArrowRight size={15} />
              </button>
            )),
          )}
        </>
      );
    } else {
      const total = plans.length,
        complete = plans.filter((p) => p.status === "COMPLETED").length,
        pending = plans.filter(
          (p) => p.status === "PENDING_HOD_APPROVAL",
        ).length;
      content = (
        <>
          <div className="welcome">
            <div>
              <h1>
                {u.role === "HR_COORDINATOR"
                  ? "Induction desk"
                  : u.role === "HOD"
                    ? "Department inductions"
                    : u.role === "FACULTY_MENTOR"
                      ? "My mentees"
                      : "Administration"}
              </h1>
              <p>{roles[u.role]} workspace · October 2026 induction cohort</p>
            </div>
            <span className="date-chip">
              <CalendarDays size={16} />
              {date(new Date().toISOString())}
            </span>
          </div>
          <div className="metric-strip">
            <div>
              <span>Faculty records</span>
              <strong>{total.toString()}</strong>
            </div>
            <div>
              <span>Completed inductions</span>
              <strong>{complete.toString()}</strong>
            </div>
            <div>
              <span>Awaiting HOD review</span>
              <strong>{pending.toString()}</strong>
            </div>
            <div>
              <span>
                {u.role === "HR_COORDINATOR"
                  ? "Documents to verify"
                  : "Unread updates"}
              </span>
              <strong>
                {(u.role === "HR_COORDINATOR"
                  ? pendingDocs.length
                  : unread
                ).toString()}
              </strong>
            </div>
          </div>
          {section(
            "Faculty induction worklist",
            "Progress and next actions within your scope.",
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Faculty member</th>
                    <th>Department</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const f = s.faculty.find((f) => f.id === p.facultyId)!,
                      pr = progress(s, p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{person(f.userId)}</strong>
                          <small>
                            {f.employeeCode}
                            {f.phone ? " · " + f.phone : ""}
                          </small>
                        </td>
                        <td>{f.departmentId.toUpperCase()}</td>
                        <td>
                          <span className="inline-progress">
                            <span style={{ width: pr.percent + "%" }} />
                          </span>{" "}
                          {Math.round(pr.percent)}%
                        </td>
                        <td>
                          <Badge value={p.status} />
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setPlanId(p.id);
                              navigate(
                                u.role === "FACULTY_MENTOR"
                                  ? "mentorship"
                                  : u.role === "HR_COORDINATOR"
                                    ? "people"
                                    : u.role === "ADMIN"
                                      ? "reports"
                                      : "approvals",
                              );
                            }}
                          >
                            Open record <ArrowUpRight size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>,
          )}
          <div className="info-banner">
            <ShieldCheck size={23} />
            <div>
              <strong>About this prototype</strong>
              <p>
                Changes are stored by the local FIMS server and shared across demo accounts.
                Sign out and sign in to another account to follow the full induction
                workflow.
              </p>
            </div>
          </div>
        </>
      );
    }
  // MY DOCUMENTS: Edit the faculty checklist, upload entry point, and document history here.
  } else if (actualPage === "documents")
    content = (
      <>
        {pillarDisplay}
        {section(
          "Your document checklist",
          "Submit clear scans. HR verification counts toward completion.",
          taskTable(
            filteredTasks.filter((t) => template(t).pillar === "Documents"),
            (t) => {
              const current = s.documents
                .filter((d) => d.taskId === t.id && d.status !== "ARCHIVED")
                .at(-1);
              return (
                <div className="row-actions">
                  {current && (
                    <button
                      className="text-button"
                      onClick={() => void showDocument(current.id)}
                    >
                      Preview
                    </button>
                  )}
                  {!locked &&
                    ["PENDING", "REVISION_REQUIRED"].includes(t.status) && (
                      <button
                        className="button small-button"
                        onClick={() => open("upload", t.id)}
                      >
                        <Upload size={15} />
                        {t.status === "REVISION_REQUIRED"
                          ? "Re-upload"
                          : "Upload"}
                      </button>
                    )}
                </div>
              );
            },
          ),
          <a className="text-button" href="/samples/qualification.pdf" download>
            Sample document <Download size={16} />
          </a>,
        )}
        {section(
          "Submission history",
          "Previous revisions remain available for reference.",
          <div className="history-list">
            {s.documents
              .filter((d) => taskRows.some((t) => t.id === d.taskId))
              .map((d) => (
                <div key={d.id}>
                  <FileText size={19} />
                  <div>
                    <strong>{d.name}</strong>
                    <small>
                      {time(d.at)} · SHA-256: {d.hash.slice(0, 16)}…
                    </small>
                  </div>
                  <Badge value={d.status} />
                  <button
                    className="text-button"
                    onClick={() => void showDocument(d.id)}
                  >
                    View
                  </button>
                </div>
              ))}
            {!s.documents.some((d) =>
              taskRows.some((t) => t.id === d.taskId),
            ) && (
              <Empty
                title="Your document history starts here"
                children="Uploads and reviewer feedback will appear here."
              />
            )}
          </div>,
        )}
      </>
    );
  // HR DOCUMENT QUEUE: Edit the list of uploaded documents waiting for HR review here.
  else if (actualPage === "verification")
    content = section(
      "Verification queue",
      `${pendingDocs.length} document${pendingDocs.length === 1 ? "" : "s"} awaiting your review.`,
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Faculty member</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingDocs
              .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
              .map((d) => {
                const task = s.tasks.find((t) => t.id === d.taskId)!,
                  p = s.plans.find((p) => p.id === task.planId)!,
                  f = s.faculty.find((f) => f.id === p.facultyId)!;
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{template(task).title}</strong>
                      <small>
                        {d.name} · {(d.size / 1024).toFixed(1)} KB
                      </small>
                    </td>
                    <td>{person(f.userId)}</td>
                    <td>{time(d.at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => void showDocument(d.id)}
                        >
                          Inspect
                        </button>
                        <button
                          className="button small-button"
                          onClick={() => open("review-doc", d.id)}
                        >
                          Review <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!pendingDocs.length && (
          <Empty
            title="The queue is clear"
            children="Documents submitted by faculty will appear here for inspection."
          />
        )}
      </div>,
    );
  // MENTORSHIP SCREEN: Edit activity cards, review buttons, and the interaction timeline here.
  else if (actualPage === "mentorship")
    content = plan ? (
      <>
        {planPicker}
        <div className="record-heading">
          <span className="avatar large">{initials(facultyUser!.name)}</span>
          <div>
            <h2>{facultyUser!.name}</h2>
            <p>
              Mentor: {assignment ? person(assignment.mentorId) : "Unassigned"}{" "}
              · {faculty?.departmentId.toUpperCase()}
            </p>
          </div>
          <Badge value={plan.status} />
        </div>
        {section(
          "Mentorship activities",
          "Evidence, meaningful feedback, and a clear path forward.",
          taskTable(
            filteredTasks.filter((t) => template(t).pillar === "Mentorship"),
            (t) => (
              <div className="row-actions">
                <button
                  className="text-button"
                  onClick={() => open("activity", t.id)}
                >
                  View evidence
                </button>
                {!locked &&
                  t.status !== "COMPLETED" &&
                  (u.role === "FACULTY_MENTOR" ? (
                    <button
                      className="button small-button"
                      onClick={() => open("mentor-review", t.id)}
                    >
                      Review
                    </button>
                  ) : (
                    <button
                      className="button small-button"
                      onClick={() => open("meeting", t.id)}
                    >
                      {t.status === "REVISION_REQUIRED"
                        ? "Resubmit evidence"
                        : "Add notes"}
                    </button>
                  ))}
              </div>
            ),
          ),
        )}
        {section(
          "Interaction timeline",
          "Notes and review decisions, in chronological order.",
          <div className="timeline">
            {s.audit
              .filter(
                (a) =>
                  taskRows.some((t) => t.id === a.entityId) &&
                  /MENTOR|MEETING/.test(a.action),
              )
              .map((a) => (
                <div key={a.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{label(a.action)}</strong>
                    <p>{a.remarks}</p>
                    <small>
                      {person(a.actorId)} · {time(a.at)}
                    </small>
                  </div>
                </div>
              ))}
            {!s.audit.some(
              (a) =>
                taskRows.some((t) => t.id === a.entityId) &&
                /MENTOR|MEETING/.test(a.action),
            ) && (
              <Empty
                title="A conversation worth recording"
                children="Meeting notes, revision requests, and sign-offs will appear here."
              />
            )}
          </div>,
        )}
      </>
    ) : (
      <Empty title="No assigned mentees" />
    );
  // ORIENTATION AND TRAINING: Edit session cards and attendance controls here.
  else if (actualPage === "training")
    content = (
      <>
        {planPicker}
        {u.role === "HR_COORDINATOR" && (
          <div className="toolbar">
            <p className="muted">
              Create sessions and maintain attendance for each faculty member.
            </p>
            <button className="button primary" onClick={() => open("session")}>
              <Plus size={17} />
              Schedule session
            </button>
          </div>
        )}
        {s.sessions.map((session) => {
          const t = taskRows.find((t) => t.templateId === session.templateId);
          return (
            <section key={session.id} className="session-panel">
              <div className="session-date">
                <span>
                  {new Date(session.date).toLocaleString("en-IN", {
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
                <strong>
                  {new Date(session.date).toLocaleString("en-IN", {
                    day: "2-digit",
                    timeZone: "Asia/Kolkata",
                  })}
                </strong>
              </div>
              <div className="session-details">
                <h2>{session.title}</h2>
                <p>
                  {session.venue} · {time(session.date)} IST
                </p>
                <small>
                  {session.mandatory
                    ? "Mandatory orientation"
                    : "Optional workshop"}
                  {t?.waiver ? " · Waived: " + t.waiver.reason : ""}
                </small>
              </div>
              {t ? (
                <Badge value={t.waiver ? "COMPLETED" : t.status} />
              ) : (
                <span className="muted">Not assigned</span>
              )}
              {t && !locked && (
                <div className="row-actions">
                  {u.role === "HR_COORDINATOR" && (
                    <button
                      className="button small-button"
                      disabled={busy || !!t.waiver}
                      onClick={() =>
                        void run(
                          () =>
                            service().attendance(
                              session.id,
                              plan!.facultyId,
                              t.status !== "COMPLETED",
                            ),
                          "Attendance updated.",
                        )
                      }
                    >
                      {t.status === "COMPLETED"
                        ? "Mark absent"
                        : "Mark present"}
                    </button>
                  )}
                  {u.role === "HOD" &&
                    t.status !== "COMPLETED" &&
                    !t.waiver && (
                      <button
                        className="text-button"
                        onClick={() => open("waiver", t.id)}
                      >
                        Grant waiver
                      </button>
                    )}
                </div>
              )}
            </section>
          );
        })}
        {section(
          "Training requirements",
          "Completion is based on recorded attendance or an approved waiver.",
          taskTable(
            taskRows.filter((t) => template(t).pillar === "Training"),
            (t) =>
              u.role === "HR_COORDINATOR" &&
              !locked &&
              !t.waiver &&
              !s.sessions.some((x) => x.templateId === t.templateId) ? (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        service().completeTraining(
                          t.id,
                          t.status !== "COMPLETED",
                        ),
                      "Training completion recorded.",
                    )
                  }
                >
                  {t.status === "COMPLETED"
                    ? "Reopen requirement"
                    : "Record completion"}
                </button>
              ) : (
                <span className="muted">
                  {t.waiver
                    ? "Waived by HOD"
                    : t.status === "COMPLETED"
                      ? "Completion recorded"
                      : "Awaiting completion"}
                </span>
              ),
          ),
        )}
      </>
    );
  // FACULTY SUBMISSION: The layout lives in FacultySubmission in DossierPages.tsx.
  else if (actualPage === "approvals" && u.role === "NEW_FACULTY")
    content = plan ? (
      <FacultySubmission
        state={s}
        plan={plan}
        busy={busy}
        badge={(value) => <Badge value={value} />}
        navigate={navigate}
        submit={(id) =>
          void run(
            () => service().submit(id),
            "Your dossier has been submitted to the HOD.",
          )
        }
      />
    ) : (
      <Empty
        title="No induction record assigned"
        children="Contact HR to initialize your induction plan."
      />
    );
  // HR INDUCTION RECORDS: The queue and detail layout live in HRInductionRecords in DossierPages.tsx.
  else if (actualPage === "approvals" && u.role === "HR_COORDINATOR")
    content = (
      <HRInductionRecords
        state={s}
        plans={plans}
        selectedId={hrDossierId}
        onSelect={(id) => {
          setHrDossierId(id);
          if (id) setPlanId(id);
        }}
        busy={busy}
        badge={(value) => <Badge value={value} />}
        navigate={navigate}
        submit={(id) =>
          void run(
            () => service().submit(id),
            "Faculty record forwarded to the HOD by HR.",
          )
        }
        inspect={(id) => void showDocument(id)}
        viewEvidence={(id) => open("activity", id)}
      />
    );
  // HOD DOSSIER REVIEW: Edit the evidence and approval controls here. Backend eligibility is checked in Services.approve.
  else if (actualPage === "approvals")
    content = plan ? (
      <>
        {planPicker}
        <section className="induction-summary">
          <div className="summary-top">
            <div>
              <h2>{facultyUser!.name}</h2>
              <p>
                {dept(faculty!.departmentId)} · {faculty!.employeeCode}
              </p>
            </div>
            <Badge value={plan.status} />
          </div>
          {pillarDisplay}
          <div className="summary-bottom">
            <span>
              {plan.status === "PENDING_HOD_APPROVAL"
                ? "Submitted for your departmental review."
                : ["COMPLETED", "ARCHIVED"].includes(plan.status)
                  ? "Final approval has been recorded. The completion certificate is available."
                  : "This record has not been submitted for final approval."}
            </span>
          </div>
        </section>
        {dossier?.remarks && (
          <div className="info-banner">
            <FileText />
            <div>
              <strong>Latest HOD remarks</strong>
              <p>{dossier.remarks}</p>
            </div>
          </div>
        )}
        {u.role === "HOD" ? (
          <section className="decision-bar">
            <div>
              <h3>Final induction review</h3>
              <p>
                {["COMPLETED", "ARCHIVED"].includes(plan.status)
                  ? "This induction has already been approved."
                  : plan.status !== "PENDING_HOD_APPROVAL"
                    ? "Faculty or HR must submit this record before you can record a final decision."
                    : stats?.eligible
                      ? "Review the evidence before approving or returning this dossier."
                      : "Cannot approve induction: Milestones pending completion."}
              </p>
            </div>
            <div className="row-actions">
              <button
                className="button"
                disabled={plan.status !== "PENDING_HOD_APPROVAL" || busy}
                onClick={() => open("return", plan.id)}
              >
                Return with directives
              </button>
              <button
                className="button primary"
                disabled={
                  !stats?.eligible ||
                  plan.status !== "PENDING_HOD_APPROVAL" ||
                  busy
                }
                onClick={() => open("approve", plan.id)}
              >
                Approve induction <Check size={16} />
              </button>
            </div>
          </section>
        ) : (
          <div className="toolbar">
            <p className="muted">{nextStep}</p>
            {submitButton}
          </div>
        )}
        {section(
          "Consolidated evidence",
          "Required documents, departmental milestones, and training attendance.",
          taskTable(taskRows, (t) => {
            const d = s.documents.find(
              (d) => d.taskId === t.id && d.status === "VERIFIED",
            );
            return d && u.role === "HOD" ? (
              <button
                className="text-button"
                onClick={() => void showDocument(d.id)}
              >
                Inspect file
              </button>
            ) : template(t).pillar === "Mentorship" ? (
              <button
                className="text-button"
                onClick={() => open("activity", t.id)}
              >
                View evidence
              </button>
            ) : (
              <span className="muted">
                {t.waiver ? "Waiver approved" : template(t).pillar}
              </span>
            );
          }),
        )}
        {section(
          "Dossier decision history",
          "Submission and review records are retained.",
          <div className="timeline">
            {dossier?.history.map((h, i) => (
              <div key={i}>
                <span className="timeline-dot" />
                <div>
                  <strong>{label(h.action)}</strong>
                  <p>{h.remarks}</p>
                  <small>
                    {person(h.by)} · {time(h.at)}
                  </small>
                </div>
              </div>
            ))}
            {!dossier && (
              <Empty
                title="Not yet submitted"
                children="Faculty or HR can submit this record once all mandatory clearances are complete."
              />
            )}
          </div>,
        )}
      </>
    ) : (
      <Empty title="No dossiers in your scope" />
    );
  // CERTIFICATE SCREEN: Edit the download UI here. The PDF design is in backend/certificate.ts.
  else if (actualPage === "certificate") {
    const certificates = s.certificates.filter((c) =>
      plans.some((p) => p.id === c.planId),
    );
    content = certificates.length ? (
      <>
        {certificates.map((c) => {
          const p = s.plans.find((p) => p.id === c.planId)!,
            f = s.faculty.find((f) => f.id === p.facultyId)!;
          return (
            <section className="certificate-card" key={c.id}>
              <Award size={42} />
              <h2>Induction completed</h2>
              <p>
                {person(f.userId)} has completed the faculty induction
                programme.
              </p>
              <div className="certificate-paper">
                <img src="/lnmiit-logo.jpeg" alt="LNMIIT crest" />
                <strong>THE LNM INSTITUTE OF INFORMATION TECHNOLOGY</strong>
                <small>Jaipur, Rajasthan</small>
                <h3>Certificate of Induction Completion</h3>
                <p>This is to certify that</p>
                <h2>{person(f.userId)}</h2>
                <p>
                  {f.employeeCode} · {dept(f.departmentId)}
                </p>
                <p>
                  has completed the required documentation, training, and
                  mentorship milestones.
                </p>
                <div className="certificate-meta">
                  <span>
                    {c.id}
                    <br />
                    Issued {date(c.at)}
                  </span>
                  <span>
                    {person(c.hodId)}
                    <br />
                    Demonstration endorsement
                  </span>
                </div>
                <small>Academic prototype — demonstration certificate</small>
              </div>
              <p className="hash-line">SHA-256 integrity digest: {c.hash}</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      const cert = await service().certificate(c.id);
                      download(cert.blob, cert.id + ".pdf");
                    },
                    "Certificate downloaded.",
                    false,
                  )
                }
              >
                <Download size={17} />
                Download certificate PDF
              </button>
              <p className="fine">
                The digest identifies the stored file. This prototype does not
                issue an institutional digital signature.
              </p>
            </section>
          );
        })}
      </>
    ) : (
      <Empty
        title={
          u.role === "NEW_FACULTY"
            ? "No certificate yet"
            : "No certificates issued yet"
        }
        children={
          u.role === "HOD"
            ? "Certificates for faculty in your department will appear here after you approve their induction dossiers."
            : u.role === "HR_COORDINATOR"
              ? "Faculty completion certificates will appear here after the respective department heads approve their induction dossiers."
              : "Your certificate will appear here after final HOD approval. Complete your requirements and submit your dossier to get started."
        }
      />
    );
  // FACULTY AND MENTORS: Edit HR's onboarding entry point, faculty list, and assignment history here.
  } else if (actualPage === "people")
    content = (
      <>
        {section(
          "Faculty & mentor allocation",
          "Initialize roadmaps and keep one active mentor per inductee.",
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Department</th>
                  <th>Assigned mentor</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans
                  .filter((p) =>
                    person(s.faculty.find((f) => f.id === p.facultyId)!.userId)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => {
                    const f = s.faculty.find((f) => f.id === p.facultyId)!,
                      a = s.assignments.find(
                        (a) => a.active && a.facultyId === f.id,
                      );
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{person(f.userId)}</strong>
                          <small>
                            {f.employeeCode}
                            {f.phone ? " · " + f.phone : ""}
                          </small>
                        </td>
                        <td>{f.departmentId.toUpperCase()}</td>
                        <td>{a ? person(a.mentorId) : "Unassigned"}</td>
                        <td>
                          <Badge value={p.status} />
                        </td>
                        <td>
                          <button
                            className="text-button"
                            disabled={[
                              "COMPLETED",
                              "ARCHIVED",
                              "PENDING_HOD_APPROVAL",
                            ].includes(p.status)}
                            onClick={() => open("assign", f.id)}
                          >
                            Assign mentor <ArrowRight size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>,
          <button className="button primary" onClick={() => open("onboard")}>
            <Plus size={17} />
            Onboard faculty
          </button>,
        )}
        {section(
          "Assignment history",
          "Reassignments retain the previous pairing and its reason.",
          <div className="history-list">
            {s.assignments.map((a) => (
              <div key={a.id}>
                <Users size={20} />
                <div>
                  <strong>
                    {person(
                      s.faculty.find((f) => f.id === a.facultyId)!.userId,
                    )}{" "}
                    → {person(a.mentorId)}
                  </strong>
                  <small>
                    {a.reason} · {time(a.at)}
                  </small>
                </div>
                <Badge value={a.active ? "COMPLETED" : "ARCHIVED"} />
              </div>
            ))}
          </div>,
        )}
      </>
    );
  // ADMIN SETTINGS: Edit the account and checklist template screens here.
  else if (actualPage === "settings")
    content = (
      <>
        {section(
          "User accounts",
          "Manage demo roles and account access. Changes invalidate existing sessions.",
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Access</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {s.users
                  .filter((x) =>
                    (x.name + " " + x.email)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.name}</strong>
                        <small>{x.email}</small>
                      </td>
                      <td>{roles[x.role]}</td>
                      <td>{x.departmentId.toUpperCase()}</td>
                      <td>
                        <Badge value={x.active ? "COMPLETED" : "ARCHIVED"} />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => open("account", x.id)}
                        >
                          Edit account
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>,
        )}
        {section(
          "Checklist templates",
          "New templates apply to future inductions; existing roadmaps remain stable.",
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Pillar</th>
                  <th>Type</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {s.templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{t.pillar}</td>
                    <td>{t.mandatory ? "Required" : "Optional"}</td>
                    <td>{t.days} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
          <button className="button" onClick={() => open("template")}>
            <Plus size={16} />
            Add template
          </button>,
        )}
      </>
    );
  // NOTIFICATIONS: Edit the list and read-state controls here. The server creates notification messages.
  else if (actualPage === "notifications")
    content = section(
      "Your updates",
      "In-app notifications and simulated local email delivery.",
      <div className="notification-list">
        {s.notifications
          .filter((n) => n.userId === u.id)
          .map((n) => (
            <button
              key={n.id}
              className={n.read ? "read" : ""}
              disabled={busy}
              onClick={() =>
                void run(
                  () => service().readNotification(n.id),
                  "Notification marked read.",
                  false,
                ).then((ok) => {
                  if (ok) navigate(n.page);
                })
              }
            >
              <span className="notification-icon">
                <Bell size={20} />
              </span>
              <span>
                <strong>{n.message}</strong>
                <small>
                  {time(n.at)} · Local email simulation{n.read ? " · Read" : ""}
                </small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
      </div>,
    );
  else {
    const planIds = new Set(plans.map((p) => p.id));
    const taskIds = new Set(
      s.tasks.filter((t) => planIds.has(t.planId)).map((t) => t.id),
    );
    const allowedEntities = new Set([
      ...planIds,
      ...taskIds,
      ...plans.map((p) => p.facultyId),
      ...s.dossiers.filter((d) => planIds.has(d.planId)).map((d) => d.id),
      ...s.documents.filter((d) => taskIds.has(d.taskId)).map((d) => d.id),
    ]);
    // AUDIT SEARCH: Filter event text and limit the list to records visible to the current role.
    const audits = s.audit.filter(
      (a) =>
        (["HR_COORDINATOR", "ADMIN"].includes(u.role) ||
          allowedEntities.has(a.entityId)) &&
        (a.action + " " + a.remarks + " " + person(a.actorId))
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    content = (
      <>
        {section(
          "Induction report",
          "Live figures calculated from mandatory task records.",
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Department</th>
                  <th>Documents</th>
                  <th>Mentorship</th>
                  <th>Training</th>
                  <th>Overall</th>
                  <th>Pending</th>
                  <th>Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const pr = progress(s, p.id),
                    f = s.faculty.find((f) => f.id === p.facultyId)!;
                  return (
                    <tr key={p.id}>
                      <td>{person(f.userId)}</td>
                      <td>{f.departmentId.toUpperCase()}</td>
                      {(
                        ["Documents", "Mentorship", "Training"] as Pillar[]
                      ).map((k) => (
                        <td key={k}>{Math.round(pr.pillars[k].percent)}%</td>
                      ))}
                      <td>
                        <strong>{Math.round(pr.percent)}%</strong>
                      </td>
                      <td>{compliance(p.id).pending}</td>
                      <td>{compliance(p.id).overdue}</td>
                      <td>
                        <Badge value={p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>,
          <button
            className="button"
            onClick={() => {
              const quote = (v: string) =>
                '"' +
                (/^[=+\-@]/.test(v) ? "'" : "") +
                v.replaceAll('"', '""') +
                '"';
              const rows = [
                [
                  "Faculty",
                  "Department",
                  "Documents",
                  "Mentorship",
                  "Training",
                  "Overall",
                  "Pending",
                  "Overdue",
                  "Status",
                ],
                ...plans.map((p) => {
                  const pr = progress(s, p.id),
                    f = s.faculty.find((f) => f.id === p.facultyId)!;
                  return [
                    person(f.userId),
                    f.departmentId,
                    ...(
                      ["Documents", "Mentorship", "Training"] as Pillar[]
                    ).map((k) => pr.pillars[k].percent.toFixed(1)),
                    pr.percent.toFixed(1),
                    String(compliance(p.id).pending),
                    String(compliance(p.id).overdue),
                    p.status,
                  ];
                }),
              ];
              download(
                new Blob(
                  [
                    "\uFEFF" +
                      rows.map((r) => r.map(quote).join(",")).join("\r\n"),
                  ],
                  { type: "text/csv;charset=utf-8" },
                ),
                "fims-induction-report.csv",
              );
            }}
          >
            <Download size={16} />
            Export CSV
          </button>,
        )}
        {section(
          "Audit trail",
          "Append-only application history within your authorized scope.",
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{time(a.at)}</td>
                    <td>{person(a.actorId)}</td>
                    <td>{label(a.action)}</td>
                    <td>{a.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audits.length && <Empty title="No matching audit events" />}
          </div>,
        )}
      </>
    );
  }
  // EDIT A POPUP: Search for modal.kind and the popup name, such as upload, review-doc, approve, or onboard.
  const modalTask = modal?.id ? s.tasks.find((t) => t.id === modal.id) : null;
  const text = (d: FormData, k: string) => String(d.get(k) || "");
  let modalContent: ReactNode = null;
  if (modal) {
    const cancel = (
      <button type="button" className="button" disabled={busy} onClick={close}>
        Cancel
      </button>
    );
    // UPLOAD POPUP: Change the instructions, file picker, hash preview, or submit-button behavior here.
    if (modal.kind === "upload")
      modalContent = (
        <>
          <p className="muted">
            {modalTask && template(modalTask).title}. PDF, JPG, or PNG, up to 5
            MB.
          </p>
          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void chooseFile(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={28} />
            <strong>Drop your document here</strong>
            <span>or choose a file from your computer</span>
            <input
              aria-label="Choose document"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => void chooseFile(e.target.files?.[0])}
            />
          </div>
          {file && (
            <div className="file-selected">
              <FileText size={22} />
              <div>
                <strong>{file.name}</strong>
                <small>{(file.size / 1024).toFixed(1)} KB</small>
              </div>
              {hash && <CheckCircle2 size={20} />}
            </div>
          )}
          {hash && <p className="hash-line">SHA-256: {hash}</p>}
          <div className="form-actions">
            {cancel}
            <button
              className="button primary"
              disabled={!hash || busy}
              onClick={() =>
                void run(
                  () => service().upload(modal.id!, file!),
                  "Document submitted to HR for verification.",
                )
              }
            >
              {busy ? "Uploading…" : "Submit document"}
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      );
    // VERIFY OR REJECT POPUP: Decision choices and remarks are here. The backend requires a reason for rejection.
    if (modal.kind === "review-doc") {
      const d = s.documents.find((d) => d.id === modal.id)!;
      modalContent = (
        <>
          <p className="muted">Inspect {d.name} before making your decision.</p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(
                async () => {
                  const doc = await service().document(d.id);
                  setPreview(URL.createObjectURL(doc.blob));
                },
                "Preview ready.",
                false,
              )
            }
          >
            Open document preview <ArrowUpRight size={15} />
          </button>
          {preview && (
            <iframe
              className="document-preview"
              src={preview}
              title="Uploaded document preview"
            />
          )}
          <Form
            busy={busy}
            text="Save review"
            secondary={cancel}
            onSubmit={(data) =>
              void run(
                () =>
                  service().reviewDocument(
                    d.id,
                    text(data, "decision") === "verify",
                    text(data, "remarks"),
                  ),
                "Document review saved.",
              )
            }
          >
            <Field name="decision" title="Decision">
              <select name="decision">
                <option value="verify">Verify document</option>
                <option value="reject">Reject and request re-upload</option>
              </select>
            </Field>
            <Field
              name="remarks"
              title="Review remarks (required for rejection)"
            >
              <textarea name="remarks" rows={3} />
            </Field>
          </Form>
        </>
      );
    }
    // DOCUMENT PREVIEW POPUP: Show the selected file and its download controls.
    if (modal.kind === "preview") {
      const d = s.documents.find((d) => d.id === modal.id)!;
      modalContent = (
        <>
          <iframe
            className="document-preview tall"
            src={preview || ""}
            title="Uploaded document"
          />
          <p className="hash-line">SHA-256: {d.hash}</p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void run(
                async () => {
                  const doc = await service().document(d.id);
                  download(doc.blob, doc.name);
                },
                "Document downloaded.",
                false,
              )
            }
          >
            <Download size={16} />
            Download original
          </button>
        </>
      );
    }
    // MENTOR POPUPS: Read evidence, enter a readiness rating, request revision, or save meeting notes.
    if (["activity", "mentor-review", "meeting"].includes(modal.kind)) {
      const i = s.interactions.find((i) => i.taskId === modal.id);
      modalContent = (
        <>
          <p className="muted">{modalTask && template(modalTask).title}</p>
          <div className="evidence-note">
            <strong>Faculty evidence & meeting notes</strong>
            <p>{i?.notes || "No notes recorded."}</p>
            {i?.remarks && (
              <>
                <strong>Mentor feedback</strong>
                <p>
                  {i.remarks}
                  {i.readiness ? ` · Teaching readiness: ${i.readiness}/5` : ""}
                </p>
              </>
            )}
          </div>
          {modal.kind === "mentor-review" && (
            <Form
              busy={busy}
              text="Save review"
              secondary={cancel}
              onSubmit={(data) =>
                void run(
                  () =>
                    service().reviewMentorship(
                      modal.id!,
                      text(data, "decision") === "approve",
                      text(data, "remarks"),
                      Number(text(data, "readiness") || 4),
                    ),
                  "Mentorship review saved.",
                )
              }
            >
              <Field name="decision" title="Decision">
                <select name="decision">
                  <option value="approve">Sign off activity</option>
                  <option value="revision">Request revision</option>
                </select>
              </Field>
              <Field name="remarks" title="Review remarks / revision guidance">
                <textarea name="remarks" rows={4} />
              </Field>
              <Field name="readiness" title="Teaching readiness rating">
                <select name="readiness" defaultValue="4">
                  <option value="1">1 — Needs significant support</option>
                  <option value="2">2 — Developing</option>
                  <option value="3">3 — Almost ready</option>
                  <option value="4">4 — Ready</option>
                  <option value="5">5 — Highly ready</option>
                </select>
              </Field>
            </Form>
          )}
          {modal.kind === "meeting" && (
            <Form
              busy={busy}
              text="Submit evidence"
              secondary={cancel}
              onSubmit={(data) =>
                void run(
                  () => service().meeting(modal.id!, text(data, "notes")),
                  "Evidence submitted to your mentor.",
                )
              }
            >
              <Field name="notes" title="Meeting notes and activity evidence">
                <textarea name="notes" rows={5} defaultValue={i?.notes} />
              </Field>
            </Form>
          )}
        </>
      );
    }
    // RETURN OR WAIVER POPUP: Both actions require text explaining the decision.
    if (["return", "waiver"].includes(modal.kind))
      modalContent = (
        <Form
          busy={busy}
          text={modal.kind === "return" ? "Return dossier" : "Grant waiver"}
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                modal.kind === "return"
                  ? service().returnDossier(modal.id!, text(data, "remarks"))
                  : service().waiver(modal.id!, text(data, "remarks")),
              "Decision recorded.",
            )
          }
        >
          <Field
            name="remarks"
            title={
              modal.kind === "return"
                ? "Directives for revision"
                : "Training waiver justification"
            }
          >
            <textarea name="remarks" rows={5} />
          </Field>
        </Form>
      );
    // FINAL APPROVAL POPUP: Edit the confirmation wording and optional HOD remarks here.
    if (modal.kind === "approve")
      modalContent = (
        <>
          <div className="approval-warning">
            <ShieldCheck size={28} />
            <p>
              Confirm final induction sign-off for {facultyUser?.name}? This
              action is permanent and will generate the completion certificate.
            </p>
          </div>
          <Form
            busy={busy}
            text="Confirm final approval"
            secondary={cancel}
            onSubmit={(data) =>
              void run(
                () => service().approve(modal.id!, text(data, "remarks")),
                "Induction approved — certificate generated.",
              )
            }
          >
            <Field name="remarks" title="HOD remarks">
              <textarea
                name="remarks"
                rows={3}
                placeholder="Final review comments (optional)"
              />
            </Field>
            <p className="fine">
              The demonstration PDF will be generated and saved with the
              approval.
            </p>
          </Form>
        </>
      );
    // MENTOR REASSIGNMENT POPUP: Edit available mentor choices and the reason field.
    if (modal.kind === "assign") {
      const f = s.faculty.find((f) => f.id === modal.id)!;
      modalContent = (
        <Form
          busy={busy}
          text="Save assignment"
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                service().assign(
                  f.id,
                  text(data, "mentor"),
                  text(data, "reason"),
                ),
              "Mentor assignment updated.",
            )
          }
        >
          <p className="muted">
            {person(f.userId)} · {f.departmentId.toUpperCase()}
          </p>
          <Field name="mentor" title="Same-department mentor">
            <select name="mentor">
              {s.users
                .filter(
                  (u) =>
                    u.active &&
                    u.role === "FACULTY_MENTOR" &&
                    u.departmentId === f.departmentId,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="reason" title="Assignment / reassignment reason">
            <textarea name="reason" rows={3} />
          </Field>
        </Form>
      );
    }
    // ONBOARD FACULTY FORM: Add or change fields here. For a new saved value, follow the onSubmit call into backend/services.ts and shared/domain.ts.
    if (modal.kind === "onboard")
      modalContent = (
        <Form
          busy={busy}
          text="Create induction roadmap"
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                service().onboard(
                  text(data, "name"),
                  text(data, "email"),
                  text(data, "department"),
                  text(data, "mentor"),
                  text(data, "phone"),
                ),
              "Faculty induction initialized.",
            )
          }
        >
          <Field name="name" title="Faculty full name" required />
          <Field name="phone" title="Contact phone (optional)" type="tel" />
          <Field
            name="email"
            title="Institutional email"
            type="email"
            required
          />
          <Field name="department" title="Department">
            <select name="department">
              {s.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="mentor" title="Mentor (must match department)">
            <select name="mentor">
              {s.users
                .filter((u) => u.active && u.role === "FACULTY_MENTOR")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.departmentId.toUpperCase()}
                  </option>
                ))}
            </select>
          </Field>
        </Form>
      );
    // CREATE SESSION FORM: Edit the title, date, venue, and required/optional controls here.
    if (modal.kind === "session")
      modalContent = (
        <Form
          busy={busy}
          text="Schedule session"
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                service().createSession(
                  text(data, "title"),
                  text(data, "date"),
                  text(data, "venue"),
                  data.get("mandatory") === "on",
                ),
              "Session scheduled for active inductions.",
            )
          }
        >
          <Field name="title" title="Session title" required />
          <Field
            name="date"
            title="Session date & time (your device timezone)"
            type="datetime-local"
            required
          />
          <Field name="venue" title="Venue" required />
          <label className="checkbox">
            <input type="checkbox" name="mandatory" defaultChecked />
            Required for induction completion
          </label>
        </Form>
      );
    // MANAGE ACCOUNT FORM: Change the role selector or active-account control here.
    if (modal.kind === "account") {
      const target = s.users.find((u) => u.id === modal.id)!;
      modalContent = (
        <Form
          busy={busy}
          text="Update account"
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                service().updateUser(
                  target.id,
                  text(data, "role") as Role,
                  data.get("active") === "on",
                ),
              "Account updated. Existing sessions invalidated.",
            )
          }
        >
          <p>
            {target.name}
            <small>{target.email}</small>
          </p>
          <Field name="role" title="Account role">
            <select name="role" defaultValue={target.role}>
              {Object.entries(roles).map(([r, name]) => (
                <option value={r} key={r}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              name="active"
              defaultChecked={target.active}
            />
            Account active
          </label>
          <p className="fine">
            Active mentors must have their mentees reassigned first. Existing
            department heads retain their designated role.
          </p>
        </Form>
      );
    }
    // ADD CHECKLIST ITEM FORM: Edit the requirement title, target department, pillar, and mandatory flag here.
    if (modal.kind === "template")
      modalContent = (
        <Form
          busy={busy}
          text="Add checklist template"
          secondary={cancel}
          onSubmit={(data) =>
            void run(
              () =>
                service().template(
                  text(data, "title"),
                  text(data, "pillar") as Pillar,
                  data.get("mandatory") === "on",
                  text(data, "department"),
                ),
              "Template created for future inductions.",
            )
          }
        >
          <Field name="title" title="Requirement title" required />
          <Field name="department" title="Applies to department">
            <select name="department">
              <option value="">All departments</option>
              {s.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="pillar" title="Induction pillar">
            <select name="pillar">
              <option>Documents</option>
              <option>Mentorship</option>
              <option>Training</option>
            </select>
          </Field>
          <label className="checkbox">
            <input type="checkbox" name="mandatory" defaultChecked />
            Mandatory requirement
          </label>
        </Form>
      );
    // DEMO RESET CONFIRMATION: The server restores the seed records and clears demo sessions.
    if (modal.kind === "reset")
      modalContent = (
        <>
          <p>
            Reset all demo accounts, documents, decisions, and certificates to
            the initial fictional cohort? Uploaded files and changes in this
            prototype will be removed.
          </p>
          <div className="form-actions">
            {cancel}
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await reset();
                  setUser(null);
                }, "Demo restored.")
              }
            >
              Reset demo data
            </button>
          </div>
        </>
      );
  }
  // POPUP TITLES: The dialog name displayed above each popup is defined here.
  const dialogTitles: Record<string, string> = {
    upload: "Upload a document",
    "review-doc": "Review document",
    preview: "Document preview",
    activity: "Activity evidence",
    "mentor-review": "Review & sign off",
    meeting: "Record meeting & evidence",
    return: "Return with directives",
    waiver: "Grant training waiver",
    approve: "Confirm induction approval",
    assign: "Assign faculty mentor",
    onboard: "Onboard new faculty",
    session: "Schedule orientation",
    account: "Edit demo account",
    template: "Add checklist template",
    reset: "Reset demo data",
  };
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to main content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <img src="/lnmiit-logo.jpeg" alt="LNMIIT crest" />
          <div>
            <strong>
              FIMS<span>.</span>
            </strong>
            <small>Faculty Induction</small>
          </div>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">Navigation</div>
        <nav aria-label="Main navigation">
          {menus[u.role].map((p) => {
            const Icon = icons[p];
            return (
              <button
                className={actualPage === p ? "active" : ""}
                key={p}
                onClick={() => navigate(p)}
                aria-current={actualPage === p ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{pageLabel(p)}</span>
                {p === "notifications" && unread > 0 && <em>{unread}</em>}
                {actualPage === p && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Local prototype</strong>
              <small>Saved on the FIMS server</small>
            </div>
          </div>
          <button
            className="reset-button"
            onClick={() => open("reset")}
            disabled={busy}
          >
            <RotateCcw size={15} />
            Reset demo data
          </button>
          <div className="sidebar-institute">
            The LNM Institute of Information
            <br />
            Technology, Jaipur
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>Faculty induction</span>
            <ChevronRight size={14} />
            <strong>{pageLabel(actualPage)}</strong>
          </div>
          <div className="header-actions">
            <span className="account-identity">{u.name} · {roles[u.role]}</span>
            <button
              className="icon-button bell"
              aria-label={"Notifications, " + unread + " unread"}
              onClick={() => navigate("notifications")}
            >
              <Bell size={20} />
              {unread > 0 && <span />}
            </button>
            <button
              className="avatar"
              title={u.name + " · Sign out"}
              aria-label="Sign out"
              disabled={busy}
              onClick={logout}
            >
              {initials(u.name)}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-context">
            <span>{roles[u.role]}</span>
            <span>
              <span className="live-dot" />
              Saved on the FIMS server
            </span>
          </div>
          {actualPage !== "overview" && (
            <div className="page-title">
              <div>
                <h1>{pageTitle}</h1>
                <p>
                  {actualPage === "approvals"
                    ? u.role === "NEW_FACULTY"
                      ? "Prepare your own record, submit it for approval, and respond to HOD feedback."
                      : u.role === "HR_COORDINATOR"
                        ? "Review faculty clearances and coordinate submissions across departments."
                        : "Review submitted records and make the final departmental decision."
                    : facultyUser &&
                        ["documents", "mentorship", "training"].includes(
                          actualPage,
                        )
                      ? facultyUser.name + " · " + dept(faculty!.departmentId)
                      : "Faculty Induction Management System"}
                </p>
              </div>
              {[
                "documents",
                "mentorship",
                "verification",
                "people",
                "reports",
                "settings",
              ].includes(actualPage) && (
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search current view"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search this view…"
                  />
                </label>
              )}
            </div>
          )}
          {error && !modal && (
            <div className="alert error" role="alert">
              <TriangleAlert size={18} />
              {error}
            </div>
          )}
          {content}
          <footer className="page-footer">
            <span>Faculty Induction Management System · LNMIIT, Jaipur</span>
            <span>LNMIIT / CS314 / T077</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={dialogTitles[modal.kind] || "Details"}
          onClose={close}
          busy={busy}
        >
          {error && (
            <div className="alert error" role="alert">
              <TriangleAlert size={18} />
              {error}
            </div>
          )}
          {modalContent}
        </Modal>
      )}
    </div>
  );
}
