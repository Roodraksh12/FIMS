import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const artifacts = "tests/artifacts";
async function account(page: Page, id: string) {
  await page
    .getByRole("combobox", { name: "Switch demo account" })
    .selectOption(id);
  await expect(
    page.getByRole("combobox", { name: "Switch demo account" }),
  ).toHaveValue(id);
}
async function nav(page: Page, name: string) {
  if (name === "Induction dossiers") {
    const account = await page
      .getByRole("combobox", { name: "Switch demo account" })
      .locator("option:checked")
      .textContent();
    name = account?.includes("New faculty")
      ? "My submission"
      : account?.includes("HR coordinator")
        ? "Induction records"
        : "Review & approve";
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: new RegExp("^" + name + "(?:\\s*\\d+)?$") })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New faculty Dr. Aarav/ }).click();
  await expect(
    page.getByRole("heading", { name: "My induction" }),
  ).toBeVisible();
});
test("complete upload, verify, signoff, submit, cancel, approve and download with persistence", async ({
  page,
}) => {
  await mkdir(artifacts, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: artifacts + "/desktop.png", fullPage: true });
  await nav(page, "My documents");
  await page
    .getByRole("button", { name: "Upload", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Choose document")
    .setInputFiles("public/samples/qualification.pdf");
  await expect(
    page.getByText("SHA-256:", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("71%").first())
    .toBeVisible({ timeout: 1000 })
    .catch(() => {});
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true }),
  ).toBeVisible();
  await account(page, "neha");
  await nav(page, "Document verification");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The queue is clear" }),
  ).toBeVisible();
  await account(page, "rajesh");
  await nav(page, "Mentorship");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Advisory feedback comments",
  );
  await page
    .getByRole("textbox", { name: "Review remarks / revision guidance" })
    .fill(
      "Reviewed lab orientation and safety evidence. All departmental milestones met.",
    );
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "aarav");
  await nav(page, "Induction dossiers");
  await page
    .getByRole("button", { name: /^(Submit|Resubmit) my dossier$/ })
    .click();
  await expect(page.getByText("Pending hod approval").first()).toBeVisible();
  await account(page, "sunita");
  await nav(page, "Induction dossiers");
  await page
    .getByRole("button", { name: "View evidence", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Teaching readiness: 4/5",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve induction", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Approve induction", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm final approval", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });
  await account(page, "aarav");
  await nav(page, "Certificates");
  await expect(
    page.getByRole("heading", { name: "Induction completed" }),
  ).toBeVisible();
  await page.reload();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download certificate PDF" }).click();
  const download = await downloadEvent;
  await download.saveAs(artifacts + "/verified-certificate.pdf");
  await expect(page.getByRole("status")).not.toBeVisible({ timeout: 7000 });
  await page.screenshot({
    path: artifacts + "/certificate.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("rejection, reupload, mentorship revision, dossier return and resubmission", async ({
  page,
}) => {
  await nav(page, "My documents");
  await page
    .getByRole("button", { name: "Upload", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Choose document")
    .setInputFiles("public/samples/qualification.pdf");
  await page
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "neha");
  await nav(page, "Document verification");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("combobox", { name: "Decision" }).selectOption("reject");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("rejection reason");
  await page
    .getByRole("textbox", { name: "Review remarks (required for rejection)" })
    .fill("Please upload a readable scan.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "aarav");
  await nav(page, "My documents");
  await page.getByRole("button", { name: "Re-upload", exact: true }).click();
  await page
    .getByLabel("Choose document")
    .setInputFiles("public/samples/qualification.pdf");
  await page
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "neha");
  await nav(page, "Document verification");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "rajesh");
  await nav(page, "Mentorship");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Decision" })
    .selectOption("revision");
  await page
    .getByRole("textbox", { name: "Review remarks / revision guidance" })
    .fill("Add lab safety evidence.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "aarav");
  await nav(page, "Mentorship");
  await page.getByRole("button", { name: "Resubmit evidence" }).click();
  await page
    .getByRole("textbox", { name: "Meeting notes and activity evidence" })
    .fill("Lab safety briefing completed with equipment demonstration.");
  await page
    .getByRole("button", { name: "Submit evidence", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "rajesh");
  await nav(page, "Mentorship");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Review remarks / revision guidance" })
    .fill("All evidence reviewed.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "aarav");
  await nav(page, "Induction dossiers");
  await page
    .getByRole("button", { name: /^(Submit|Resubmit) my dossier$/ })
    .click();
  await expect(page.getByText("Pending hod approval").first()).toBeVisible();
  await account(page, "sunita");
  await nav(page, "Induction dossiers");
  await page.getByRole("button", { name: "Return with directives" }).click();
  await page
    .getByRole("textbox", { name: "Directives for revision" })
    .fill("Confirm final teaching readiness.");
  await page
    .getByRole("button", { name: "Return dossier", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "aarav");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByText("Confirm final teaching readiness.").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^(Submit|Resubmit) my dossier$/ })
    .click();
  await expect(page.getByText("Pending hod approval").first()).toBeVisible();
});
test("responsive views, keyboard dialog, restricted navigation and offline runtime", async ({
  page,
  context,
}) => {
  await mkdir(artifacts, { recursive: true });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: artifacts + "/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await nav(page, "My documents");
  await page
    .getByRole("button", { name: "Upload", exact: true })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: artifacts + "/tablet.png", fullPage: true });
  await account(page, "ecehod");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("heading", { name: "Dr. Kabir Sethi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Faculty record" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await account(page, "aarav");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Open navigation" })
    .isVisible()
    .then(async (visible) => {
      if (visible)
        await page.getByRole("button", { name: "Open navigation" }).click();
    });
  await nav(page, "Notifications");
  await expect(
    page.getByRole("heading", { name: "Your updates" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("HR onboarding, admin template configuration, training completion and report export", async ({
  page,
}) => {
  await account(page, "admin");
  await nav(page, "Administration");
  await page.getByRole("button", { name: "Add template" }).click();
  await page
    .getByRole("textbox", { name: "Requirement title" })
    .fill("CSE teaching technology induction");
  await page
    .getByRole("combobox", { name: "Applies to department" })
    .selectOption("cse");
  await page
    .getByRole("combobox", { name: "Induction pillar" })
    .selectOption("Training");
  await page
    .getByRole("button", { name: "Add checklist template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "neha");
  await nav(page, "Faculty & mentors");
  await page
    .getByRole("button", { name: "Onboard faculty", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Faculty full name" })
    .fill("Dr. Test Faculty");
  await page
    .getByRole("textbox", { name: "Institutional email" })
    .fill("testfaculty@lnmiit.ac.in");
  await page
    .getByRole("textbox", { name: "Contact phone (optional)" })
    .fill("9990001111");
  await page.getByRole("button", { name: "Create induction roadmap" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Dr. Test Faculty", exact: false }),
  ).toBeVisible();
  await nav(page, "Orientation & training");
  await page
    .getByRole("combobox", { name: "Faculty record" })
    .selectOption({ label: "Dr. Test Faculty" });
  const training = page
    .getByRole("row")
    .filter({ hasText: "CSE teaching technology induction" });
  await training.getByRole("button", { name: "Record completion" }).click();
  await expect(training).toContainText("Completed");
  await nav(page, "Reports & audit");
  const report = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await report).suggestedFilename()).toBe("fims-induction-report.csv");
  await page
    .getByRole("combobox", { name: "Switch demo account" })
    .selectOption({ label: "Dr. Test Faculty · New faculty" });
  await expect(
    page.getByRole("heading", { name: "My induction" }),
  ).toBeVisible();
  await nav(page, "My documents");
  await expect(
    page.getByRole("cell", {
      name: "Academic qualification certificate Required",
    }),
  ).toBeVisible();
});

test("dossier portals have distinct faculty, HR and HOD workflows", async ({
  page,
}) => {
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("heading", { name: "My induction submission", exact: true }),
  ).toBeVisible();
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({
    path: artifacts + "/faculty-submission.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: artifacts + "/faculty-submission-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(
    page.getByRole("heading", { name: "What is holding up your submission" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Faculty record" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Faculty readiness worklist" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Send to HOD on behalf/ }),
  ).toHaveCount(0);
  await account(page, "neha");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("heading", {
      name: "Faculty induction records",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Faculty readiness worklist" }),
  ).toBeVisible();
  await page.screenshot({
    path: artifacts + "/hr-induction-worklist.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("row").filter({ hasText: "Dr. Aarav Sharma" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Dr. Kabir Sethi" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter induction records" })
    .selectOption("ready");
  await expect(
    page.getByText("No faculty records match this filter."),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter induction records" })
    .selectOption("all");
  await page
    .getByRole("row")
    .filter({ hasText: "Dr. Aarav Sharma" })
    .getByRole("button", { name: "Check record" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Document clearance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mentor clearance", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: artifacts + "/hr-clearance-review.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: artifacts + "/hr-clearance-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(
    page.getByRole("button", { name: "Send to HOD on behalf of faculty" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Manage this faculty member’s attendance" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Faculty record" }),
  ).toHaveValue("p-aarav");
  await account(page, "sunita");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("heading", {
      name: "Review & approve inductions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /my dossier|Send to HOD on behalf/ }),
  ).toHaveCount(0);
});

test("HR forwards a cleared record while faculty tracks the submission", async ({
  page,
}) => {
  await nav(page, "My documents");
  await page
    .getByRole("button", { name: "Upload", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Choose document")
    .setInputFiles("public/samples/qualification.pdf");
  await page
    .getByRole("button", { name: "Submit document", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "neha");
  await nav(page, "Document verification");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "rajesh");
  await nav(page, "Mentorship");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Review remarks / revision guidance" })
    .fill("All departmental evidence reviewed.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await account(page, "neha");
  await nav(page, "Induction dossiers");
  await page
    .getByRole("combobox", { name: "Filter induction records" })
    .selectOption("ready");
  await page
    .getByRole("row")
    .filter({ hasText: "Dr. Aarav Sharma" })
    .getByRole("button", { name: "Check record" })
    .click();
  await page
    .getByRole("button", { name: "Send to HOD on behalf of faculty" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Record forwarded to HOD" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send to HOD on behalf of faculty" }),
  ).toHaveCount(0);
  await account(page, "aarav");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("heading", { name: "Your submission is with the HOD" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /my dossier/ })).toHaveCount(0);
  await expect(page.getByText(/Ms. Neha Verma/).last()).toBeVisible();
  await account(page, "sunita");
  await nav(page, "Induction dossiers");
  await expect(
    page.getByRole("button", { name: "Approve induction", exact: true }),
  ).toBeEnabled();
});
