# Demonstration walkthrough

Start the local server and open the printed address. Use the same browser profile and origin between visits. Main demonstration: approximately 1–2 minutes once familiar with the account switcher.

## Core path

1. New Faculty / Aarav: the dashboard shows five of seven required tasks satisfied. Go to My documents. Download the supplied sample if needed. Upload it for Academic qualification certificate; wait for the hash and submit. Progress is unchanged until HR verification.
2. HR / Neha: Document verification → Review → inspect the PDF → Verify → Save review. The faculty document task now counts as satisfied.
3. Mentor / Rajesh: Mentorship → Department & laboratory orientation → Review. Attempt without remarks to see validation; enter feedback and sign off. The task becomes Completed and the faculty member receives a notification.
4. Faculty / Aarav: Induction dossiers → Submit for final review. Progress is 100% but approval still requires the HOD.
5. HOD / Sunita: Induction dossiers → inspect the pillar counts and consolidated evidence. Approve → Cancel to demonstrate no change. Approve again → Confirm final approval. Wait for PDF generation and commit.
6. Faculty / Aarav: Certificates → Download certificate PDF. Open the downloaded file. Refresh and download again to verify persistent original bytes. HR can also retrieve the completed certificate.

## Alternative paths

- Document rejection: HR selects Reject with a reason. Faculty sees Revision required, re-uploads, and retains the old archived revision. HR verifies the new upload.
- Mentor revision: Rajesh selects Request revision with guidance. Aarav selects Resubmit evidence, updates the notes, and submits. Rajesh can then review and sign off.
- HOD return: after submission, Sunita returns with directives. Aarav sees the directives and can remediate/respond and explicitly resubmit. The decision history retains both submissions and return.
- Training: Neha opens Orientation & training, selects a faculty record, and records presence/absence. Sunita can grant a justified task-specific waiver in her department. New sessions can be scheduled for open plans.
- Onboarding: Neha opens Faculty & mentors → Onboard faculty; enters a unique email, department, and same-department mentor. A roadmap is initialized from templates. The new account becomes available in the switcher.
- Reassignment: Neha reassigns Aarav to Vikram with a reason; only one active pairing remains. Rajesh loses access to Aarav, while Vikram gains it.
- Administration: Admin can add future-induction templates and edit account roles/access. Edited sessions are invalidated. Active mentors must be reassigned first.
- Permission boundaries: select the ECE HOD to see only Kabir. Select Vikram before reassignment to see Ishita rather than Aarav. HR verification and admin settings are absent from faculty navigation. Services also reject direct unauthorized calls (automated tests).
- Reports: HOD/mentor reports are scoped; HR/admin can view institutional summaries. Export CSV and inspect the audit history.
- Persistence: refresh after an upload and after an approval. Open a second tab to observe synchronized changes; stale submissions are rejected rather than overwriting newer records.
- Reset: sidebar → Reset demo data → confirm. Only the local prototype database is reset; original project files remain intact.

## Screens

S-01 login; S-02 role dashboard; S-03 documents; S-04 upload dialog; S-05 assigned mentee selection/worklist; S-06 evidence/review; S-07 revision decision in the review dialog; S-08 department worklist and dossier selection; S-09 dossier; S-10 approval confirmation; S-11 return directives; S-12 certificate preview/download. Additional HR/admin pages complete the operational cycle.

## Role-specific submission pages

Faculty uses My submission to prepare and submit/resubmit their own record. HR uses Induction records to search/filter the faculty readiness worklist, inspect administrative clearances, and forward an eligible record on behalf of faculty. HOD uses Review & approve to make the departmental decision. These names supersede the earlier shared Induction dossiers menu label. See DOSSIER_ROLE_WORKFLOWS.md.
