import { beforeEach, describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { load, reset, commit } from "../backend/repository";
import { selectAccount } from "../backend/gateway";
import { Services, reminderCandidates } from "../backend/services";
import { progress, seed, type State } from "../shared/domain";
import { sha256, validateFile } from "../shared/files";
import * as certificate from "../backend/certificate";

const pdfFile = () =>
  new File(["%PDF-1.7\n academic sample"], "degree.pdf", {
    type: "application/pdf",
  });
async function as(id: string) {
  const s = await load();
  selectAccount(s.users.find((u) => u.id === id)!);
  return new Services(s.version);
}
async function uploadVerify() {
  await (await as("aarav")).upload("p-aarav-degree", pdfFile());
  const s = await load();
  await (
    await as("neha")
  ).reviewDocument(s.documents.at(-1)!.id, true, "Checked original");
}
async function ready() {
  await uploadVerify();
  await (
    await as("rajesh")
  ).reviewMentorship(
    "p-aarav-orientation",
    true,
    "Department orientation completed.",
  );
  await (await as("aarav")).submit("p-aarav");
}
beforeEach(async () => {
  vi.restoreAllMocks();
  await load();
  await reset();
});
describe("document validation and lifecycle", () => {
  it("computes a real SHA-256 hash", async () => {
    const f = pdfFile();
    const x = await validateFile(f);
    expect(x.hash).toBe(await sha256(await f.arrayBuffer()));
    expect(x.hash).toHaveLength(64);
  });
  it("rejects empty, oversized, mismatched and disguised files", async () => {
    await expect(validateFile(new File([], "empty.pdf"))).rejects.toThrow(
      "empty",
    );
    await expect(
      validateFile(new File([new Uint8Array(5242881)], "large.pdf")),
    ).rejects.toThrow("5MB");
    await expect(
      validateFile(
        new File(["not a pdf"], "fake.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toThrow("Invalid format");
    await expect(
      validateFile(new File(["%PDF-1.7"], "fake.png", { type: "image/png" })),
    ).rejects.toThrow("Invalid format");
  });
  it("accepts JPEG extension variants and PNG magic bytes", async () => {
    await expect(
      validateFile(
        new File([new Uint8Array([255, 216, 255, 224])], "photo.jpeg", {
          type: "image/jpeg",
        }),
      ),
    ).resolves.toMatchObject({ mime: "image/jpeg" });
    await expect(
      validateFile(
        new File(
          [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
          "photo.png",
          { type: "image/png" },
        ),
      ),
    ).resolves.toMatchObject({ mime: "image/png" });
  });
  it("uploads persist actual bytes without crediting verified progress", async () => {
    const before = progress(await load(), "p-aarav").percent;
    await (await as("aarav")).upload("p-aarav-degree", pdfFile());
    const s = await load();
    expect(s.documents[0].status).toBe("UPLOADED_PENDING_VERIFICATION");
    expect(await s.documents[0].blob.text()).toContain("%PDF");
    expect(progress(s, "p-aarav").percent).toBe(before);
    expect(s.notifications.some((n) => n.userId === "neha")).toBe(true);
  });
  it("requires rejection reason and preserves old revisions", async () => {
    await (await as("aarav")).upload("p-aarav-degree", pdfFile());
    const id = (await load()).documents[0].id;
    await expect(
      (await as("neha")).reviewDocument(id, false, "  "),
    ).rejects.toThrow("reason");
    await (await as("neha")).reviewDocument(id, false, "Please rescan");
    await (await as("aarav")).upload("p-aarav-degree", pdfFile());
    const s = await load();
    expect(s.documents.map((d) => d.status)).toEqual([
      "ARCHIVED",
      "UPLOADED_PENDING_VERIFICATION",
    ]);
    expect(
      s.audit.some(
        (a) =>
          a.action === "DOCUMENT_REJECTED" && a.remarks === "Please rescan",
      ),
    ).toBe(true);
  });
  it("blocks duplicate uploads and duplicate reviews", async () => {
    await (await as("aarav")).upload("p-aarav-degree", pdfFile());
    await expect(
      (await as("aarav")).upload("p-aarav-degree", pdfFile()),
    ).rejects.toThrow("already");
    const id = (await load()).documents[0].id;
    await (await as("neha")).reviewDocument(id, true, "");
    await expect(
      (await as("neha")).reviewDocument(id, true, ""),
    ).rejects.toThrow("already");
  });
});
describe("authorization and session boundaries", () => {
  it("rejects wrong roles and cross-account uploads", async () => {
    await expect(
      (await as("rajesh")).upload("p-aarav-degree", pdfFile()),
    ).rejects.toThrow("authorized");
    await expect(
      (await as("ishita")).upload("p-aarav-degree", pdfFile()),
    ).rejects.toThrow("account");
  });
  it("rejects an unassigned mentor", async () => {
    await expect(
      (await as("vikram")).reviewMentorship(
        "p-aarav-orientation",
        true,
        "Looks good",
      ),
    ).rejects.toThrow("not the assigned mentor");
  });
  it("rejects cross-department HOD access and file access", async () => {
    await (await as("aarav")).upload("p-aarav-degree", pdfFile());
    const id = (await load()).documents[0].id;
    await expect((await as("ecehod")).document(id)).rejects.toThrow(
      "department",
    );
    await expect(
      (await as("ecehod")).returnDossier("p-aarav", "Revise"),
    ).rejects.toThrow("department");
  });
  it("rejects actions captured before an account switch", async () => {
    const service = await as("rajesh");
    await as("vikram");
    await expect(
      service.reviewMentorship("p-aarav-orientation", true, "Reviewed"),
    ).rejects.toThrow("session changed");
  });
  it("invalidates edited account sessions", async () => {
    const old = await as("ishita");
    await (await as("admin")).updateUser("ishita", "NEW_FACULTY", false);
    const s = await load();
    expect(s.users.find((u) => u.id === "ishita")?.sessionVersion).toBe(2);
    await expect(old.submit("p-ishita")).rejects.toThrow();
  });
  it("checks stale versions and commits no partial records", async () => {
    const service = await as("rajesh");
    await commit((await load()).version, (s) => {
      s.version += 0;
    });
    const before = await load();
    await expect(
      service.reviewMentorship("p-aarav-orientation", true, "Reviewed"),
    ).rejects.toThrow("changed");
    const after = await load();
    expect(after.audit).toEqual(before.audit);
    expect(after.tasks).toEqual(before.tasks);
  });
});
describe("mentorship and training", () => {
  it("creates department-specific templates and initializes onboarding with contact and assignment", async () => {
    await (
      await as("admin")
    ).template("CSE lab safety", "Training", true, "cse");
    await (
      await as("neha")
    ).onboard(
      "Dr. Test Faculty",
      "test@lnmiit.ac.in",
      "cse",
      "rajesh",
      "9990001111",
    );
    const s = await load(),
      user = s.users.find((u) => u.email === "test@lnmiit.ac.in")!,
      f = s.faculty.find((f) => f.userId === user.id)!,
      p = s.plans.find((p) => p.facultyId === f.id)!;
    expect(f.phone).toBe("9990001111");
    expect(
      s.assignments.filter((a) => a.facultyId === f.id && a.active),
    ).toHaveLength(1);
    const t = s.tasks.find(
      (t) =>
        t.planId === p.id &&
        s.templates.find((x) => x.id === t.templateId)?.title ===
          "CSE lab safety",
    )!;
    await (await as("neha")).completeTraining(t.id, true);
    expect((await load()).tasks.find((x) => x.id === t.id)?.status).toBe(
      "COMPLETED",
    );
    await (
      await as("neha")
    ).onboard("Dr. ECE Faculty", "testece@lnmiit.ac.in", "ece", "anita");
    const other = await load(),
      otherUser = other.users.find((u) => u.email === "testece@lnmiit.ac.in")!,
      otherPlan = other.plans.find(
        (p) =>
          p.facultyId ===
          other.faculty.find((f) => f.userId === otherUser.id)!.id,
      )!;
    expect(other.tasks.filter((t) => t.planId === otherPlan.id)).toHaveLength(
      8,
    );
  });
  it("deduplicates daily deadline reminders and notifies the faculty member and HR", async () => {
    await commit((await load()).version, (s) => {
      s.tasks.find((t) => t.id === "p-aarav-degree")!.due = new Date(
        Date.now() - 86400000,
      ).toISOString();
    });
    const service = await as("aarav");
    expect(
      reminderCandidates(await load(), (await load()).users[0]),
    ).toHaveLength(1);
    await service.reminders();
    const s = await load();
    expect(
      s.notifications.some(
        (n) => n.userId === "aarav" && n.message.startsWith("Overdue:"),
      ),
    ).toBe(true);
    expect(
      s.notifications.some(
        (n) => n.userId === "neha" && n.message.startsWith("Overdue:"),
      ),
    ).toBe(true);
    expect(reminderCandidates(s, s.users[0])).toHaveLength(0);
  });
  it("requires signoff feedback and supports revision and resubmission", async () => {
    await expect(
      (await as("rajesh")).reviewMentorship("p-aarav-orientation", true, ""),
    ).rejects.toThrow("Advisory feedback");
    await (
      await as("rajesh")
    ).reviewMentorship("p-aarav-orientation", false, "Add lab safety notes");
    await (
      await as("aarav")
    ).meeting(
      "p-aarav-orientation",
      "Lab safety and equipment walkthrough completed.",
    );
    expect(
      (await load()).interactions.find(
        (i) => i.taskId === "p-aarav-orientation",
      )?.status,
    ).toBe("PENDING_REVIEW");
    await (
      await as("rajesh")
    ).reviewMentorship("p-aarav-orientation", true, "Evidence verified");
    expect(
      (await load()).tasks.find((t) => t.id === "p-aarav-orientation")?.status,
    ).toBe("COMPLETED");
    await expect(
      (await as("rajesh")).reviewMentorship(
        "p-aarav-orientation",
        true,
        "Again",
      ),
    ).rejects.toThrow("not awaiting");
  });
  it("records attendance and justification-scoped waivers", async () => {
    await (await as("neha")).attendance("s-lms", "f-aarav", false);
    expect(progress(await load(), "p-aarav").pillars.Training.percent).toBe(50);
    await expect(
      (await as("sunita")).waiver("p-aarav-lms", ""),
    ).rejects.toThrow("justification");
    await (
      await as("sunita")
    ).waiver("p-aarav-lms", "Experienced LMS instructor");
    expect(progress(await load(), "p-aarav").pillars.Training.percent).toBe(
      100,
    );
    expect(
      (await load()).tasks.find((t) => t.id === "p-aarav-policies")?.waiver,
    ).toBeUndefined();
  });
  it("reassigns exactly one active same-department mentor", async () => {
    await expect(
      (await as("neha")).assign("f-aarav", "anita", "Reassign"),
    ).rejects.toThrow("same department");
    await (await as("neha")).assign("f-aarav", "vikram", "Workload balance");
    const s = await load();
    expect(
      s.assignments.filter((a) => a.facultyId === "f-aarav" && a.active),
    ).toHaveLength(1);
    expect(s.assignments.filter((a) => a.facultyId === "f-aarav")).toHaveLength(
      2,
    );
    await expect(
      (await as("rajesh")).reviewMentorship("p-aarav-orientation", true, "OK"),
    ).rejects.toThrow("not the assigned");
  });
  it("adds session requirements to open plans", async () => {
    await (
      await as("neha")
    ).createSession("New workshop", "2026-11-12T10:00", "Room 101", true);
    const s = await load();
    expect(s.sessions).toHaveLength(3);
    expect(
      s.tasks.filter((t) => t.templateId === s.sessions.at(-1)!.templateId),
    ).toHaveLength(3);
  });
});
describe("progress and dossier lifecycle", () => {
  it("uses weighted counts and ignores optional items", () => {
    const s = seed();
    const p = progress(s, "p-aarav");
    expect(p.done).toBe(5);
    expect(p.total).toBe(7);
    expect(p.percent).toBeCloseTo(71.428);
    expect(p.eligible).toBe(false);
    s.tasks
      .filter((t) => t.planId === "p-aarav")
      .forEach(
        (t) =>
          (t.status = t.templateId === "research" ? "PENDING" : "VERIFIED"),
      );
    expect(progress(s, "p-aarav").eligible).toBe(true);
  });
  it("zero-item pillars are satisfied but rounding never changes eligibility", () => {
    const s = seed();
    s.tasks = s.tasks.filter(
      (t) => !["policies", "lms"].includes(t.templateId),
    );
    expect(progress(s, "p-aarav").pillars.Training.percent).toBe(100);
    const base = s.tasks[0];
    s.tasks = Array.from({ length: 1000 }, (_, i) => ({
      ...base,
      id: String(i),
      status: i === 999 ? "PENDING" : "VERIFIED",
    }));
    const p = progress(s, "p-aarav");
    expect(Math.round(p.percent)).toBe(100);
    expect(p.eligible).toBe(false);
  });
  it("blocks premature submission and requires explicit submission at 100%", async () => {
    await expect((await as("aarav")).submit("p-aarav")).rejects.toThrow(
      "mandatory",
    );
    await uploadVerify();
    await (
      await as("rajesh")
    ).reviewMentorship("p-aarav-orientation", true, "Reviewed");
    expect((await load()).plans[0].status).toBe("IN_PROGRESS");
    await expect((await as("sunita")).approve("p-aarav", "")).rejects.toThrow(
      "not awaiting",
    );
  });
  it("returns with mandatory directives and permits explicit resubmission", async () => {
    await ready();
    await expect(
      (await as("sunita")).returnDossier("p-aarav", ""),
    ).rejects.toThrow("Directives");
    await (
      await as("sunita")
    ).returnDossier("p-aarav", "Confirm teaching readiness");
    expect((await load()).plans[0].status).toBe("REVISION_REQUIRED");
    await (await as("aarav")).submit("p-aarav");
    expect((await load()).dossiers[0].history.map((h) => h.action)).toEqual([
      "SUBMITTED",
      "RETURNED_WITH_COMMENTS",
      "SUBMITTED",
    ]);
  });
  it("generates a real persistent PDF and commits one certificate with approval", async () => {
    await ready();
    await (await as("sunita")).approve("p-aarav", "Final approval");
    const s = await load();
    expect(s.plans[0].status).toBe("COMPLETED");
    expect(s.certificates).toHaveLength(1);
    const c = s.certificates[0],
      bytes = await c.blob.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPages()).toHaveLength(1);
    expect(pdf.getTitle()).toContain("Aarav");
    expect(c.hash).toBe(await sha256(bytes));
    expect(
      s.notifications.some(
        (n) => n.userId === "aarav" && n.page === "certificate",
      ),
    ).toBe(true);
    await expect(
      (await as("sunita")).approve("p-aarav", "Again"),
    ).rejects.toThrow("already");
    await expect((await as("aarav")).certificate(c.id)).resolves.toMatchObject({
      id: c.id,
    });
    await expect((await as("ishita")).certificate(c.id)).rejects.toThrow(
      "account",
    );
  });
  it("leaves dossier pending on PDF generation failure", async () => {
    await ready();
    vi.spyOn(certificate, "createCertificate").mockRejectedValueOnce(
      new Error("PDF generation failed"),
    );
    await expect((await as("sunita")).approve("p-aarav", "")).rejects.toThrow(
      "PDF",
    );
    const s = await load();
    expect(s.plans[0].status).toBe("PENDING_HOD_APPROVAL");
    expect(s.certificates).toHaveLength(0);
    expect(s.dossiers[0].decision).toBe("PENDING");
  });
  it("aborts approval if storage version changes during PDF generation", async () => {
    await ready();
    const original = certificate.createCertificate;
    vi.spyOn(certificate, "createCertificate").mockImplementationOnce(
      async (...args) => {
        const result = await original(...args);
        await commit((await load()).version, (s) => {
          s.audit.push({
            id: "other",
            actorId: "neha",
            action: "OTHER",
            entityId: "cohort",
            remarks: "",
            at: new Date().toISOString(),
          });
        });
        return result;
      },
    );
    await expect((await as("sunita")).approve("p-aarav", "")).rejects.toThrow(
      "changed",
    );
    const s = await load();
    expect(s.certificates).toHaveLength(0);
    expect(s.dossiers[0].decision).toBe("PENDING");
  });
  it("failed mutation rolls back task, audit and notification updates", async () => {
    const before = await load();
    await expect(
      commit(before.version, (s) => {
        s.tasks[0].status = "VERIFIED";
        s.audit = [];
        s.notifications = [];
        throw new Error("storage simulation");
      }),
    ).rejects.toThrow("simulation");
    const after = await load();
    expect(after.tasks).toEqual(before.tasks);
    expect(after.audit).toEqual(before.audit);
    expect(after.notifications).toEqual(before.notifications);
  });
  it("reset restores seed while increasing the version", async () => {
    await ready();
    const version = (await load()).version;
    await reset();
    const s = await load();
    expect(s.version).toBeGreaterThan(version);
    expect(s.dossiers).toHaveLength(0);
    expect(s.documents).toHaveLength(0);
    expect(progress(s, "p-aarav").done).toBe(5);
  });
});
