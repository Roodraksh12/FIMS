# Validation record

Validated on 28 October 2026 on Windows using Node.js 26.7.0 and installed Google Chrome. The supported Node baseline is listed in README.md. All checks below ran against the delivered source after the final functional changes.

## Automated results

- `npm.cmd run build`: passed strict TypeScript compilation and Vite production build. PDF generation is loaded separately; no large-bundle warning remains.
- `npm.cmd test`: **27 passed** in one service/repository test file.
- `npm.cmd run test:browser`: **4 passed** using Chrome, fresh IndexedDB contexts and the local Vite server.

After adding a direct mentorship-evidence action to the HOD dossier, the production build and the complete browser workflow were rerun successfully. That journey additionally verifies the displayed teaching-readiness rating before approval. No domain-service code changed after the 27-test service run.

Browser journeys cover:
1. Actual sample upload, refresh, HR verification, mentor feedback validation/sign-off, explicit dossier submission, approval cancellation, final approval, refresh, original PDF download.
2. HR rejection/re-upload with archived revision, mentor revision/resubmission, HOD return/directives and dossier resubmission.
3. Phone/tablet/desktop widths, page overflow check, keyboard Escape on dialog, ECE HOD scoping, blocked incomplete approval, reduced motion and offline navigation within the loaded app.
4. Department-specific admin template, HR onboarding with contact phone, training completion and report CSV download, new faculty account access.

Service tests cover file hash/validation, role/owner/mentor/department denials, session changes, stale revisions, mentorship/training/assignment rules, contact/department template initialization, daily deduplicated reminders, weighted/optional/empty/rounding progress, explicit submission/return, generated PDF/hash, duplicate approval, PDF failure, concurrent version change and transaction rollback, persistence and reset.

## PDF verification

The PDF downloaded through the actual app was reopened with pypdf and pypdfium2, rendered to PNG, and visually inspected. It is a one-page landscape certificate containing Dr. Aarav Sharma, employee code LNM-2026101, CSE, HOD Dr. Sunita Meena, a certificate ID and issue date. It includes a demonstration endorsement and prototype note. The service test independently parses the PDF and verifies its stored SHA-256 digest.

## Visual review

Inspected desktop, phone, tablet and certificate screenshots. An independent reviewer requested larger mobile text and removal of redundant heading labels. Those changes were applied in one batch, screenshots recaptured, and the reviewer scored all prior findings resolved (“ship at this bounded scope”). Screenshots are under `tests/artifacts/`, including the rendered actual PDF. The review did not rerun the automated tests or establish a full accessibility audit.

The Impeccable engine/detector could not run because its engine was not installed in its cache. Source guidance and direct screenshot inspection were used; no detector pass is claimed.

## Local environment notes

Dependency installation and Chrome/localhost tests required execution outside the restricted sandbox. This was a tooling restriction: the test runner and development server work normally in a local PowerShell terminal. No paid services or external runtime calls are required. The final app server responded HTTP 200 at http://127.0.0.1:5173/.

Node 26 emits an experimental localStorage warning in unit tests. The application stores data in browser IndexedDB and does not depend on Node localStorage. The warning does not affect the test result.

## Limits

This is an academic browser prototype. Production authentication, encryption, signing, malware scanning, tamper-proof audits, load testing, backup/recovery, email delivery and institutional compliance are not validated or claimed. No real faculty data is seeded. Offline runtime means internet access is unnecessary while the local server runs; a service worker for server-free reload is not included.

## Campus-portal visual revision

User-requested visual update: replaced promotional copy and green hero/cards with a light navigation rail, muted blue actions, practical task-first faculty layout, real faculty/date metadata and compact progress/mentor details. No persistence or service code changed. Production build and 27 service tests passed after this update. Manually inspected sign-in, faculty overview, HR overview, documents, and upload/cancel in the running in-app browser. Checked 375px page width and navigation and restored the default viewport. Existing browser test heading expectations were updated; the four-journey automated browser suite was not rerun for this revision. Preview: `tests/artifacts/campus-dashboard.jpg`.

## Role-specific dossier workflow revision

Production build and 27 service tests passed. The existing four browser journeys plus a new role-separation journey passed (5 total). Added an HR-forwarding journey and mobile checks; after a narrow-header overflow fix, the two affected journeys were rerun successfully. Across these runs, all six browser scenarios passed. The role check verifies personal-only faculty submission, HR filters and clearance review, disabled forwarding for incomplete records, no HR/faculty approval controls, correct selected-faculty attendance navigation, and HOD-only approval. HR forwarding is additionally verified through faculty tracking and HOD readiness. Desktop/mobile screenshots are saved as faculty-submission.png, faculty-submission-mobile.png, hr-induction-worklist.png, hr-clearance-review.png and hr-clearance-mobile.png under tests/artifacts/.
