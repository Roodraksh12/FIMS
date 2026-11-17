import { readFile } from "node:fs/promises";
import type { State, InductionPlan } from "../shared/domain.ts";
import { date } from "../shared/domain.ts";
import { sha256 } from "../shared/files.ts";
// EDIT THE CERTIFICATE PDF: The page size, colors, text, and positions are defined below.
export async function createCertificate(
  s: State,
  p: InductionPlan,
  id: string,
  at: string,
  hodId: string,
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const faculty = s.faculty.find((f) => f.id === p.facultyId)!;
  const user = s.users.find((u) => u.id === faculty.userId)!;
  const hod = s.users.find((u) => u.id === hodId)!;
  const pdf = await PDFDocument.create();
  pdf.setTitle("FIMS Induction Completion - " + user.name);
  pdf.setAuthor("LNMIIT FIMS Academic Prototype");
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({
    x: 24,
    y: 24,
    width: 794,
    height: 547,
    borderWidth: 1.5,
    borderColor: rgb(0.12, 0.29, 0.25),
  });
  page.drawRectangle({
    x: 31,
    y: 31,
    width: 780,
    height: 533,
    borderWidth: 0.5,
    borderColor: rgb(0.73, 0.66, 0.44),
  });
  const center = (t: string, y: number, size: number, font = regular) =>
    page.drawText(t, {
      x: (842 - font.widthOfTextAtSize(t, size)) / 2,
      y,
      size,
      font,
      color: rgb(0.12, 0.22, 0.2),
    });
  const logo = await pdf.embedJpg(
    await readFile(
      new URL("../frontend/public/lnmiit-logo.jpeg", import.meta.url),
    ),
  );
  const scaled = logo.scaleToFit(66, 66);
  page.drawImage(logo, {
    x: (842 - scaled.width) / 2,
    y: 474,
    width: scaled.width,
    height: scaled.height,
  });
  center("THE LNM INSTITUTE OF INFORMATION TECHNOLOGY", 448, 16, bold);
  center("Jaipur, Rajasthan", 426, 12);
  center("CERTIFICATE OF INDUCTION COMPLETION", 367, 24, bold);
  center("This is to certify that", 322, 15);
  center(user.name, 279, 30, bold);
  center(
    faculty.employeeCode +
      "  |  " +
      s.departments.find((d) => d.id === faculty.departmentId)!.name,
    251,
    12,
  );
  center(
    "has completed the required documentation, institutional training,",
    210,
    15,
  );
  center(
    "and departmental mentorship milestones of the faculty induction programme.",
    188,
    15,
  );
  page.drawText("Issued: " + date(at), { x: 65, y: 115, size: 11, font: sans });
  page.drawText("Certificate: " + id, { x: 65, y: 95, size: 10, font: sans });
  page.drawText(hod.name, { x: 570, y: 115, size: 13, font: bold });
  page.drawText("HOD endorsement (demonstration)", {
    x: 570,
    y: 95,
    size: 10,
    font: sans,
  });
  center(
    "Academic prototype - demonstration certificate. No institutional digital signature.",
    55,
    9,
    sans,
  );
  // The stored file and its SHA-256 hash are returned together for final approval.
  const bytes = await pdf.save();
  const buffer = new Uint8Array(bytes).buffer;
  return {
    blob: new Blob([buffer], { type: "application/pdf" }),
    hash: await sha256(buffer),
  };
}
