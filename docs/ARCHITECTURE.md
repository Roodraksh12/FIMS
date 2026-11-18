# Architecture

The React frontend calls the Node HTTP API through the Vite proxy. Both processes bind to localhost for the lab demo.

```text
frontend/src/App.tsx and DossierPages.tsx
  → frontend API client
  → backend/server.ts and gateway.ts
  → backend/services.ts and certificate.ts
  → backend/repository.ts → SQLite
```

The API issues a session token after verifying the account password. Each browser tab keeps its token in session storage. The server checks the account, role, ownership, active mentor assignment, and department when serving or changing induction records. Workspace responses include the plans visible to the signed-in role. File contents are retrieved separately through the document and certificate endpoints.

The repository stores a versioned snapshot in SQLite, including file bytes. Each mutation checks the expected version and writes the updated snapshot in one conditional SQL update. If another session writes first, the older operation is rejected and the UI reloads. The frontend also polls for changes from other sessions. The snapshot format is intended for the limited size of the lab dataset.

The server generates the certificate PDF before committing HOD approval. The same database update stores the approval, completed plan, PDF, audit event, and notifications. File validation and hashing run on the server as well as in the upload form.

The demo uses fictional accounts with individual initial passwords and simulated email. See the README for startup and reset instructions.
