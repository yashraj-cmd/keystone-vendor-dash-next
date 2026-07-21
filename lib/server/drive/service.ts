import { DocumentSource } from "@shared";
import { prisma } from "@/lib/prisma";
import { HttpError } from "../auth";
import { audit } from "../audit";
import { attachCatalogue } from "../catalogues";
import { getDriveClient } from "./client-factory";
import { normalizeToken, parseDriveFilename } from "./filename";
import { matchDriveVendor } from "./matcher";
import type { DriveFile, DriveUploadInput } from "./types";

interface SyncResult {
  attached: number;
  unassigned: number;
  skipped: number;
  errors: number;
}

/** Connection info for the UI banner. */
export function getStatus() {
  const enabled = process.env.DRIVE_ENABLED === "true";
  const folderId = process.env.DRIVE_CATALOGUES_FOLDER_ID || "";
  return {
    enabled,
    folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
  };
}

/** List Drive catalogues, parse names, attach to vendors or persist as unassigned. */
export async function runSync(actorUserId: string | null): Promise<SyncResult> {
  const client = getDriveClient();
  const files = await client.listCatalogues();
  const result: SyncResult = { attached: 0, unassigned: 0, skipped: 0, errors: 0 };

  for (const file of files) {
    try {
      await processFile(file, actorUserId, result);
    } catch (err) {
      result.errors++;
      console.warn(`[drive] failed on "${file.name}": ${(err as Error).message}`);
    }
  }

  await audit({
    userId: actorUserId,
    action: "DRIVE_SYNC",
    entityType: "DriveSync",
    entityId: new Date().toISOString(),
    metadata: { ...result },
  });
  return result;
}

async function processFile(
  file: DriveFile,
  actorUserId: string | null,
  result: SyncResult,
): Promise<void> {
  // Skip files the operator dismissed.
  const ignored = await prisma.ignoredFile.findUnique({ where: { driveFileId: file.id } });
  if (ignored) {
    result.skipped++;
    return;
  }

  const parsed = parseDriveFilename(file.name, "catalogue");
  if (!parsed) {
    result.skipped++;
    return;
  }

  // Idempotency: skip if we already have a catalogue with this driveFileId.
  const existing = await prisma.catalogue.findUnique({ where: { driveFileId: file.id } });
  if (existing) {
    result.skipped++;
    return;
  }

  const vendorId = await matchDriveVendor(parsed.vendorToken);
  if (!vendorId) {
    // Persist to DB so it survives serverless invocations. Upsert on fileId is
    // idempotent when the same file appears in successive syncs.
    await prisma.driveUnassignedFile.upsert({
      where: { fileId: file.id },
      update: {
        name: file.name,
        kind: file.kind,
        vendorToken: parsed.vendorToken,
        webViewLink: file.webViewLink,
        modifiedTime: new Date(file.modifiedTime),
      },
      create: {
        fileId: file.id,
        name: file.name,
        kind: file.kind,
        vendorToken: parsed.vendorToken,
        webViewLink: file.webViewLink,
        modifiedTime: new Date(file.modifiedTime),
      },
    });
    result.unassigned++;
    return;
  }

  await attachCatalogue(
    vendorId,
    {
      title: file.name,
      driveFileId: file.id,
      viewUrl: file.webViewLink ?? undefined,
      uploadedAt: new Date(file.modifiedTime).toISOString(),
    },
    actorUserId,
    DocumentSource.DRIVE_SYNC,
  );
  result.attached++;
}

export async function listUnassigned() {
  const rows = await prisma.driveUnassignedFile.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    fileId: r.fileId,
    name: r.name,
    kind: r.kind,
    vendorToken: r.vendorToken,
    webViewLink: r.webViewLink,
    modifiedTime: r.modifiedTime.toISOString(),
  }));
}

export async function assignUnassigned(
  fileId: string,
  vendorId: string,
  actorUserId: string | null,
) {
  const row = await prisma.driveUnassignedFile.findUnique({ where: { fileId } });
  if (!row) throw new HttpError(404, "Unassigned file not found (try syncing again).");
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new HttpError(400, "Vendor not found.");

  await attachCatalogue(
    vendorId,
    {
      title: row.name,
      driveFileId: row.fileId,
      viewUrl: row.webViewLink ?? undefined,
      uploadedAt: row.modifiedTime.toISOString(),
    },
    actorUserId,
    DocumentSource.DRIVE_SYNC,
  );

  // Remember this token → vendor mapping so future same-named files auto-link.
  const normalized = normalizeToken(row.vendorToken);
  await prisma.fileAssignment.upsert({
    where: { normalizedToken: normalized },
    update: { vendorId },
    create: { normalizedToken: normalized, vendorId },
  });

  await prisma.driveUnassignedFile.delete({ where: { fileId } });
  await audit({
    userId: actorUserId,
    action: "DRIVE_ASSIGN",
    entityType: "DriveFile",
    entityId: fileId,
    metadata: { vendorId, name: row.name },
  });
  return { success: true };
}

export async function ignoreUnassigned(fileId: string, actorUserId: string | null) {
  const row = await prisma.driveUnassignedFile.findUnique({ where: { fileId } });
  await prisma.ignoredFile.upsert({
    where: { driveFileId: fileId },
    update: {},
    create: { driveFileId: fileId },
  });
  if (row) await prisma.driveUnassignedFile.delete({ where: { fileId } });
  await audit({
    userId: actorUserId,
    action: "DRIVE_IGNORE",
    entityType: "DriveFile",
    entityId: fileId,
    metadata: { name: row?.name },
  });
  return { success: true };
}

/** Used by manual catalogue uploads if we ever push the file to Drive too. */
export async function uploadOnBehalfOfVendor(input: DriveUploadInput) {
  return getDriveClient().upload(input);
}
