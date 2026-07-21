import { InvoiceStatus, rupeesToPaise } from "@shared";
import { prisma } from "@/lib/prisma";
import { HttpError } from "../auth";
import { audit } from "../audit";
import { upsertFromZoho } from "../invoices";
import * as client from "./client";
import { matchVendor } from "./matcher";
import { mapZohoStatus } from "./status-util";
import { healthCheck } from "./client";
import { invoiceSource, zohoDc } from "./auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SyncResult {
  added: number;
  updated: number;
  unmatched: number;
  skipped: number;
  errors: number;
}

// Best-effort, per-instance (fine for status display; unmatched itself is in the DB).
let lastSyncAt: string | null = null;
let lastResult: SyncResult | null = null;

function toUpsert(bill: client.ZohoBill, status: InvoiceStatus) {
  return {
    zohoId: bill.zohoId,
    invoiceNumber: bill.billNumber,
    amount: rupeesToPaise(bill.total),
    invoiceDate: new Date(bill.date),
    dueDate: bill.dueDate ? new Date(bill.dueDate) : null,
    status,
    viewUrl: bill.viewUrl,
  };
}

export async function runSync(actorUserId: string | null): Promise<SyncResult> {
  const bills = await client.listBills();
  const result: SyncResult = { added: 0, updated: 0, unmatched: 0, skipped: 0, errors: 0 };

  // Rebuild the unmatched view from scratch each sync.
  await prisma.zohoUnmatchedInvoice.deleteMany({});

  for (const bill of bills) {
    try {
      const status = mapZohoStatus(bill.status);
      if (status === null) {
        result.skipped++;
        continue;
      }
      const existing = await prisma.invoice.findUnique({ where: { zohoId: bill.zohoId } });
      if (existing) {
        await upsertFromZoho(existing.vendorId, toUpsert(bill, status), actorUserId);
        result.updated++;
        continue;
      }
      const vendorId = await matchVendor(bill);
      if (!vendorId) {
        await prisma.zohoUnmatchedInvoice.create({
          data: {
            zohoId: bill.zohoId,
            invoiceNumber: bill.billNumber,
            vendorName: bill.vendorName,
            zohoVendorId: bill.vendorId || null,
            amount: rupeesToPaise(bill.total),
            status,
            invoiceDate: new Date(bill.date),
            dueDate: bill.dueDate ? new Date(bill.dueDate) : null,
            viewUrl: bill.viewUrl,
          },
        });
        result.unmatched++;
        continue;
      }
      const { created } = await upsertFromZoho(vendorId, toUpsert(bill, status), actorUserId);
      created ? result.added++ : result.updated++;
    } catch (err) {
      result.errors++;
      console.warn(`[zoho] failed on "${bill.billNumber}": ${(err as Error).message}`);
    }
  }

  lastSyncAt = new Date().toISOString();
  lastResult = result;
  await audit({ userId: actorUserId, action: "ZOHO_SYNC", entityType: "ZohoSync", entityId: lastSyncAt, metadata: { ...result } });
  return result;
}

export async function listUnmatched() {
  const rows = await prisma.zohoUnmatchedInvoice.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    zohoId: r.zohoId,
    invoiceNumber: r.invoiceNumber,
    vendorName: r.vendorName,
    zohoVendorId: r.zohoVendorId,
    amount: r.amount,
    status: r.status,
    invoiceDate: r.invoiceDate.toISOString(),
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    viewUrl: r.viewUrl,
  }));
}

export async function assignUnmatched(zohoId: string, vendorId: string, actorUserId: string | null) {
  const row = await prisma.zohoUnmatchedInvoice.findUnique({ where: { zohoId } });
  if (!row) throw new HttpError(404, "Unmatched invoice not found (try syncing again).");
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new HttpError(400, "Vendor not found.");

  // Remember the Zoho-vendor → dashboard-vendor link so future bills auto-match.
  if (row.zohoVendorId && vendor.zohoVendorId !== row.zohoVendorId) {
    const clash = await prisma.vendor.findUnique({ where: { zohoVendorId: row.zohoVendorId } });
    if (!clash) await prisma.vendor.update({ where: { id: vendorId }, data: { zohoVendorId: row.zohoVendorId } });
  }

  await upsertFromZoho(
    vendorId,
    {
      zohoId: row.zohoId,
      invoiceNumber: row.invoiceNumber,
      amount: row.amount,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      status: row.status,
      viewUrl: row.viewUrl,
    },
    actorUserId,
  );
  await prisma.zohoUnmatchedInvoice.delete({ where: { zohoId } });
  await audit({ userId: actorUserId, action: "ZOHO_ASSIGN", entityType: "Invoice", entityId: zohoId, metadata: { vendorId } });
  return { success: true };
}

export async function getStatus() {
  const enabled = process.env.ZOHO_ENABLED === "true";
  const health = enabled ? await healthCheck() : { ok: false, message: "Demo mode (ZOHO_ENABLED=false)." };
  const unmatchedCount = await prisma.zohoUnmatchedInvoice.count();
  return {
    enabled,
    connected: health.ok,
    invoiceSource: invoiceSource(),
    dataCenter: zohoDc(),
    lastSyncAt,
    lastResult,
    unmatchedCount,
    message: health.message,
  };
}

export async function createZohoInvoice(dto: any, actorUserId: string | null) {
  const result = await client.createInvoice(dto);
  await audit({ userId: actorUserId, action: "ZOHO_INVOICE_CREATE", entityType: "ZohoInvoice", entityId: result.zohoId, metadata: { billNumber: result.billNumber, total: result.total } });
  return result;
}

export async function createAndLinkVendor(vendorId: string, actorUserId: string | null) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new HttpError(400, "Vendor not found.");
  if (vendor.zohoVendorId) return { vendorId, zohoVendorId: vendor.zohoVendorId, alreadyLinked: true };

  let created;
  try {
    created = await client.createVendor({ name: vendor.name, email: vendor.email ?? undefined, phone: vendor.phone ?? undefined });
  } catch (err) {
    throw new HttpError(502, `Zoho vendor create failed: ${(err as Error).message}`);
  }
  await prisma.vendor.update({ where: { id: vendorId }, data: { zohoVendorId: created.id } });
  await audit({ userId: actorUserId, action: "ZOHO_VENDOR_CREATE_LINK", entityType: "Vendor", entityId: vendorId, metadata: { zohoVendorId: created.id } });
  return { vendorId, zohoVendorId: created.id, alreadyLinked: false };
}

export async function listZohoVendors() {
  try {
    return await client.listVendors();
  } catch (err) {
    throw new HttpError(502, `Could not list Zoho vendors: ${(err as Error).message}`);
  }
}

export async function getInvoicePdf(zohoId: string): Promise<Buffer> {
  return client.fetchInvoicePdf(zohoId);
}
