import { prisma } from "@/lib/prisma";
import { HttpError } from "./auth";
import { audit } from "./audit";
import { sendMail } from "./mail";
import { createZohoPurchaseOrder } from "./zoho";
import { buildPoPdf } from "./po-pdf";
import { fetchPurchaseOrderPdf } from "./zoho/client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PoLine {
  name: string;
  quantity: number;
  rate: number;
  hsn?: string;
}

function serialize(po: any) {
  return {
    ...po,
    lineItems: po.lineItems ?? [],
    vendorName: po.vendor?.name,
    decidedAt: po.decidedAt ? po.decidedAt.toISOString() : null,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    vendor: undefined,
  };
}

/**
 * PDF for a purchase order. If it's been approved and exists in Zoho, return the
 * official Zoho PO PDF; otherwise generate one from our own data (pending POs).
 */
export async function getPurchaseOrderPdf(id: string): Promise<Buffer> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { vendor: true } });
  if (!po) throw new HttpError(404, "Purchase order not found.");

  if (po.zohoId && process.env.ZOHO_ENABLED === "true") {
    try {
      return await fetchPurchaseOrderPdf(po.zohoId);
    } catch (err) {
      // Fall back to our own rendering if Zoho can't produce it right now.
      console.warn(`[po] Zoho PDF unavailable for ${id}, using generated PDF: ${(err as Error).message}`);
    }
  }

  return buildPoPdf({
    vendorName: po.vendor.name,
    poNumber: po.poNumber,
    createdAt: po.createdAt,
    lineItems: (po.lineItems as any[]) ?? [],
  });
}

/**
 * Base URL used in emails. Prefers an explicit APP_URL, but ignores a localhost
 * value when actually running on Vercel (a common copy-paste from local .env) and
 * falls back to the real deployment URL Vercel injects.
 */
const appUrl = () => {
  const configured = process.env.APP_URL?.trim();
  const onVercel = Boolean(process.env.VERCEL);
  if (configured && !(onVercel && configured.includes("localhost"))) return configured;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:3000";
};

/** Email the member who submitted a PO once it's decided (soft — never throws). */
async function notifyCreator(
  createdById: string | null,
  subject: string,
  text: string,
  attachments?: { filename: string; content: Buffer; contentType?: string }[],
) {
  if (!createdById) return;
  const creator = await prisma.user.findUnique({ where: { id: createdById } });
  if (creator?.email) await sendMail({ to: creator.email, subject, text, attachments });
}

export async function listPurchaseOrders(status?: string) {
  const items = await prisma.purchaseOrder.findMany({
    where: status ? { status: status as any } : {},
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { name: true } } },
  });
  return items.map(serialize);
}

/** Procurement submits — PENDING, nothing sent to Zoho yet. Emails the approver. */
export async function createPurchaseOrder(
  dto: { vendorId: string; poNumber?: string; lineItems: PoLine[] },
  actorUserId: string | null,
) {
  const vendor = await prisma.vendor.findUnique({ where: { id: dto.vendorId } });
  if (!vendor) throw new HttpError(400, "Vendor not found.");

  const total = dto.lineItems.reduce((s, li) => s + (li.rate || 0) * (li.quantity || 0), 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      vendorId: dto.vendorId,
      zohoVendorId: vendor.zohoVendorId,
      status: "PENDING",
      lineItems: dto.lineItems as any,
      total,
      poNumber: dto.poNumber ?? null,
      createdById: actorUserId,
    },
    include: { vendor: { select: { name: true } } },
  });
  await audit({ userId: actorUserId, action: "PO_SUBMIT", entityType: "PurchaseOrder", entityId: po.id, metadata: { vendorId: dto.vendorId, total } });

  const approver = (process.env.PO_APPROVER_EMAIL ?? "").trim();
  if (approver) {
    // Generate the PO as a PDF from our own data so the approver can review the
    // full order before it's approved / created in Zoho. Soft-fail: if the PDF
    // can't be built, still send the email without the attachment.
    let attachments;
    try {
      const pdf = await buildPoPdf({
        vendorName: vendor.name,
        poNumber: po.poNumber,
        createdAt: po.createdAt,
        lineItems: dto.lineItems,
      });
      const fileLabel = (po.poNumber || `PO-${po.id.slice(0, 8)}`).replace(/[^\w.-]/g, "_");
      attachments = [{ filename: `${fileLabel}.pdf`, content: pdf, contentType: "application/pdf" }];
    } catch (err) {
      console.warn(`[po] PDF generation failed for ${po.id}: ${(err as Error).message}`);
    }
    await sendMail({
      to: approver,
      subject: `PO approval needed — ${vendor.name} (₹${total.toLocaleString("en-IN")})`,
      text:
        `A new Purchase Order request awaits your approval in the Vendor Dashboard.\n\n` +
        `Vendor: ${vendor.name}\nItems: ${dto.lineItems.length}\nTotal: ₹${total.toLocaleString("en-IN")}\n\n` +
        `The full purchase order is attached as a PDF for your review.\n\n` +
        `Log in to Approve or Reject it:\n${appUrl()}\n`,
      attachments,
    });
  }
  return serialize(po);
}

/** Admin approves → create in Zoho + email the vendor, mark APPROVED. */
export async function approvePurchaseOrder(id: string, actorUserId: string | null) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { vendor: true } });
  if (!po) throw new HttpError(404, "Purchase order not found.");
  if (po.status !== "PENDING") throw new HttpError(409, `This PO is already ${po.status.toLowerCase()}.`);
  if (!po.vendor.zohoVendorId) {
    throw new HttpError(400, "This vendor isn't linked to Zoho yet. Link it before approving.");
  }

  const lineItems = (po.lineItems as any[]) ?? [];
  let result;
  try {
    result = await createZohoPurchaseOrder({
      zohoVendorId: po.vendor.zohoVendorId,
      poNumber: po.poNumber,
      lineItems,
      emailTo: po.vendor.email ? [po.vendor.email] : undefined,
    });
  } catch (err) {
    throw new HttpError(502, `Zoho rejected the Purchase Order: ${(err as Error).message}`);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "APPROVED",
      zohoId: result.zohoId,
      poNumber: result.poNumber || po.poNumber,
      decidedById: actorUserId,
      decidedAt: new Date(),
      decisionReason: null,
    },
    include: { vendor: { select: { name: true } } },
  });
  await audit({ userId: actorUserId, action: "PO_APPROVE", entityType: "PurchaseOrder", entityId: id, metadata: { zohoId: result.zohoId, poNumber: result.poNumber } });

  // Attach the approved PO PDF (Zoho's if available, else our generated one) to the
  // creator's approval email. Soft-fail: still send the message if the PDF can't load.
  let attachments;
  try {
    const pdf = await getPurchaseOrderPdf(id);
    const label = (result.poNumber || po.poNumber || `PO-${id.slice(0, 8)}`).replace(/[^\w.-]/g, "_");
    attachments = [{ filename: `${label}.pdf`, content: pdf, contentType: "application/pdf" }];
  } catch (err) {
    console.warn(`[po] approved PDF unavailable for ${id}: ${(err as Error).message}`);
  }
  await notifyCreator(
    po.createdById,
    `✅ PO approved — ${po.vendor.name} (${result.poNumber})`,
    `Good news — your Purchase Order has been APPROVED.\n\n` +
      `Vendor: ${po.vendor.name}\n` +
      `PO number: ${result.poNumber}\n` +
      `Total: ₹${po.total.toLocaleString("en-IN")}\n` +
      `${result.zohoId ? "It has been created in Zoho Books.\n" : ""}` +
      `\nThe approved purchase order is attached as a PDF.\n\n${appUrl()}\n`,
    attachments,
  );
  return serialize(updated);
}

/** Admin rejects → REJECTED with a reason; nothing goes to Zoho. */
export async function rejectPurchaseOrder(id: string, reason: string | undefined, actorUserId: string | null) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new HttpError(404, "Purchase order not found.");
  if (po.status !== "PENDING") throw new HttpError(409, `This PO is already ${po.status.toLowerCase()}.`);

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "REJECTED",
      decisionReason: reason || "No reason given",
      decidedById: actorUserId,
      decidedAt: new Date(),
    },
    include: { vendor: { select: { name: true } } },
  });
  await audit({ userId: actorUserId, action: "PO_REJECT", entityType: "PurchaseOrder", entityId: id, metadata: { reason } });
  await notifyCreator(
    po.createdById,
    `PO rejected — ${updated.vendor.name}`,
    `Your Purchase Order for ${updated.vendor.name} (₹${po.total.toLocaleString("en-IN")}) was rejected.\n\n` +
      `Reason: ${updated.decisionReason}\n\nReview or resubmit it:\n${appUrl()}\n`,
  );
  return serialize(updated);
}
