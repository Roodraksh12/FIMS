export const sha256 = async (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const INVALID_FILE =
  "Invalid format or file exceeds 5MB limit. Please upload PDF, JPG, or PNG.";
// EDIT UPLOAD RULES: Check size, extension, MIME type, and the bytes at the start of a file. Both browser and server use this function.
export async function validateFile(file: File) {
  if (!file.size)
    throw new Error(
      "The selected file is empty. Please choose a valid document.",
    );
  // FILE SIZE LIMIT: 5 MiB. If you change this, also update the server request limit in backend/server.ts and the user-facing text.
  if (file.size > 5242880) throw new Error(INVALID_FILE);
  const bytes = await file.arrayBuffer();
  const a = new Uint8Array(bytes);
  let mime = "";
  if (
    a[0] === 0x25 &&
    a[1] === 0x50 &&
    a[2] === 0x44 &&
    a[3] === 0x46 &&
    a[4] === 0x2d
  )
    mime = "application/pdf";
  if (a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff) mime = "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => a[i] === n))
    mime = "image/png";
  // ALLOWED FORMATS: The extension, detected file header, and browser MIME type must agree with the supported document types.
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (
    !mime ||
    !{
      "application/pdf": ["pdf"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
    }[mime]?.includes(ext || "") ||
    (file.type &&
      file.type !== mime &&
      file.type !== "application/octet-stream")
  )
    throw new Error(INVALID_FILE);
  return { mime, hash: await sha256(bytes) };
}
