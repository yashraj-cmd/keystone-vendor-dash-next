import { prisma } from "@/lib/prisma";
import type { ZohoBill } from "./client";

/**
 * Match a Zoho bill to a dashboard vendor:
 *   1. Vendor.zohoVendorId === bill.vendorId (durable link)
 *   2. Exact name (case-insensitive)
 *   3. Partial name match either direction
 * Returns the vendor id, or null (→ unmatched).
 */
export async function matchVendor(bill: ZohoBill): Promise<string | null> {
  if (bill.vendorId) {
    const linked = await prisma.vendor.findUnique({ where: { zohoVendorId: bill.vendorId } });
    if (linked) return linked.id;
  }
  const name = bill.vendorName?.trim();
  if (!name) return null;

  const exact = await prisma.vendor.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (exact) return exact.id;

  const nameLower = name.toLowerCase();
  const all = await prisma.vendor.findMany({ select: { id: true, name: true } });
  for (const v of all) {
    const vn = v.name.toLowerCase();
    if (vn.includes(nameLower) || nameLower.includes(vn)) return v.id;
  }
  return null;
}
