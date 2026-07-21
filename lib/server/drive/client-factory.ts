import type { DriveClient } from "./types";
import { GoogleDriveClient } from "./google";
import { MockDriveClient } from "./mock";

// Cache per serverless invocation so we don't recreate the auth on every call.
let cached: DriveClient | null = null;
let cachedMode: "real" | "mock" | null = null;

export function getDriveClient(): DriveClient {
  const mode: "real" | "mock" = process.env.DRIVE_ENABLED === "true" ? "real" : "mock";
  if (cached && cachedMode === mode) return cached;
  cached = mode === "real" ? new GoogleDriveClient() : new MockDriveClient();
  cachedMode = mode;
  return cached;
}
