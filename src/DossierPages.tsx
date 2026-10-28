import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Send } from "lucide-react";
import {
  type State,
  type InductionPlan,
  type Pillar,
  progress,
  date,
  time,
  label,
} from "./domain";

interface CommonProps {
  state: State;
  busy: boolean;
  badge: (value: string) => ReactNode;
  navigate: (page: string) => void;
  submit: (planId: string) => void;
}
const pillars: Pillar[] = ["Documents", "Mentorship", "Training"];
const satisfied = (t: State["tasks"][number]) =>
  !!t.waiver || ["VERIFIED", "COMPLETED"].includes(t.status);
const taskPage = (pillar: Pillar) =>
  pillar === "Documents"
    ? "documents"
    : pillar === "Mentorship"
      ? "mentorship"
      : "training";
function History({
  state,
  plan,
  title,
}: {
  state: State;
  plan: InductionPlan;
  title: string;
}) {
  const dossier = state.dossiers.find((d) => d.planId === plan.id);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>Submission and HOD decisions are recorded here.</p>
        </div>
      </div>
      {dossier?.history.length ? (
        <div className="timeline">
          {dossier.history.map((h, i) => (
            <div key={i}>
              <span className="timeline-dot" />
              <div>
                <strong>{label(h.action)}</strong>
                <p>{h.remarks}</p>
                <small>
                  {state.users.find((u) => u.id === h.by)?.name ||
                    "Former account"}{" "}
                  · {time(h.at)}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="dossier-placeholder">No submission has been made yet.</p>
      )}
    </section>
  );
}

export function FacultySubmission({
  state: s,
  plan,
  busy,
  badge,
  navigate,
  submit,
}: CommonProps & { plan: InductionPlan }) {
  const stats = progress(s, plan.id),
    dossier = s.dossiers.find((d) => d.planId === plan.id);
  const pending = plan.status === "PENDING_HOD_APPROVAL",
    completed = ["COMPLETED", "ARCHIVED"].includes(plan.status);
  const tasks = s.tasks.filter((t) => t.planId === plan.id),
    remaining = tasks.filter(
      (t) =>
        s.templates.find((x) => x.id === t.templateId)?.mandatory &&
        !satisfied(t),
    );
  const faculty = s.faculty.find((f) => f.id === plan.facultyId)!;
  const hod = s.users.find(
    (u) =>
      u.id ===
      s.departments.find((d) => d.id === faculty.departmentId)?.hodUserId,
  );
  return (
    <div className="faculty-submission">
      <section className="submission-status">
        <div>
          <h2>
            {completed
              ? "Your induction is approved"
              : pending
                ? "Your submission is with the HOD"
                : plan.status === "REVISION_REQUIRED"
                  ? "Your submission needs attention"
                  : stats.eligible
                    ? "Your record is ready to submit"
                    : "Complete your checklist before submitting"}
          </h2>
          <p>
            {completed
              ? "You can now download your completion certificate."
              : pending
                ? `${hod?.name || "Your department head"} will review your documents, training and mentor sign-offs. You will be notified of the decision.`
                : "This is your application for final induction approval. HR verification and mentor sign-off must be complete before you send it."}
          </p>
        </div>
        {badge(plan.status)}
      </section>
      <ol className="submission-stages" aria-label="Submission progress">
        <li className={stats.eligible ? "done" : "current"}>
          <span>{stats.eligible ? <Check size={14} /> : "1"}</span>
          <div>
            <strong>Complete requirements</strong>
            <small>
              {stats.done} of {stats.total} required items complete
            </small>
          </div>
        </li>
        <li className={pending || completed ? "done" : ""}>
          <span>{pending || completed ? <Check size={14} /> : "2"}</span>
          <div>
            <strong>Submit for HOD review</strong>
            <small>
              {dossier
                ? `Last submitted ${date(dossier.at)}`
                : "Not yet submitted"}
            </small>
          </div>
        </li>
        <li className={completed ? "done" : pending ? "current" : ""}>
          <span>{completed ? <Check size={14} /> : "3"}</span>
          <div>
            <strong>Receive final decision</strong>
            <small>
              {completed
                ? "Approved"
                : plan.status === "REVISION_REQUIRED"
                  ? "Returned with comments"
                  : "Awaiting approval"}
            </small>
          </div>
        </li>
      </ol>
      {dossier?.decision === "RETURNED_WITH_COMMENTS" && (
        <section
          className="dossier-feedback"
          aria-label="HOD revision feedback"
        >
          <h2>What your HOD asked you to change</h2>
          <p>{dossier.remarks}</p>
          <small>
            Review the comments, correct the relevant evidence, and resubmit
            when ready.
          </small>
        </section>
      )}
      {!pending && !completed && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>
                {remaining.length
                  ? "What is holding up your submission"
                  : "Send your completed record"}
              </h2>
              <p>
                {remaining.length
                  ? "Follow up on the items below. Uploaded documents must be verified by HR."
                  : "Your checklist is complete. Send it to your department head for the final decision."}
              </p>
            </div>
          </div>
          {remaining.length ? (
            <div className="submission-blockers">
              {remaining.map((t) => {
                const template = s.templates.find(
                  (x) => x.id === t.templateId,
                )!;
                return (
                  <div key={t.id}>
                    <div>
                      <strong>{template.title}</strong>
                      <p>
                        {t.remarks ||
                          (t.status === "UPLOADED"
                            ? "Waiting for HR verification"
                            : template.pillar === "Mentorship"
                              ? "Your assigned mentor must sign off this activity"
                              : template.pillar === "Training"
                                ? "HR must record completion or attendance"
                                : "Upload the required document")}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate(taskPage(template.pillar))}
                    >
                      Open {template.pillar.toLowerCase()}{" "}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="submission-send">
              <p>
                Submitting locks your evidence while the HOD reviews it. If
                changes are needed, the HOD can return it with instructions.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => submit(plan.id)}
              >
                <Send size={16} />
                {plan.status === "REVISION_REQUIRED"
                  ? "Resubmit my dossier"
                  : "Submit my dossier"}
              </button>
            </div>
          )}
        </section>
      )}
      {completed && (
        <div className="submission-send">
          <button
            className="button primary"
            onClick={() => navigate("certificate")}
          >
            View my certificate <ArrowRight size={16} />
          </button>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Your submission checklist</h2>
            <p>Only mandatory items affect whether you can submit.</p>
          </div>
        </div>
        <div className="submission-checklist">
          {pillars.map((pillar) => (
            <div key={pillar}>
              <div>
                <strong>{pillar}</strong>
                <small>
                  {stats.pillars[pillar].done} of {stats.pillars[pillar].total}{" "}
                  required items complete
                </small>
              </div>
              <button
                className="text-button"
                onClick={() => navigate(taskPage(pillar))}
              >
                View {pillar.toLowerCase()} <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <History state={s} plan={plan} title="My submission history" />
    </div>
  );
}

export function HRInductionRecords({
  state: s,
  plans,
  selectedId,
  onSelect,
  busy,
  badge,
  navigate,
  submit,
  inspect,
  viewEvidence,
}: CommonProps & {
  plans: InductionPlan[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  inspect: (id: string) => void;
  viewEvidence: (taskId: string) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const selected = plans.find((p) => p.id === selectedId);
  const facultyFor = (p: InductionPlan) =>
    s.faculty.find((f) => f.id === p.facultyId)!;
  const userFor = (p: InductionPlan) =>
    s.users.find((u) => u.id === facultyFor(p).userId)!;
  const isReady = (p: InductionPlan) =>
    progress(s, p.id).eligible &&
    ["IN_PROGRESS", "DRAFT", "REVISION_REQUIRED"].includes(p.status);
  const queue = plans.filter((p) => {
    const name = userFor(p).name + " " + facultyFor(p).employeeCode;
    return (
      name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "ready" && isReady(p)) ||
        (filter === "pending" && p.status === "PENDING_HOD_APPROVAL") ||
        (filter === "returned" && p.status === "REVISION_REQUIRED") ||
        (filter === "completed" &&
          ["COMPLETED", "ARCHIVED"].includes(p.status)) ||
        (filter === "incomplete" &&
          !progress(s, p.id).eligible &&
          !["COMPLETED", "ARCHIVED"].includes(p.status)))
    );
  });
  if (!selected)
    return (
      <div className="hr-induction-records">
        <p className="role-purpose">
          Check faculty readiness, resolve administrative gaps, and forward
          completed records to the HOD. Final approval remains with the
          department head.
        </p>
        <div className="dossier-queue-tools">
          <label>
            Find faculty
            <input
              aria-label="Find faculty induction record"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or employee code"
            />
          </label>
          <label>
            Record status
            <select
              aria-label="Filter induction records"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All records ({plans.length})</option>
              <option value="incomplete">Requirements outstanding</option>
              <option value="ready">
                Ready to send ({plans.filter(isReady).length})
              </option>
              <option value="pending">With HOD</option>
              <option value="returned">Returned for revision</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Faculty readiness worklist</h2>
              <p>
                Check each record before submitting on the faculty member’s
                behalf.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Department</th>
                  <th>Documents verified</th>
                  <th>Mentorship</th>
                  <th>Training</th>
                  <th>Next action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((p) => {
                  const stats = progress(s, p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{userFor(p).name}</strong>
                        <small>{facultyFor(p).employeeCode}</small>
                      </td>
                      <td>{facultyFor(p).departmentId.toUpperCase()}</td>
                      {pillars.map((k) => (
                        <td key={k}>
                          {stats.pillars[k].done} / {stats.pillars[k].total}
                        </td>
                      ))}
                      <td>
                        {p.status === "PENDING_HOD_APPROVAL"
                          ? "Await HOD decision"
                          : p.status === "REVISION_REQUIRED"
                            ? "Follow up on HOD comments"
                            : ["COMPLETED", "ARCHIVED"].includes(p.status)
                              ? "Completed"
                              : isReady(p)
                                ? "Ready to send to HOD"
                                : stats.pillars.Documents.done <
                                    stats.pillars.Documents.total
                                  ? "Check document clearance"
                                  : stats.pillars.Mentorship.done <
                                      stats.pillars.Mentorship.total
                                    ? "Follow up with mentor"
                                    : "Update training records"}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => onSelect(p.id)}
                        >
                          Check record <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!queue.length && (
              <p className="dossier-placeholder">
                No faculty records match this filter.
              </p>
            )}
          </div>
        </section>
      </div>
    );
  const f = facultyFor(selected),
    stats = progress(s, selected.id),
    tasks = s.tasks.filter((t) => t.planId === selected.id),
    dossier = s.dossiers.find((d) => d.planId === selected.id),
    editable = ["DRAFT", "IN_PROGRESS", "REVISION_REQUIRED"].includes(
      selected.status,
    );
  const assignment = s.assignments.find(
    (a) => a.active && a.facultyId === f.id,
  );
  return (
    <div className="hr-record-detail">
      <button className="text-button" onClick={() => onSelect(null)}>
        <ArrowLeft size={15} />
        Back to faculty worklist
      </button>
      <section className="hr-record-header">
        <div>
          <h2>{userFor(selected).name}</h2>
          <p>
            {f.employeeCode} · {f.departmentId.toUpperCase()} · Target:{" "}
            {date(selected.deadline)}
          </p>
        </div>
        {badge(selected.status)}
      </section>
      {dossier?.decision === "RETURNED_WITH_COMMENTS" && (
        <section className="dossier-feedback">
          <h2>HOD follow-up required</h2>
          <p>{dossier.remarks}</p>
          <small>
            Coordinate with the faculty member and the relevant reviewer before
            forwarding the record again.
          </small>
        </section>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Document clearance</h2>
            <p>Inspect uploaded files and resolve pending HR verification.</p>
          </div>
          <button className="button" onClick={() => navigate("verification")}>
            Open verification queue
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document requirement</th>
                <th>Clearance</th>
                <th>Reviewer remarks</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {tasks
                .filter(
                  (t) =>
                    s.templates.find((x) => x.id === t.templateId)?.pillar ===
                    "Documents",
                )
                .map((t) => {
                  const template = s.templates.find(
                      (x) => x.id === t.templateId,
                    )!,
                    doc = s.documents
                      .filter(
                        (d) => d.taskId === t.id && d.status !== "ARCHIVED",
                      )
                      .at(-1);
                  return (
                    <tr key={t.id}>
                      <td>
                        {template.title}
                        <small>
                          {template.mandatory ? "Required" : "Optional"}
                        </small>
                      </td>
                      <td>{badge(t.status)}</td>
                      <td>{t.remarks || "—"}</td>
                      <td>
                        {doc ? (
                          <button
                            className="text-button"
                            onClick={() => inspect(doc.id)}
                          >
                            Inspect file <FileText size={14} />
                          </button>
                        ) : (
                          <span className="muted">
                            {t.status === "VERIFIED"
                              ? "Seeded verification"
                              : "Not uploaded"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="hr-clearance-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Mentor clearance</h2>
              <p>
                {assignment
                  ? s.users.find((u) => u.id === assignment.mentorId)?.name
                  : "No active mentor assigned"}
              </p>
            </div>
          </div>
          <div className="clearance-body">
            <p>
              {stats.pillars.Mentorship.done} / {stats.pillars.Mentorship.total}{" "}
              required activities signed off.
            </p>
            {tasks
              .filter(
                (t) =>
                  s.templates.find((x) => x.id === t.templateId)?.pillar ===
                  "Mentorship",
              )
              .map((t) => (
                <button
                  className="text-button"
                  key={t.id}
                  onClick={() => viewEvidence(t.id)}
                >
                  {s.templates.find((x) => x.id === t.templateId)!.title}
                  <ArrowRight size={14} />
                </button>
              ))}
            <small>
              Mentor decisions are read-only here. Only the assigned mentor can
              sign off.
            </small>
            <button className="text-button" onClick={() => navigate("people")}>
              Manage mentor allocation <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Training & attendance clearance</h2>
              <p>Confirm required sessions and approved waivers.</p>
            </div>
          </div>
          <div className="clearance-body">
            <p>
              {stats.pillars.Training.done} / {stats.pillars.Training.total}{" "}
              required training items complete.
            </p>
            <button className="button" onClick={() => navigate("training")}>
              Manage this faculty member’s attendance
            </button>
          </div>
        </section>
      </div>
      <section className="hr-forward">
        <div>
          <h2>
            {selected.status === "PENDING_HOD_APPROVAL"
              ? "Record forwarded to HOD"
              : selected.status === "COMPLETED" ||
                  selected.status === "ARCHIVED"
                ? "Induction completed"
                : "Forward for departmental approval"}
          </h2>
          <p>
            {selected.status === "PENDING_HOD_APPROVAL"
              ? "Evidence is locked while the department head reviews this record."
              : !editable
                ? "The department head has completed the final decision."
                : stats.eligible
                  ? "All mandatory clearances are complete. You can submit this record on the faculty member’s behalf."
                  : "Resolve outstanding document, mentorship and training requirements before forwarding this record."}
          </p>
        </div>
        {editable && (
          <button
            className="button primary"
            disabled={busy || !stats.eligible}
            onClick={() => submit(selected.id)}
          >
            <Send size={16} />
            Send to HOD on behalf of faculty
          </button>
        )}
      </section>
      <History
        state={s}
        plan={selected}
        title="Administrative submission & decision log"
      />
    </div>
  );
}
