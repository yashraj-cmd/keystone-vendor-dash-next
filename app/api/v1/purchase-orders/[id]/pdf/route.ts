import { NextRequest, NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/server/auth";
import { getPurchaseOrderPdf } from "@/lib/server/purchase-orders";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireUser(req);
    const download = req.nextUrl.searchParams.get("download") === "true";
    const pdf = await getPurchaseOrderPdf(params.id);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="po_${params.id}.pdf"`,
      },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ statusCode: status, message: (err as Error).message }, { status });
  }
}
