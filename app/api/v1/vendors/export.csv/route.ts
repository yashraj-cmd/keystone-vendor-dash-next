import { NextRequest, NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/server/auth";
import { vendorsCsv } from "@/lib/server/vendors";

export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    const csv = await vendorsCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vendors.csv"`,
      },
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ statusCode: status, message: (err as Error).message }, { status });
  }
}
