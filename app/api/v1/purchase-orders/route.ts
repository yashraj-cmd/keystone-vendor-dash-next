import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireUser, requireRole } from "@/lib/server/auth";
import { listPurchaseOrders, createPurchaseOrder } from "@/lib/server/purchase-orders";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireUser(req);
    return listPurchaseOrders(req.nextUrl.searchParams.get("status") ?? undefined);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return createPurchaseOrder(await req.json(), user.userId);
  });
}
