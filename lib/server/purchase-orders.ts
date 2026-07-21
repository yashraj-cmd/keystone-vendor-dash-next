import { prisma } from "@/lib/prisma";
import { HttpError } from "./auth";
import { audit } from "./audit";
import { sendMail } from "./mail";
import { createZohoPurchaseOrder } from "./zoho";

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

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Email the member who submitted a PO once it's decided (soft — never throws). */
async function notifyCreator(createdById: string | null, subject: string, text: string) {
  if (!createdById) return;
  const creator = await prisma.user.findUnique({ where: { id: createdById } });
  if (creator?.email) await sendMail({ to: creator.email, subject, text });
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
    await sendMail({
      to: approver,
      subject: `PO approval needed — ${vendor.name} (₹${total.toLocaleString("en-IN")})`,
      text:
        `A new Purchase Order request awaits your approval in the Vendor Dashboard.\n\n` +
        `Vendor: ${vendor.name}\nItems: ${dto.lineItems.length}\nTotal: ₹${total.toLocaleString("en-IN")}\n\n` +
        `Log in to Approve or Reject it:\n${appUrl()}\n`,
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
  await notifyCreator(
    po.createdById,
    `PO approved — ${po.vendor.name} (${result.poNumber})`,
    `Your Purchase Order for ${po.vendor.name} (₹${po.total.toLocaleString("en-IN")}) has been approved` +
      `${result.zohoId ? " and created in Zoho Books" : ""} as ${result.poNumber}.\n\n${appUrl()}\n`,
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
