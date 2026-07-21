import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeToken } from "./filename";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Match a vendor token (from a Drive filename) to a dashboard vendor:
 *   1. Remembered FileAssignment (normalizedToken → vendorId)
 *   2. Exact vendor name (case-insensitive)
 *   3. Exact contactName (case-insensitive)
 *   4. Partial substring on name (either direction), then on normalized name
 *   5. Email domain contains normalized token
 * Returns the vendor id or null.
 */
export async function matchDriveVendor(vendorToken: string, tx?: Tx): Promise<string | null> {
  const db = tx ?? prisma;
  const raw = vendorToken.trim();
  const normalized = normalizeToken(raw);
  if (!normalized) return null;

  // 1. Remembered assignment
  const assignment = await db.fileAssignment.findUnique({ where: { normalizedToken: normalized } });
  if (assignment) return assignment.vendorId;

  // 2. Exact name
  const exactName = await db.vendor.findFirst({ where: { name: { equals: raw, mode: "insensitive" } } });
  if (exactName) return exactName.id;

  // 3. Exact contactName
  const exactContact = await db.vendor.findFirst({
    where: { contactName: { equals: raw, mode: "insensitive" } },
  });
  if (exactContact) return exactContact.id;

  // 4a. Partial substring on name (either direction)
  const all = await db.vendor.findMany({ select: { id: true, name: true, email: true } });
  const rawLower = raw.toLowerCase();
  for (const v of all) {
    const nameLower = v.name.toLowerCase();
    if (nameLower.includes(rawLower) || rawLower.includes(nameLower)) return v.id;
  }
  // 4b. Normalized-name substring
  for (const v of all) {
    const nn = normalizeToken(v.name);
    if (nn && (nn.includes(normalized) || normalized.includes(nn))) return v.id;
  }

  // 5. Email domain contains the normalized token
  for (const v of all) {
    if (!v.email) continue;
    if (normalizeToken(v.email).includes(normalized)) return v.id;
  }
  return null;
}
