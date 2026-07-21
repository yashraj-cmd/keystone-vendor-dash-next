import { DocumentSource, InvoiceStatus } from "@shared";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./auth";
import { audit } from "./audit";
import { autoAdvanceOnDocumentAttach } from "./stage-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */

function serialize(i: any) {
  return {
    ...i,
    invoiceDate: i.invoiceDate.toISOString(),
    dueDate: i.dueDate ? i.dueDate.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export async function listInvoices(query: {
  vendorId?: string;
  status?: InvoiceStatus;
  source?: DocumentSource;
  page?: number;
  pageSize?: number;
}) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 50, 200);
  const where = {
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { vendor: { select: { id: true, name: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { items: items.map(serialize), total, page, pageSize };
}

export async function attachInvoice(vendorId: string, dto: any, actorUserId: string | null) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw new HttpError(404, "Vendor not found.");
  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        vendorId,
        invoiceNumber: dto.invoiceNumber,
        amount: dto.amount,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
        status: dto.status ?? InvoiceStatus.UNPAID,
        source: DocumentSource.MANUAL_UPLOAD,
      },
    });
    await autoAdvanceOnDocumentAttach(vendorId, "invoice", actorUserId, tx);
    await tx.auditLog.create({
      data: { userId: actorUserId, action: "INVOICE_ATTACH", entityType: "Invoice", entityId: created.id, metadata: { vendorId } },
    });
    return created;
  });
  return serialize(invoice);
}

export async function updateInvoice(id: string, dto: any, actorUserId: string | null) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Invoice not found.");
  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      invoiceNumber: dto.invoiceNumber,
      amount: dto.amount,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
      status: dto.status,
    },
  });
  await audit({ userId: actorUserId, action: "INVOICE_UPDATE", entityType: "Invoice", entityId: id, metadata: { fields: Object.keys(dto) } });
  return serialize(invoice);
}

export async function removeInvoice(id: string, actorUserId: string | null) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Invoice not found.");
  await prisma.invoice.delete({ where: { id } });
  await audit({ userId: actorUserId, action: "INVOICE_DELETE", entityType: "Invoice", entityId: id, metadata: { vendorId: existing.vendorId } });
  return { success: true };
}

export interface ZohoInvoiceUpsert {
  zohoId: string;
  invoiceNumber: string;
  amount: number;
  invoiceDate: Date;
  dueDate: Date | null;
  status: InvoiceStatus;
  viewUrl: string | null;
}

/** Idempotent upsert of a Zoho-sourced invoice, keyed on zohoId. Returns whether it was created. */
export async function upsertFromZoho(
  vendorId: string,
  data: ZohoInvoiceUpsert,
  actorUserId: string | null,
): Promise<{ created: boolean }> {
  const existing = await prisma.invoice.findUnique({ where: { zohoId: data.zohoId } });
  if (existing) {
    await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        status: data.status,
        viewUrl: data.viewUrl ?? undefined,
      },
    });
    return { created: false };
  }
  await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        vendorId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        status: data.status,
        zohoId: data.zohoId,
        viewUrl: data.viewUrl,
        source: DocumentSource.ZOHO_SYNC,
      },
    });
    await autoAdvanceOnDocumentAttach(vendorId, "invoice", actorUserId, tx);
    await tx.auditLog.create({
      data: { userId: actorUserId, action: "INVOICE_ZOHO_CREATE", entityType: "Invoice", entityId: created.id, metadata: { vendorId, zohoId: data.zohoId } },
    });
  });
  return { created: true };
}
