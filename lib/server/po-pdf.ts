import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PoPdfLine {
  name: string;
  quantity: number;
  rate: number;
  hsn?: string;
}

export interface PoPdfInput {
  vendorName: string;
  poNumber?: string | null;
  createdAt?: Date;
  lineItems: PoPdfLine[];
}

const inr = (n: number) => "Rs. " + (n ?? 0).toLocaleString("en-IN");

/**
 * Build a simple, self-contained Purchase Order PDF from our own data (used for
 * the approver's email before the PO exists in Zoho). Pure pdf-lib — no fonts on
 * disk, so it runs fine on serverless.
 */
export async function buildPoPdf(input: PoPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 in points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const orange = rgb(0.95, 0.5, 0.2);
  const ink = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.85, 0.85, 0.85);

  const M = 48; // margin
  let y = 842 - M;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: typeof ink } = {},
  ) => page.drawText(s, { x, y: yy, size: opts.size ?? 10, font: opts.font ?? font, color: opts.color ?? ink });

  // Header
  text("KEYSTONE COMMERCE", M, y, { size: 10, font: bold, color: orange });
  text("PURCHASE ORDER", 595 - M - bold.widthOfTextAtSize("PURCHASE ORDER", 18), y - 4, {
    size: 18,
    font: bold,
    color: ink,
  });
  y -= 24;
  text("Vendor Dashboard", M, y, { size: 9, color: muted });
  y -= 30;

  // Meta
  const created = input.createdAt ?? new Date();
  text(`PO Number: ${input.poNumber || "(assigned on approval)"}`, M, y, { font: bold });
  text(`Date: ${created.toLocaleDateString("en-IN")}`, 595 - M - 140, y, { color: muted });
  y -= 16;
  text(`Vendor: ${input.vendorName}`, M, y, { font: bold });
  y -= 14;
  text("Status: PENDING APPROVAL", M, y, { size: 9, color: orange });
  y -= 28;

  // Table header
  const cols = { name: M, hsn: 300, qty: 370, rate: 430, total: 505 };
  page.drawRectangle({ x: M - 6, y: y - 4, width: 595 - 2 * M + 12, height: 20, color: rgb(0.98, 0.93, 0.87) });
  text("Product", cols.name, y, { size: 9, font: bold });
  text("HSN", cols.hsn, y, { size: 9, font: bold });
  text("Qty", cols.qty, y, { size: 9, font: bold });
  text("Rate", cols.rate, y, { size: 9, font: bold });
  text("Amount", cols.total, y, { size: 9, font: bold });
  y -= 20;

  // Rows
  let total = 0;
  for (const li of input.lineItems) {
    const amt = (li.rate || 0) * (li.quantity || 0);
    total += amt;
    const nameLine = li.name.length > 45 ? li.name.slice(0, 44) + "…" : li.name;
    text(nameLine, cols.name, y);
    text(li.hsn || "-", cols.hsn, y, { color: muted });
    text(String(li.quantity), cols.qty, y);
    text(inr(li.rate), cols.rate, y);
    text(inr(amt), cols.total, y);
    y -= 16;
    page.drawLine({ start: { x: M - 6, y: y + 4 }, end: { x: 595 - M + 6, y: y + 4 }, thickness: 0.5, color: line });
  }

  // Total
  y -= 10;
  text("Total", cols.rate, y, { font: bold });
  text(inr(total), cols.total, y, { font: bold, color: orange });

  // Footer
  text(
    "This purchase order is pending internal approval. It becomes final once approved and recorded in Zoho Books.",
    M,
    50,
    { size: 8, color: muted },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
