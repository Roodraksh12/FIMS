import {
  type State,
  type Role,
  type TaskProgress,
  type InductionPlan,
  type UserAccount,
  now,
  uid,
  progress,
} from "./domain";
import { commit, load } from "./repository";
import {
  principal,
  allow,
  scope,
  getSession,
  visiblePlans,
  type Session,
} from "./gateway";
import { sha256, createCertificate } from "./certificate";
const INVALID_FILE =
  "Invalid format or file exceeds 5MB limit. Please upload PDF, JPG, or PNG.";
const required = (
  s: string,
  message = "Please enter the required remarks.",
) => {
  if (!s.trim()) throw new Error(message);
  return s.trim();
};
function planFor(s: State, taskId: string) {
  const t = s.tasks.find((t) => t.id === taskId);
  if (!t) throw new Error("Checklist item not found.");
  return { t, p: s.plans.find((p) => p.id === t.planId)! };
}
function editable(p: InductionPlan) {
  if (["COMPLETED", "ARCHIVED", "PENDING_HOD_APPROVAL"].includes(p.status))
    throw new Error(
      "This induction is locked. Return the pending dossier for revision before changing evidence.",
    );
}
export function audit(
  s: State,
  u: UserAccount,
  action: string,
  id: string,
  remarks = "",
) {
  s.audit.unshift({
    id: uid(),
    actorId: u.id,
    action,
    entityId: id,
    remarks,
    at: now(),
  });
}
function notify(s: State, userId: string, message: string, page = "overview") {
  s.notifications.unshift({
    id: uid(),
    userId,
    message,
    page,
    at: now(),
    read: false,
    emailStatus: "SIMULATED_LOCAL",
  });
}
function notifyRole(s: State, role: Role, message: string, page: string) {
  s.users
    .filter((u) => u.active && u.role === role)
    .forEach((u) => notify(s, u.id, message, page));
}
function owner(s: State, p: InductionPlan) {
  return s.faculty.find((f) => f.id === p.facultyId)!.userId;
}
export function reminderCandidates(s: State, u: UserAccount) {
  const plans = new Set(
    visiblePlans(s, u)
      .filter((p) => !["COMPLETED", "ARCHIVED"].includes(p.status))
      .map((p) => p.id),
  );
  return s.tasks.filter(
    (t) =>
      plans.has(t.planId) &&
      !t.waiver &&
      !["COMPLETED", "VERIFIED"].includes(t.status) &&
      new Date(t.due).getTime() - Date.now() < 3 * 86400000 &&
      !s.notifications.some(
        (n) =>
          n.id ===
          "reminder-" + t.id + "-" + new Date().toISOString().slice(0, 10),
      ),
  );
}
export async function validateFile(file: File) {
  if (!file.size)
    throw new Error(
      "The selected file is empty. Please choose a valid document.",
    );
  if (file.size > 5242880) throw new Error(INVALID_FILE);
  const bytes = await file.arrayBuffer();
  const a = new Uint8Array(bytes);
  let mime = "";
  if (
    a[0] === 0x25 &&
    a[1] === 0x50 &&
    a[2] === 0x44 &&
    a[3] === 0x46 &&
    a[4] === 0x2d
  )
    mime = "application/pdf";
  if (a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff) mime = "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => a[i] === n))
    mime = "image/png";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (
    !mime ||
    !{
      "application/pdf": ["pdf"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
    }[mime]?.includes(ext || "") ||
    (file.type &&
      file.type !== mime &&
      file.type !== "application/octet-stream")
  )
    throw new Error(INVALID_FILE);
  return { mime, hash: await sha256(bytes) };
}
export class Services {
  private session: Session;
  constructor(private version: number) {
    const session = getSession();
    if (!session) throw new Error("Please log in again.");
    this.session = { ...session };
  }
  private write(fn: (s: State, u: UserAccount) => void) {
    return commit(this.version, (s) => {
      const u = principal(s, this.session);
      fn(s, u);
    });
  }
  private async read() {
    const s = await load();
    if (s.version !== this.version)
      throw new Error("This record changed. Refresh and try again.");
    return { s, u: principal(s, this.session) };
  }
  reminders() {
    return this.write((s, u) => {
      for (const t of reminderCandidates(s, u)) {
        const p = s.plans.find((p) => p.id === t.planId)!,
          title = s.templates.find((x) => x.id === t.templateId)!.title,
          message =
            (new Date(t.due).getTime() < Date.now()
              ? "Overdue: "
              : "Due soon: ") + title;
        const id =
          "reminder-" + t.id + "-" + new Date().toISOString().slice(0, 10);
        s.notifications.push({
          id,
          userId: owner(s, p),
          message,
          page: "overview",
          at: now(),
          read: false,
          emailStatus: "SIMULATED_LOCAL",
        });
        notifyRole(
          s,
          "HR_COORDINATOR",
          message + " · " + s.users.find((u) => u.id === owner(s, p))!.name,
          "people",
        );
      }
    });
  }
  completeTraining(taskId: string, completed: boolean) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      const { t, p } = planFor(s, taskId);
      editable(p);
      if (
        s.templates.find((x) => x.id === t.templateId)?.pillar !== "Training" ||
        s.sessions.some((x) => x.templateId === t.templateId)
      )
        throw new Error("Record session attendance for this requirement.");
      if (t.waiver)
        throw new Error("This task already has an approved waiver.");
      t.status = completed ? "COMPLETED" : "PENDING";
      audit(
        s,
        u,
        "TRAINING_COMPLETION_RECORDED",
        t.id,
        completed ? "Completed" : "Pending",
      );
      notify(s, owner(s, p), "Training status updated.", "training");
    });
  }
  async upload(taskId: string, file: File) {
    const { s, u } = await this.read();
    allow(u, "NEW_FACULTY");
    const { p } = planFor(s, taskId);
    scope(s, u, p);
    editable(p);
    const { mime, hash } = await validateFile(file);
    return this.write((s, u) => {
      allow(u, "NEW_FACULTY");
      const { t, p } = planFor(s, taskId);
      scope(s, u, p);
      editable(p);
      if (
        s.templates.find((x) => x.id === t.templateId)?.pillar !== "Documents"
      )
        throw new Error("This item does not accept documents.");
      if (!["PENDING", "REVISION_REQUIRED"].includes(t.status))
        throw new Error(
          "A document is already awaiting verification or has been verified.",
        );
      s.documents
        .filter((d) => d.taskId === taskId && d.status === "REJECTED")
        .forEach((d) => (d.status = "ARCHIVED"));
      s.documents.push({
        id: uid(),
        taskId,
        name: file.name,
        mime,
        size: file.size,
        hash,
        blob: file,
        at: now(),
        status: "UPLOADED_PENDING_VERIFICATION",
        remarks: "",
      });
      t.status = "UPLOADED";
      t.remarks = "";
      audit(s, u, "DOCUMENT_UPLOADED", taskId, file.name);
      notifyRole(
        s,
        "HR_COORDINATOR",
        u.name + " submitted " + file.name + " for verification.",
        "verification",
      );
    });
  }
  reviewDocument(docId: string, approve: boolean, remarks: string) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      const d = s.documents.find((d) => d.id === docId);
      if (!d) throw new Error("Document not found.");
      const { t, p } = planFor(s, d.taskId);
      editable(p);
      if (d.status !== "UPLOADED_PENDING_VERIFICATION")
        throw new Error("This document has already been reviewed.");
      if (!approve) required(remarks, "A rejection reason is required.");
      d.status = approve ? "VERIFIED" : "REJECTED";
      d.remarks = remarks.trim();
      t.status = approve ? "VERIFIED" : "REVISION_REQUIRED";
      t.remarks = d.remarks;
      audit(
        s,
        u,
        approve ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
        d.id,
        remarks,
      );
      notify(
        s,
        owner(s, p),
        approve
          ? d.name + " has been verified."
          : d.name + " needs revision: " + remarks,
        "documents",
      );
    });
  }
  reviewMentorship(
    taskId: string,
    approve: boolean,
    remarks: string,
    readiness = 4,
  ) {
    return this.write((s, u) => {
      allow(u, "FACULTY_MENTOR");
      const { t, p } = planFor(s, taskId);
      scope(s, u, p);
      editable(p);
      const interaction = s.interactions.find((i) => i.taskId === taskId);
      const assignment = s.assignments.find(
        (a) => a.facultyId === p.facultyId && a.active && a.mentorId === u.id,
      );
      if (!assignment)
        throw new Error(
          "You are not the assigned mentor for this faculty member.",
        );
      if (!interaction || interaction.status !== "PENDING_REVIEW")
        throw new Error("This activity is not awaiting review.");
      required(
        remarks,
        approve
          ? "Advisory feedback comments are required prior to final sign-off."
          : "Revision guidance is required.",
      );
      if (
        approve &&
        (!Number.isInteger(readiness) || readiness < 1 || readiness > 5)
      )
        throw new Error("Readiness must be between 1 and 5.");
      interaction.readiness = approve ? readiness : undefined;
      interaction.status = approve ? "APPROVED" : "REVISION_REQUIRED";
      interaction.remarks = remarks.trim();
      interaction.assignmentId = assignment.id;
      interaction.at = now();
      t.status = approve ? "COMPLETED" : "REVISION_REQUIRED";
      t.remarks = remarks.trim();
      audit(
        s,
        u,
        approve ? "MENTOR_SIGNOFF" : "MENTOR_REVISION_REQUEST",
        taskId,
        remarks,
      );
      notify(
        s,
        owner(s, p),
        approve
          ? "Activity signed off — status: Completed."
          : "Revision requested: " + remarks,
        "mentorship",
      );
    });
  }
  meeting(taskId: string, notes: string) {
    return this.write((s, u) => {
      allow(u, "NEW_FACULTY", "FACULTY_MENTOR");
      const { t, p } = planFor(s, taskId);
      scope(s, u, p);
      editable(p);
      required(notes, "Meeting notes or evidence are required.");
      if (
        s.templates.find((x) => x.id === t.templateId)?.pillar !== "Mentorship"
      )
        throw new Error("Not a mentorship activity.");
      if (t.status === "COMPLETED")
        throw new Error("This activity has already been signed off.");
      const i = s.interactions.find((i) => i.taskId === taskId);
      if (i) {
        i.notes = notes;
        i.status = "PENDING_REVIEW";
        i.at = now();
      } else {
        const a = s.assignments.find(
          (a) => a.active && a.facultyId === p.facultyId,
        );
        if (!a) throw new Error("A mentor must be assigned first.");
        s.interactions.push({
          id: uid(),
          taskId,
          assignmentId: a.id,
          notes,
          remarks: "",
          at: now(),
          status: "PENDING_REVIEW",
        });
      }
      t.status = "PENDING";
      audit(s, u, "MEETING_RECORDED", taskId, notes);
      const mentor = s.assignments.find(
        (a) => a.active && a.facultyId === p.facultyId,
      )?.mentorId;
      if (mentor)
        notify(
          s,
          mentor,
          "New activity evidence is ready for review.",
          "mentorship",
        );
    });
  }
  attendance(sessionId: string, facultyId: string, present: boolean) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      const session = s.sessions.find((x) => x.id === sessionId);
      const p = s.plans.find((p) => p.facultyId === facultyId);
      if (!session || !p) throw new Error("Session or induction not found.");
      editable(p);
      const t = s.tasks.find(
        (t) => t.planId === p.id && t.templateId === session.templateId,
      );
      if (!t)
        throw new Error("This session is not assigned to this faculty member.");
      if (t.waiver)
        throw new Error("This requirement already has a HOD waiver.");
      let a = s.attendance.find(
        (a) => a.sessionId === sessionId && a.facultyId === facultyId,
      );
      if (!a) {
        a = {
          id: uid(),
          sessionId,
          facultyId,
          status: "ABSENT",
          by: u.id,
          at: now(),
        };
        s.attendance.push(a);
      }
      a.status = present ? "PRESENT" : "ABSENT";
      a.by = u.id;
      a.at = now();
      t.status = present ? "COMPLETED" : "PENDING";
      audit(s, u, "ATTENDANCE_RECORDED", t.id, a.status);
      notify(
        s,
        owner(s, p),
        session.title + ": " + a.status.toLowerCase(),
        "training",
      );
    });
  }
  waiver(taskId: string, reason: string) {
    return this.write((s, u) => {
      allow(u, "HOD");
      const { t, p } = planFor(s, taskId);
      scope(s, u, p);
      editable(p);
      if (s.templates.find((x) => x.id === t.templateId)?.pillar !== "Training")
        throw new Error("Only a training requirement can be waived.");
      if (t.waiver || t.status === "COMPLETED")
        throw new Error("This training requirement is already satisfied.");
      t.waiver = {
        by: u.id,
        reason: required(reason, "A waiver justification is required."),
        at: now(),
      };
      audit(s, u, "TRAINING_WAIVED", taskId, reason);
      notify(
        s,
        owner(s, p),
        "A training waiver was granted: " + reason,
        "training",
      );
    });
  }
  submit(planId: string) {
    return this.write((s, u) => {
      allow(u, "NEW_FACULTY", "HR_COORDINATOR");
      const p = s.plans.find((p) => p.id === planId);
      if (!p) throw new Error("Induction not found.");
      scope(s, u, p);
      editable(p);
      if (!progress(s, p.id).eligible)
        throw new Error(
          "Complete all mandatory requirements before submitting for review.",
        );
      let d = s.dossiers.find((d) => d.planId === p.id);
      if (!d) {
        d = {
          id: uid(),
          planId: p.id,
          decision: "PENDING",
          remarks: "",
          at: now(),
          history: [],
        };
        s.dossiers.push(d);
      }
      d.decision = "PENDING";
      d.at = now();
      d.history.push({
        action: "SUBMITTED",
        by: u.id,
        remarks: "Submitted for final review",
        at: now(),
      });
      p.status = "PENDING_HOD_APPROVAL";
      audit(s, u, "DOSSIER_SUBMITTED", d.id);
      const f = s.faculty.find((f) => f.id === p.facultyId)!;
      notify(
        s,
        s.departments.find((d) => d.id === f.departmentId)!.hodUserId,
        "A dossier is ready for your final review.",
        "approvals",
      );
    });
  }
  returnDossier(planId: string, remarks: string) {
    return this.write((s, u) => {
      allow(u, "HOD");
      const p = s.plans.find((p) => p.id === planId);
      if (!p) throw new Error("Dossier not found.");
      scope(s, u, p);
      const d = s.dossiers.find((d) => d.planId === p.id);
      if (p.status !== "PENDING_HOD_APPROVAL" || d?.decision !== "PENDING")
        throw new Error("Dossier is not awaiting approval.");
      required(remarks, "Directives for revision are required.");
      p.status = "REVISION_REQUIRED";
      d.decision = "RETURNED_WITH_COMMENTS";
      d.remarks = remarks;
      d.history.push({
        action: "RETURNED_WITH_COMMENTS",
        by: u.id,
        remarks,
        at: now(),
      });
      audit(s, u, "DOSSIER_RETURNED", d.id, remarks);
      notify(
        s,
        owner(s, p),
        "Your dossier was returned: " + remarks,
        "overview",
      );
      notifyRole(
        s,
        "HR_COORDINATOR",
        "Dossier revision requested: " + remarks,
        "approvals",
      );
    });
  }
  async approve(planId: string, remarks: string) {
    const { s, u } = await this.read();
    allow(u, "HOD");
    const p = s.plans.find((p) => p.id === planId);
    if (!p) throw new Error("Dossier not found.");
    scope(s, u, p);
    this.approvalGate(s, p);
    const at = now(),
      id =
        "CERT-" +
        new Date().getFullYear() +
        "-" +
        uid().slice(0, 8).toUpperCase();
    const certificate = await createCertificate(s, p, id, at, u.id);
    return this.write((s, u) => {
      allow(u, "HOD");
      const p = s.plans.find((p) => p.id === planId)!;
      scope(s, u, p);
      this.approvalGate(s, p);
      const d = s.dossiers.find((d) => d.planId === p.id)!;
      d.decision = "APPROVED";
      d.remarks = remarks;
      d.history.push({ action: "APPROVED", by: u.id, remarks, at });
      p.status = "COMPLETED";
      s.certificates.push({ id, planId, at, hodId: u.id, ...certificate });
      audit(s, u, "HOD_APPROVAL", d.id, remarks);
      notify(
        s,
        owner(s, p),
        "Induction approved — your certificate is ready.",
        "certificate",
      );
      notifyRole(
        s,
        "HR_COORDINATOR",
        "Induction approved — certificate " + id + " generated.",
        "certificate",
      );
    });
  }
  private approvalGate(s: State, p: InductionPlan) {
    if (!progress(s, p.id).eligible)
      throw new Error(
        "Cannot approve induction: Milestones pending completion.",
      );
    if (
      p.status !== "PENDING_HOD_APPROVAL" ||
      s.dossiers.find((d) => d.planId === p.id)?.decision !== "PENDING" ||
      s.certificates.some((c) => c.planId === p.id)
    )
      throw new Error(
        "Dossier is not awaiting approval or has already been certified.",
      );
  }
  assign(facultyId: string, mentorId: string, reason: string) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      const f = s.faculty.find((f) => f.id === facultyId),
        m = s.users.find((u) => u.id === mentorId);
      const p = s.plans.find((p) => p.facultyId === facultyId);
      if (!f || !p) throw new Error("Faculty not found.");
      editable(p);
      if (
        !m?.active ||
        m.role !== "FACULTY_MENTOR" ||
        m.departmentId !== f.departmentId
      )
        throw new Error("Select an active mentor from the same department.");
      required(reason, "An assignment or reassignment reason is required.");
      s.assignments
        .filter((a) => a.active && a.facultyId === facultyId)
        .forEach((a) => (a.active = false));
      s.assignments.push({
        id: uid(),
        facultyId,
        mentorId,
        by: u.id,
        at: now(),
        active: true,
        reason,
      });
      audit(s, u, "MENTOR_ASSIGNED", facultyId, reason);
      notify(s, m.id, "You have been assigned a new mentee.", "mentorship");
      notify(
        s,
        f.userId,
        "Your mentor assignment has been updated.",
        "mentorship",
      );
    });
  }
  createSession(
    title: string,
    scheduled: string,
    venue: string,
    mandatory: boolean,
  ) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      required(title, "A session title is required.");
      required(venue, "A venue is required.");
      if (!scheduled || !Number.isFinite(new Date(scheduled).getTime()))
        throw new Error("Choose a valid date and time.");
      const id = uid(),
        templateId = "session-" + id;
      s.templates.push({
        id: templateId,
        title,
        pillar: "Training",
        mandatory,
        days: 28,
      });
      s.sessions.push({
        id,
        title,
        date: new Date(scheduled).toISOString(),
        venue,
        mandatory,
        templateId,
      });
      s.plans
        .filter((p) =>
          ["IN_PROGRESS", "DRAFT", "REVISION_REQUIRED"].includes(p.status),
        )
        .forEach((p) =>
          s.tasks.push({
            id: uid(),
            planId: p.id,
            templateId,
            status: "PENDING",
            due: new Date(scheduled).toISOString(),
            remarks: "",
          }),
        );
      audit(s, u, "SESSION_CREATED", id, title);
      notifyRole(
        s,
        "NEW_FACULTY",
        "New orientation session: " + title,
        "training",
      );
    });
  }
  onboard(
    name: string,
    email: string,
    departmentId: string,
    mentorId: string,
    phone = "",
  ) {
    return this.write((s, u) => {
      allow(u, "HR_COORDINATOR");
      required(name, "Name is required.");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        s.users.some((u) => u.email.toLowerCase() === email.toLowerCase())
      )
        throw new Error("Enter a valid, unique email address.");
      const m = s.users.find((u) => u.id === mentorId);
      if (
        !s.departments.some((d) => d.id === departmentId) ||
        !m?.active ||
        m.role !== "FACULTY_MENTOR" ||
        m.departmentId !== departmentId
      )
        throw new Error("Choose a same-department mentor.");
      const userId = uid(),
        facultyId = uid(),
        planId = uid(),
        at = now();
      s.users.push({
        id: userId,
        name,
        email,
        departmentId,
        role: "NEW_FACULTY",
        active: true,
        sessionVersion: 1,
      });
      s.faculty.push({
        id: facultyId,
        userId,
        departmentId,
        phone,
        employeeCode: "LNM-" + userId.slice(0, 8).toUpperCase(),
        designation: "Assistant Professor",
        joined: at,
        inductee: true,
      });
      s.plans.push({
        id: planId,
        facultyId,
        status: "IN_PROGRESS",
        startDate: at,
        deadline: new Date(Date.now() + 45 * 86400000).toISOString(),
      });
      s.assignments.push({
        id: uid(),
        facultyId,
        mentorId,
        by: u.id,
        at,
        active: true,
        reason: "Initial onboarding allocation",
      });
      s.templates
        .filter((t) => !t.departmentId || t.departmentId === departmentId)
        .forEach((t) => {
          const task: TaskProgress = {
            id: uid(),
            planId,
            templateId: t.id,
            status: "PENDING",
            due: new Date(Date.now() + t.days * 86400000).toISOString(),
            remarks: "",
          };
          s.tasks.push(task);
          if (t.pillar === "Mentorship")
            s.interactions.push({
              id: uid(),
              taskId: task.id,
              assignmentId: s.assignments.at(-1)!.id,
              notes: "Awaiting faculty evidence or meeting notes.",
              remarks: "",
              at,
              status: "PENDING_REVIEW",
            });
        });
      audit(s, u, "FACULTY_ONBOARDED", facultyId, name);
      notify(
        s,
        userId,
        "Welcome. Your induction roadmap is ready.",
        "overview",
      );
    });
  }
  updateUser(userId: string, role: Role, active: boolean) {
    return this.write((s, u) => {
      allow(u, "ADMIN");
      const target = s.users.find((u) => u.id === userId);
      if (
        !target ||
        ![
          "NEW_FACULTY",
          "FACULTY_MENTOR",
          "HOD",
          "HR_COORDINATOR",
          "ADMIN",
        ].includes(role)
      )
        throw new Error("Invalid user or role.");
      if (target.id === u.id && (!active || role !== "ADMIN"))
        throw new Error("Keep your own administrator account active.");
      if (
        s.departments.some((d) => d.hodUserId === target.id) &&
        (!active || role !== "HOD")
      )
        throw new Error(
          "Department heads must remain active in this prototype.",
        );
      if (
        s.assignments.some((a) => a.active && a.mentorId === target.id) &&
        (!active || role !== "FACULTY_MENTOR")
      )
        throw new Error("Reassign active mentees before changing this mentor.");
      if (
        role === "FACULTY_MENTOR" &&
        !s.faculty.some((f) => f.userId === target.id)
      ) {
        if (!s.departments.some((d) => d.id === target.departmentId))
          throw new Error(
            "This account needs an academic department before becoming a mentor.",
          );
        s.faculty.push({
          id: uid(),
          userId: target.id,
          employeeCode: "LNM-" + target.id,
          designation: "Professor",
          joined: now(),
          departmentId: target.departmentId,
          inductee: false,
        });
      }
      target.role = role;
      target.active = active;
      target.sessionVersion++;
      audit(s, u, "ACCOUNT_UPDATED", userId, role + "; active=" + active);
    });
  }
  template(
    title: string,
    pillar: "Documents" | "Mentorship" | "Training",
    mandatory: boolean,
    departmentId?: string,
  ) {
    return this.write((s, u) => {
      allow(u, "ADMIN");
      required(title, "A template title is required.");
      if (departmentId && !s.departments.some((d) => d.id === departmentId))
        throw new Error("Choose a valid department.");
      s.templates.push({
        id: uid(),
        title,
        pillar,
        mandatory,
        days: 28,
        departmentId: departmentId || undefined,
      });
      audit(
        s,
        u,
        "TEMPLATE_CREATED",
        "templates",
        title + "; applies to future inductions",
      );
    });
  }
  readNotification(id: string) {
    return this.write((s, u) => {
      const n = s.notifications.find((n) => n.id === id && n.userId === u.id);
      if (!n) throw new Error("Notification not found.");
      n.read = true;
    });
  }
  async document(id: string) {
    const { s, u } = await this.read();
    const d = s.documents.find((d) => d.id === id);
    if (!d) throw new Error("Document not found.");
    const { p } = planFor(s, d.taskId);
    allow(u, "NEW_FACULTY", "HR_COORDINATOR", "HOD");
    scope(s, u, p);
    return d;
  }
  async certificate(id: string) {
    const { s, u } = await this.read();
    const c = s.certificates.find((c) => c.id === id);
    if (!c) throw new Error("Certificate not found.");
    allow(u, "NEW_FACULTY", "HR_COORDINATOR", "HOD");
    scope(
      s,
      u,
      s.plans.find((p) => p.id === c.planId)!,
    );
    return c;
  }
}
