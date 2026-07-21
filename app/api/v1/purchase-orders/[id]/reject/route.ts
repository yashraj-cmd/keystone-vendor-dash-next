import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { rejectPurchaseOrder } from "@/lib/server/purchase-orders";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN");
    const body = await req.json().catch(() => ({}));
    return rejectPurchaseOrder(params.id, body.reason, user.userId);
  });
}
