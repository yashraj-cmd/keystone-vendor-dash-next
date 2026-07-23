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

  // Right-aligned text (numeric columns line up on their right edge).
  const rtext = (
    s: string,
    rightX: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: typeof ink } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    page.drawText(s, {
      x: rightX - f.widthOfTextAtSize(s, size),
      y: yy,
      size,
      font: f,
      color: opts.color ?? ink,
    });
  };

  // Column geometry: left edges for text columns, right edges for numbers.
  const nameX = M;
  const hsnX = 296;
  const qtyR = 388;
  const rateR = 468;
  const amtR = 595 - M; // 547 — right content edge

  // Table header band
  page.drawRectangle({
    x: M - 6,
    y: y - 5,
    width: 595 - 2 * M + 12,
    height: 20,
    color: rgb(0.98, 0.93, 0.87),
  });
  text("Product", nameX, y, { size: 9, font: bold });
  text("HSN", hsnX, y, { size: 9, font: bold });
  rtext("Qty", qtyR, y, { size: 9, font: bold });
  rtext("Rate", rateR, y, { size: 9, font: bold });
  rtext("Amount", amtR, y, { size: 9, font: bold });
  y -= 22;

  // Rows
  let total = 0;
  for (const li of input.lineItems) {
    const amt = (li.rate || 0) * (li.quantity || 0);
    total += amt;
    const nameLine = li.name.length > 40 ? li.name.slice(0, 39) + "…" : li.name;
    text(nameLine, nameX, y);
    text(li.hsn || "-", hsnX, y, { color: muted });
    rtext(String(li.quantity), qtyR, y);
    rtext(inr(li.rate), rateR, y);
    rtext(inr(amt), amtR, y);
    y -= 9;
    page.drawLine({
      start: { x: M - 6, y },
      end: { x: 595 - M + 6, y },
      thickness: 0.5,
      color: line,
    });
    y -= 11;
  }

  // Total
  y -= 6;
  rtext("Total", rateR, y, { font: bold });
  rtext(inr(total), amtR, y, { font: bold, color: orange });

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
