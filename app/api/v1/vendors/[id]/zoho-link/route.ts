import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { setZohoLink } from "@/lib/server/vendors";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    const body = await req.json().catch(() => ({}));
    return setZohoLink(params.id, body.zohoVendorId ?? null, user.userId);
  });
}
