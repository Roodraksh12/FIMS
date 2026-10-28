# Prototype assumptions and decisions

- The user's explicit folder name **Prototype** supersedes `fims-prototype/` in the pasted implementation prompt. Original submissions are preserved.
- The SRS and Lab 6–7 design are the functional baseline. The unrelated root `DEVELOPMENT_PLAN.md` is ignored. CS314 is used consistently; the earlier CS311 reference is not propagated.
- This is a fictional October 2026 cohort. Actual current time determines audit timestamps and overdue labels. Seed requirements have a November 15, 2026 deadline; new inductions receive relative deadlines.
- There are seven required seed tasks. Aarav begins with five satisfied: 71.4% overall, shown as 71%. The illustrative “85%” in the initial prompt is not hard-coded. Two previously verified documents are seed records represented through their task states; their fictional original files are not fabricated. New uploads retain actual bytes and revision history.
- Documents, mentorship and training use exact counts for eligibility. Optional requirements are excluded from the denominator. An empty pillar is satisfied. A rounded display of 100% does not confer eligibility.
- The prototype accepts both `.jpg` and `.jpeg` as JPEG. It checks file headers, size, MIME and extension. Full file parsing and malware scanning are outside this prototype.
- Demo login uses a shared published password and quick account selection. No credentials are hashed because this is explicitly simulated authentication; no production authentication claim is made. Sessions and services still enforce actor identity and permissions in normal use.
- Plans are editable while in progress or revision; pending review locks evidence until HOD returns it. Approval locks completion. Return preserves the evidence and requires directives; a faculty member can respond through meeting notes as applicable and resubmit after all mandatory items remain satisfied.
- HOD training waiver satisfies only the designated training task. No real attendance or training system is integrated.
- Templates added through Administration apply to future inductions. Scheduling a session adds its requirement to editable active plans; pending or completed dossiers are not silently changed.
- Existing department-head identities remain designated by Department.hodUserId. Changing a random account to HOD does not make it the head of every department. Active mentor role changes require prior reassignment.
- Email is represented by persistent in-app notification records with `SIMULATED_LOCAL` delivery status. Report exports use CSV. No actual email or payroll/ERP integration is performed.
- Certificates are generated with a demo endorsement, not a forged signature or cryptographic institutional signature. Hashes identify bytes, not the authenticity of the issuing institution.
- Browser storage is not encrypted by this app; audit history is append-only through its services, not tamper-proof. Reset is a clearly confirmed demonstration-only destructive action.
- Browser timezone is used by the native session scheduling input and disclosed in its label. Stored timestamps are ISO values; rendered dates use Asia/Kolkata.
- The institutional logo is copied from the supplied common asset. System fonts are used to keep runtime completely local.
