import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { createZohoInvoice } from "@/lib/server/zoho/service";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return createZohoInvoice(await req.json(), user.userId);
  });
}
