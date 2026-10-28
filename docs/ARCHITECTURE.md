# Architecture

FIMS realizes the Lab 6 four-tier design as replaceable browser modules. It does not represent these modules as a deployed backend.

```text
React pages / dialogs (App.tsx)
        ↓
Gateway: session, role, ownership, assignment, department (gateway.ts)
        ↓
Application operations (services.ts) → PDF generation / SHA-256 (certificate.ts)
        ↓
IndexedDB repository: optimistic concurrency, atomic snapshots (repository.ts)
```

`domain.ts` defines normalized entities, canonical states, seed data, and derived progress. Entity arrays have stable IDs and foreign-key relationships. Task templates define a pillar and mandatory flag; task progress belongs to an induction. Roles are attributes of accounts rather than subclasses. Active mentor assignments reference accounts with matching faculty profiles.

Each service captures a session nonce and data revision. Mutations reread the current snapshot inside a serialized IndexedDB read/write transaction, check its revision and current principal, validate permission and transition, then write the complete new snapshot. Failure aborts the transaction. Uploaded Blobs, audit events, and notifications are committed with their associated records. A single stored snapshot trades large-dataset scalability for simple reliable atomicity in this small local prototype; the domain remains normalized within it.

PDF generation, logo loading, and hashing happen before the approval transaction. The service rechecks the session, revision, exact pillar counts, pending dossier, and absence of an existing certificate at commit. Failure never commits plan completion without a certificate. Document uploads similarly validate/hash before committing. No awaited external work runs within the IndexedDB transaction callback.

BroadcastChannel announces commits across tabs. React subscribes to repository changes and reloads persisted state. Stale writes are rejected; users review the refreshed record before retrying. A session nonce prevents an asynchronous operation captured under one account from finishing under another. Updating an account increments its session version.

Authorization is repeated in the service even when the UI hides/disables an action. Ownership, active mentor assignment, and department-head identity determine visible plan scope. Document and certificate access have additional role restrictions. These checks demonstrate correct business behavior, not protection against a browser owner modifying JavaScript/storage.

DocumentManager operations cover upload, verification and rejection. MentorshipService operations cover evidence, revision and sign-off. InductionWorkflowEngine covers derived progress, explicit submission, return and approval. CertificateEngine creates/persists PDF bytes; AuditLogEngine and NotificationService are transaction-local helpers. Administration/orientation operations cover accounts, templates, onboarding, assignments, sessions and attendance. All mutations go through `Services`; UI reads are selectors on the snapshot.

Run `npm.cmd test` for repository, domain, authorization and PDF coverage; `npm.cmd run test:browser` for actual UI journeys and downloads. See the traceability matrix for screen and requirement locations.

Role-specific dossier surfaces are implemented in `src/DossierPages.tsx`: FacultySubmission handles personal readiness/submission tracking, while HRInductionRecords handles an administrative worklist and clearance review. App routes these by current role and retains the HOD decision view. All three use the same repository records and existing checked service operations.
