# Separate dossier workflows

The same underlying faculty record supports three distinct pages. No data is duplicated and permission checks still run in the service layer.

| Role | Navigation | Purpose | Available actions |
| --- | --- | --- | --- |
| New faculty | My submission | Prepare and track their own final application | Open blockers, read HOD revision feedback, submit/resubmit an eligible dossier, track the decision, open their certificate |
| HR coordinator | Induction records | Coordinate readiness across faculty and departments | Search/filter the worklist, check a faculty record, inspect documents, open verification/attendance/allocation tools, forward a cleared record on behalf of faculty |
| HOD | Review & approve | Make the final departmental decision | Select an own-department record, inspect evidence, return with required directives, confirm final approval |

## Faculty page

The page title is **My induction submission**. It shows personal submission status, a three-stage process, incomplete requirements, HOD comments after a return, and the faculty member's own history. It has no faculty selector, administrative queue or approval controls. Only exact mandatory completion enables submission. Pending review locks evidence; returned records can be corrected and resubmitted.

## HR page

The page title is **Faculty induction records**. It starts with a readiness worklist, not a preselected personal dossier. Search uses name/employee code; filters distinguish outstanding requirements, readiness, submitted, returned and completed records. Opening a record shows document clearance, mentor clearance, attendance/training clearance and an administrative decision log.

The selected faculty record carries through when HR opens attendance management. HR can inspect mentor evidence but cannot sign it off. The forwarding action says **Send to HOD on behalf of faculty** and uses the existing checked submission service. Pending or completed records have no forwarding action. HR cannot issue the HOD's approval.

## HOD page

The page title is **Review & approve inductions**. It retains the consolidated evidence and decision controls for the HOD's own department. It does not tell the HOD to complete their own checklist or submit a personal dossier. Approval requires a pending submitted dossier and exact completion, with a separate confirmation.

## Implementation and verification

`src/DossierPages.tsx` implements separate FacultySubmission and HRInductionRecords components; `src/App.tsx` routes by role and retains the HOD review. Navigation, headings and descriptions are role-specific. Shared history/status helpers display the same persisted events with the correct actor.

Browser checks cover distinct role surfaces, unavailable unauthorized controls, queue filtering, selected-record attendance navigation, mobile overflow, faculty submission/resubmission, HR forwarding, and HOD approval. Existing service tests continue to cover ownership, role, assignment, department, exact progress, stale state and transaction rules.
