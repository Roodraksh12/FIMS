# FIMS — Faculty Induction Management System

A working local academic prototype for LNMIIT, CS314, Team T077. This folder is independent of the original assignment submissions.

## Run on Windows

Install Node.js 22.18 or newer. Open PowerShell in the FIMS project folder and run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://127.0.0.1:5173/** or the URL printed by Vite. The command starts the React frontend and the Node API together. Keep the terminal open during the demo. After dependency installation, the demo runs without internet access.

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React screens, API client, and sample files |
| `backend/` | HTTP API, demo sessions, workflow rules, PDF generation, and SQLite |
| `shared/` | Domain types, progress calculation, and file validation |

```powershell
npm.cmd run build        # TypeScript check and frontend bundle
npm.cmd test             # workflow, SQLite, and certificate tests
npm.cmd run test:browser # isolated browser tests with installed Google Chrome
npm.cmd run preview      # serve the built frontend and start the API
```

The browser tests use a separate server and in-memory SQLite. Screenshots and the downloaded certificate are written to `tests/artifacts/`.

## Run from VS Code

Open the FIMS folder in VS Code. Press **F5** and choose **FIMS: Debug frontend and API** to start both processes and open Chrome at port 5173. For a regular demo run, use **Tasks: Run Task** → **FIMS: Start demo**. The same task menu has build, service test, and Chrome test commands.

## Demo accounts

Use a quick-account button on the login page or sign in with a listed email and the shared **demonstration password `Fims@2026`**. Switch accounts in the top-right header after login.

| Role | Account | Email |
| --- | --- | --- |
| New faculty | Dr. Aarav Sharma | aarav.sharma@lnmiit.ac.in |
| Faculty mentor | Prof. Rajesh Gupta | rgupta@lnmiit.ac.in |
| Department head | Dr. Sunita Meena | hod.cse@lnmiit.ac.in |
| HR coordinator | Ms. Neha Verma | hr.induction@lnmiit.ac.in |
| System administrator | Central Administration | admin@lnmiit.ac.in |

Additional CSE/ECE accounts demonstrate mentor assignment and department restrictions. All people and records are fictional. Accounts selected through the switcher have their own identities and permissions.

## Try the complete workflow

1. Select **New faculty**. In **My documents**, upload `frontend/public/samples/qualification.pdf` to **Academic qualification certificate**. A download link to this file is also on the page. Uploading does not count as HR verification.
2. Switch to **Ms. Neha Verma** → **Document verification** → Review → Verify → Save review.
3. Switch to **Prof. Rajesh Gupta** → **Mentorship** → review Department & laboratory orientation. Add feedback and sign off.
4. Switch to **Dr. Aarav Sharma** → **My submission** → Submit my dossier. All seven mandatory requirements are now satisfied; the optional research profile does not block submission.
5. Switch to **Dr. Sunita Meena** → **Review & approve** → Approve induction → Confirm final approval.
6. Switch to **Dr. Aarav Sharma** → **Certificates** → Download certificate PDF.

Refresh between steps to verify persistence. See [the extended walkthrough](docs/DEMO_WALKTHROUGH.md) for revision, rejection, training, onboarding, and permission scenarios.

## Data and reset

SQLite stores records, uploaded files, and generated certificates in `backend/data/fims.sqlite`. The backend seeds the database on first launch. Records survive browser refresh and server restart, and browser sessions connected to the same API share the records. Sign in again after restarting the API.

Before a rehearsal or live demo, switch to **Central Administration** and select **Reset demo data** in the sidebar. Confirm to restore the fictional seed data and sign out all demo sessions. This erases all changes, uploads, and certificates from the demo database.


## Prototype boundaries

- The API binds to loopback and uses disposable demo sessions. Quick-account selection and the shared password are for fictional data only.
- File SHA-256 hashes are real. SQLite storage is not application-encrypted. File checks validate size, extension, reported MIME, and header signatures; they are not malware scanning or complete document parsing.
- Generated PDFs have a real ID and integrity digest. HOD endorsement is clearly a demonstration; this is not an institutional digital signature or real credential.
- Notifications persist in the app. Email delivery is simulated locally. No actual email is sent.
- Audit events are append-only through application services, not tamper-proof against someone with access to the database file. Reset is an explicit demo-only exception.
- There is no payroll, ERP integration, OCR, AI matching, native mobile app, or calendar integration.

Read [architecture](docs/ARCHITECTURE.md), [assumptions](docs/ASSUMPTIONS.md), and [requirements coverage](docs/REQUIREMENTS_TRACEABILITY.md).

The dossier workflow is role-specific: faculty uses **My submission**, HR uses **Induction records**, and HOD uses **Review & approve**. See [role workflows](docs/DOSSIER_ROLE_WORKFLOWS.md).
