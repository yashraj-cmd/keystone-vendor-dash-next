import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";
import type { DriveClient, DriveFile, DriveUploadInput, DriveUploadResult } from "./types";
import { buildDriveFilename } from "./filename";

/**
 * Real Google Drive client. Enabled when DRIVE_ENABLED=true.
 * Credentials come from DRIVE_SERVICE_ACCOUNT_JSON (raw JSON or base64) — this works
 * on Vercel where there's no filesystem key path. Falls back to
 * DRIVE_SERVICE_ACCOUNT_JSON_PATH for local dev.
 */
export class GoogleDriveClient implements DriveClient {
  private driveClient: drive_v3.Drive | null = null;

  private client(): drive_v3.Drive {
    if (this.driveClient) return this.driveClient;
    const scopes = ["https://www.googleapis.com/auth/drive"];

    const rawJson = process.env.DRIVE_SERVICE_ACCOUNT_JSON;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let auth: any;
    if (rawJson) {
      const text = rawJson.trim().startsWith("{")
        ? rawJson
        : Buffer.from(rawJson, "base64").toString("utf-8");
      const credentials = JSON.parse(text);
      auth = new google.auth.GoogleAuth({ credentials, scopes });
    } else {
      const keyFile = process.env.DRIVE_SERVICE_ACCOUNT_JSON_PATH;
      if (!keyFile) {
        throw new Error(
          "Set DRIVE_SERVICE_ACCOUNT_JSON (key JSON/base64) or DRIVE_SERVICE_ACCOUNT_JSON_PATH when DRIVE_ENABLED=true.",
        );
      }
      auth = new google.auth.GoogleAuth({ keyFile, scopes });
    }
    this.driveClient = google.drive({ version: "v3", auth });
    return this.driveClient;
  }

  private async listFolder(folderId: string): Promise<DriveFile[]> {
    if (!folderId) return [];
    const results: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.client().files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, webViewLink, modifiedTime)",
        pageSize: 1000,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id || !f.name) continue;
        results.push({
          id: f.id,
          name: f.name,
          kind: "catalogue",
          webViewLink: f.webViewLink ?? null,
          modifiedTime: f.modifiedTime ?? new Date().toISOString(),
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return results;
  }

  async listCatalogues(): Promise<DriveFile[]> {
    return this.listFolder(process.env.DRIVE_CATALOGUES_FOLDER_ID ?? "");
  }

  async upload(input: DriveUploadInput): Promise<DriveUploadResult> {
    const folderId = process.env.DRIVE_CATALOGUES_FOLDER_ID;
    if (!folderId) throw new Error("DRIVE_CATALOGUES_FOLDER_ID is not configured.");
    const name = buildDriveFilename({
      vendorName: input.vendorName,
      kind: input.kind,
      uploadedAt: input.uploadedAt,
      originalFilename: input.originalFilename,
    });
    const res = await this.client().files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType: input.mimeType, body: Readable.from(input.data) },
      fields: "id, webViewLink, name",
    });
    if (!res.data.id) throw new Error("Drive upload returned no file id.");
    return {
      fileId: res.data.id,
      name: res.data.name ?? name,
      webViewLink: res.data.webViewLink ?? null,
    };
  }
}
