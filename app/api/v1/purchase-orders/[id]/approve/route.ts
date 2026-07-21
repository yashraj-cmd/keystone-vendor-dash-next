import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { approvePurchaseOrder } from "@/lib/server/purchase-orders";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN");
    return approvePurchaseOrder(params.id, user.userId);
  });
}
