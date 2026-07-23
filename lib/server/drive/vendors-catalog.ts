import { Readable } from "node:stream";
import { google, drive_v3 } from "googleapis";

/**
 * Uploads to the approved "Vendors Catalog" Drive folder using an OAuth (real-user)
 * credential — service accounts have no storage quota, so they can't own files in a
 * My Drive folder. The destination folder is FIXED here; callers can never override it.
 */
const APPROVED_FOLDER_ID = "1SE7TAgAN_oOwQDdmb7GbOnTKj6IvkMYf";
const APPROVED_FOLDER_NAME = "Vendors Catalog";

export function driveOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
}

/** The approved folder id, enforced against the hard-coded boundary. */
function folderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error("GOOGLE_DRIVE_FOLDER_ID is required.");
  if (id !== APPROVED_FOLDER_ID) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not the approved Vendors Catalog folder.");
  }
  return id;
}

let cached: drive_v3.Drive | null = null;
function getDrive(): drive_v3.Drive {
  if (cached) return cached;
  if (!driveOAuthConfigured()) throw new Error("Google Drive OAuth is not configured.");
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

function validateFileName(name: string): string {
  const n = name?.trim();
  if (!n) throw new Error("fileName is required.");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F]/u.test(n)) throw new Error("fileName contains control characters.");
  return n;
}

/** Confirm the configured folder really is the approved Vendors Catalog folder. */
export async function verifyVendorsCatalogFolder(): Promise<void> {
  const id = folderId();
  const res = await getDrive().files.get({ fileId: id, fields: "id,name,mimeType,trashed" });
  const f = res.data;
  const ok =
    f.id === APPROVED_FOLDER_ID &&
    f.name === APPROVED_FOLDER_NAME &&
    f.mimeType === "application/vnd.google-apps.folder" &&
    f.trashed !== true;
  if (!ok) throw new Error("Vendors Catalog folder validation failed.");
}

export interface VendorsCatalogUploadResult {
  fileId: string;
  name: string;
  webViewLink: string | null;
}

/** Upload a file into the fixed Vendors Catalog folder and confirm its parent. */
export async function uploadToVendorsCatalog(input: {
  fileName: string;
  mimeType: string;
  data: Buffer;
}): Promise<VendorsCatalogUploadResult> {
  const parent = folderId();
  const res = await getDrive().files.create({
    requestBody: { name: validateFileName(input.fileName), parents: [parent] },
    media: { mimeType: input.mimeType, body: Readable.from(input.data) },
    fields: "id,name,parents,webViewLink",
  });
  const f = res.data;
  if (!f.id) throw new Error("Google Drive upload returned no file id.");
  if (f.parents?.length !== 1 || f.parents[0] !== parent) {
    throw new Error("Google Drive returned an unexpected parent folder.");
  }
  return { fileId: f.id, name: f.name ?? input.fileName, webViewLink: f.webViewLink ?? null };
}
