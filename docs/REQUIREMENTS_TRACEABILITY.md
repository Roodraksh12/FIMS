# Requirements traceability

Baseline: Lab 2 SRS and the Lab 6–7 detailed design. “Implemented” below means interactive browser-prototype behavior, not deployed institutional infrastructure. Gateway, Services and Repository references mean `backend/gateway.ts`, `backend/services.ts` and `backend/repository.ts`. UI is `frontend/src/App.tsx`; canonical types and progress are `shared/domain.ts`.

## Functional requirements

| ID | Prototype realization | Source / validation |
| --- | --- | --- |
| FR-001 | Demo email/password login and quick account selection | UI login; Gateway; browser tests |
| FR-002 | Invalid credentials show a recoverable login error | UI login |
| FR-003 | Sign out clears the active demo session | Gateway.selectAccount; UI |
| FR-004 | Administrator edits account roles; session versions invalidated | Services.updateUser; unit tests |
| FR-005 | Role-specific menus plus service role/ownership/department checks | Gateway.allow/scope; authorization unit tests |
| FR-006 | HR initializes a new faculty profile and plan | Services.onboard; Faculty & mentors |
| FR-007 | Profile stores employee code, name, department, designation, joining date and account email | Domain FacultyProfile/UserAccount; contact phone recorded during HR onboarding; existing-profile editing is not part of this prototype |
| FR-008 | Department-linked plan initialized from current checklist templates | Services.onboard; shared defaults plus optional department-specific templates; new inductions receive applicable requirements |
| FR-009 | Same-department active mentor required at onboarding/assignment | Services.onboard/assign; unit tests |
| FR-010 | Mentor reassignment reason and retained assignment history | Services.assign; unit tests |
| FR-011 | Mandatory/optional document checklist | My documents; Domain templates |
| FR-012 | Actual file upload, 5 MB limit, MIME/extension/header checks, real SHA-256 | Services.upload/validateFile; unit and browser tests |
| FR-013 | Authorized HR/HOD document preview and original download | Services.document; Review/Preview dialogs |
| FR-014 | HR verifies pending documents | Services.reviewDocument; unit/browser tests |
| FR-015 | HR rejects with mandatory reason | Services.reviewDocument; unit/browser tests |
| FR-016 | Re-upload after rejection retains archived revision | Services.upload; unit/browser tests |
| FR-017 | HR schedules sessions with title, time, venue and mandatory flag | Services.createSession; unit tests |
| FR-018 | Scoped faculty training schedule and session details | Orientation & training |
| FR-019 | Mandatory training requirement list | Orientation & training; templates |
| FR-020 | HR records presence or absence for a faculty session | Services.attendance; unit tests |
| FR-021 | Task completion stored with attendance/audit timestamp; standalone training can be completed by HR | Services.attendance/completeTraining |
| FR-022 | Department HOD grants justified, task-specific training waiver | Services.waiver; unit tests |
| FR-023 | Mentor sees only actively assigned inductees/worklists | Gateway.scope/visiblePlans; unit/browser tests |
| FR-024 | Faculty/mentor records dated meeting evidence and notes | Services.meeting; mentorship timeline |
| FR-025 | Assigned mentor signs off departmental activity | Services.reviewMentorship; unit/browser tests |
| FR-026 | Qualitative remarks and 1–5 teaching-readiness rating | Services.reviewMentorship; mentor review / evidence dialogs |
| FR-027 | Retained chronological meeting/review audit history | Mentorship timeline; audit records |
| FR-028 | Live satisfied-mandatory-task percentage and pillar counts | Domain.progress; dashboard; unit tests |
| FR-029 | Canonical distinct task states and revision state | Domain.TaskStatus; service state checks |
| FR-030 | Derived overdue badges; daily deduplicated due-soon/overdue notification to faculty and HR on app activity | Services.reminders; runs while app state changes, not an unattended background daemon |
| FR-031 | Actor, timestamp and remarks recorded for milestone mutations | Audit helper and persistent audit view; unit tests |
| FR-032 | Explicit faculty/HR submission gated by exact mandatory completion | Services.submit; unit/browser tests |
| FR-033 | Department-scoped consolidated dossier, pillar/evidence checklist | Induction dossiers; Gateway.scope |
| FR-034 | Gated and confirmed HOD approval, repeated service checks | Services.approve; unit/browser tests |
| FR-035 | Return with mandatory directives, retained decision history and resubmission | Services.returnDossier/submit; unit/browser tests |
| FR-036 | Generate real PDF before atomic approval commit | certificate.ts; Services.approve; failure/PDF unit tests |
| FR-037 | Authorized download of original persisted PDF bytes | Services.certificate; browser download test |
| FR-038 | Faculty document-decision notifications | Services.reviewDocument; unit/browser tests |
| FR-039 | Due-soon reminders and notification read state | Services.reminders/readNotification; local email simulation |
| FR-040 | Mentor notified on activity evidence submission | Services.meeting |
| FR-041 | Individual progress/dossier summary and staff report rows | Overview, Induction dossiers, scoped report; faculty can export their scoped induction summary as CSV |
| FR-042 | Departmental reports with real counts and CSV export | Reports & audit; Gateway.visiblePlans |
| FR-043 | Institution-wide HR/admin summary plus task/audit views | Overview, Reports & audit, verification; CSV includes per-faculty pending and overdue requirement counts |
| FR-044 | Role-specific metrics, worklists, progress bars | Overview; no fabricated chart data |

## Acceptance criteria

| ID | Realization | Validation |
| --- | --- | --- |
| AC-01 | Authenticated NEW_FACULTY principal required to upload | Unit: wrong role/ownership; browser login |
| AC-02 | PDF/JPEG/PNG checks including bytes | Unit file validation |
| AC-03 | 5,242,880-byte maximum, empty file rejected | Unit boundary/invalid tests |
| AC-04 | Persistent document status/history and upload-success toast | Browser core path |
| AC-05 | Upload sets task UPLOADED, does not count as verified | Unit upload-progress test |
| AC-06 | HR queue receives pending upload and notification | Unit/browser core path |
| AC-07 | Active assigned mentor only | Unit unassigned mentor/reassignment |
| AC-08 | Nonempty review feedback | Unit/browser required-remarks test |
| AC-09 | Sign-off sets task COMPLETED | Unit/browser mentorship path |
| AC-10 | Mentor actor and timestamp in audit | Audit persistence unit checks |
| AC-11 | Progress recalculated from current task records | Unit weighted/optional/zero-item tests |
| AC-12 | Approval disabled for incomplete pillars; repeated service gate | Unit and responsive browser HOD check |
| AC-13 | Consolidated documents/training/mentorship dossier | Browser dossier path |
| AC-14 | Explicit confirmation; cancel leaves pending dossier unchanged | Browser cancellation then approval |
| AC-15 | Real stored PDF certificate with ID and digest | Unit PDF parse/hash; browser download |
| AC-16 | Plan COMPLETED with notification and certificate in same transaction | Unit/browser approval tests |

## Business rules and screens

BR-001–BR-010 map respectively to HR/admin initialization, unique active same-department pairing, verified-document submission gate, mentor sign-off gate, file constraints, exact three-pillar approval, required rejection reason, retained revisions/locked completed plans, report scoping, and audit records. Demo Reset intentionally clears prototype-only data after confirmation and is not an institutional record-deletion feature.

S-01 login, S-02 dashboard, S-03 checklist, S-04 upload, S-05 mentor worklist/record selector, S-06 evidence/review, S-07 revision option with required guidance, S-08 department worklist/selector, S-09 dossier, S-10 confirmation, S-11 return dialog, S-12 certificate. S-07 shares a review dialog with S-06 rather than creating another navigation level.

## Nonfunctional scope

Local accessibility/responsive behavior, modularity, persistence, real hashing, and failure handling are exercised. Production load capacity, secure encrypted storage, tamper-proof audit, real authentication, availability SLAs, backups, SMTP, institutional certificate signing and institutional data protection are not claimed. A browser owner can inspect all local demo storage; the service-layer scoping is an application demonstration.

Validation commands and evidence: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:browser`; screenshots and downloaded PDF in `tests/artifacts/`. See `VALIDATION.md` for the recorded final results.
