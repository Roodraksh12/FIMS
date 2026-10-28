# FIMS — Faculty Induction Management System

A working local academic prototype for LNMIIT, CS314, Team T077. This folder is independent of the original assignment submissions.

## Run on Windows

To get the project from GitHub:

```powershell
git clone https://github.com/Roodraksh12/FIMS.git
cd FIMS
npm.cmd install
npm.cmd run dev
```

The repository contains only the prototype. Original lab submissions are kept separately.

Install Node.js 20.19+ or 22.12+ (Node 22 LTS recommended). Open PowerShell:

```powershell
cd "C:\Users\ZMAGYEET\Downloads\SDE LAB\Prototype"
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173/**. Keep the terminal running; Ctrl+C stops it. `npm.cmd` avoids PowerShell script execution-policy issues. If 5173 is occupied, Vite prints the selected alternative port. Use the same hostname and port to retain the same browser database.

Dependencies are already installed in the delivered workspace. Installation requires internet; subsequent normal use needs only the local server. No API keys, backend database, cloud service, CDN, or external fonts are required. This is not a service-worker offline installation: keep the local server available, including when generating a certificate.

```powershell
npm.cmd test              # domain / repository / certificate tests
npm.cmd run build        # strict TypeScript check and production bundle
npm.cmd run preview      # serve the built app, normally port 4173
npm.cmd run test:browser  # browser workflow tests; installed Google Chrome required
```

The browser tests start their own server on 5173. Stop an existing development server before running them if it cannot be reached from the test process. Test screenshots and a real downloaded certificate are written to `tests/artifacts/`; Playwright uses fresh browser contexts so personal demo data is unaffected.

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

1. Select **New faculty**. In **My documents**, upload `public/samples/qualification.pdf` to **Academic qualification certificate**. A download link to this file is also on the page. Uploading does not count as HR verification.
2. Switch to **Ms. Neha Verma** → **Document verification** → Review → Verify → Save review.
3. Switch to **Prof. Rajesh Gupta** → **Mentorship** → review Department & laboratory orientation. Add feedback and sign off.
4. Switch to **Dr. Aarav Sharma** → **My submission** → Submit my dossier. All seven mandatory requirements are now satisfied; the optional research profile does not block submission.
5. Switch to **Dr. Sunita Meena** → **Review & approve** → Approve induction → Confirm final approval.
6. Switch to **Dr. Aarav Sharma** → **Certificates** → Download certificate PDF.

Refresh between steps to verify persistence. See [the extended walkthrough](docs/DEMO_WALKTHROUGH.md) for revision, rejection, training, onboarding, and permission scenarios.

## Data and reset

Records and actual file Blobs are stored in IndexedDB (`fims-prototype-v1`). Sessions use localStorage. The database is seeded once. A revision counter prevents stale writes, and BroadcastChannel updates other open tabs. The sidebar **Reset demo data** action asks for confirmation, removes prototype changes/files, restores the seed, and logs out. Reset affects only this application's database at the current origin.

Use a persistent browser profile and allow site storage. Private browsing, clearing site data, changing the origin, or browser quota limits can remove/prevent persistence. If storage fails, enable site storage and reload; do not upload sensitive real faculty records to this academic demo.

## Prototype boundaries

- Four logical layers run in the browser. There is no REST server, PostgreSQL deployment, JWT authentication, institutional SSO, or secure server boundary.
- File SHA-256 hashes are real. IndexedDB storage is not application-encrypted. File checks validate size, extension, reported MIME, and header signatures; they are not malware scanning or complete document parsing.
- Generated PDFs have a real ID and integrity digest. HOD endorsement is clearly a demonstration; this is not an institutional digital signature or real credential.
- Notifications persist in the app. Email delivery is simulated locally. No actual email is sent.
- Audit events are append-only through application services, not tamper-proof against someone editing browser storage. Reset is an explicit demo-only exception.
- There is no payroll, ERP integration, OCR, AI matching, native mobile app, or calendar integration.

Read [architecture](docs/ARCHITECTURE.md), [assumptions](docs/ASSUMPTIONS.md), and [requirements coverage](docs/REQUIREMENTS_TRACEABILITY.md).

The dossier workflow is role-specific: faculty uses **My submission**, HR uses **Induction records**, and HOD uses **Review & approve**. See [role workflows](docs/DOSSIER_ROLE_WORKFLOWS.md).
