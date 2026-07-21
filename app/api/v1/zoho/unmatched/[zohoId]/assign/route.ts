import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { assignUnmatched } from "@/lib/server/zoho/service";

export async function POST(req: NextRequest, { params }: { params: { zohoId: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    const body = await req.json().catch(() => ({}));
    return assignUnmatched(params.zohoId, body.vendorId, user.userId);
  });
}
