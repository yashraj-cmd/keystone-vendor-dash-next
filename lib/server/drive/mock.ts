import { randomUUID } from "crypto";
import type { DriveClient, DriveFile, DriveUploadInput, DriveUploadResult } from "./types";
import { buildDriveFilename } from "./filename";

/**
 * In-process mock Drive client (DRIVE_ENABLED=false). Seeds three catalogue files:
 * two matchable to seed vendors, one intentionally unmatched to exercise the
 * unassigned-files review flow.
 */
export class MockDriveClient implements DriveClient {
  private catalogues: DriveFile[] = [];

  constructor() {
    const now = new Date().toISOString();
    this.catalogues = [
      {
        id: "mock-cat-nimbus",
        name: "NimbusTech IT Solutions — Catalogue — 2026-06-01 — services.pdf",
        kind: "catalogue",
        webViewLink: "https://drive.example/mock-cat-nimbus",
        modifiedTime: now,
      },
      {
        id: "mock-cat-vertex",
        name: "Vertex Marketing Agency — Catalogue — 2026-06-05 — brand-deck.pdf",
        kind: "catalogue",
        webViewLink: "https://drive.example/mock-cat-vertex",
        modifiedTime: now,
      },
      {
        id: "mock-cat-unknown",
        name: "Zenith Global — Catalogue — 2026-06-10 — intro.pdf",
        kind: "catalogue",
        webViewLink: "https://drive.example/mock-cat-unknown",
        modifiedTime: now,
      },
    ];
  }

  async listCatalogues(): Promise<DriveFile[]> {
    return [...this.catalogues];
  }

  async upload(input: DriveUploadInput): Promise<DriveUploadResult> {
    const name = buildDriveFilename({
      vendorName: input.vendorName,
      kind: input.kind,
      uploadedAt: input.uploadedAt,
      originalFilename: input.originalFilename,
    });
    const file: DriveFile = {
      id: `mock-${randomUUID()}`,
      name,
      kind: input.kind,
      webViewLink: `https://drive.example/${name}`,
      modifiedTime: input.uploadedAt.toISOString(),
    };
    if (input.kind === "catalogue") this.catalogues.push(file);
    return { fileId: file.id, name: file.name, webViewLink: file.webViewLink };
  }
}
