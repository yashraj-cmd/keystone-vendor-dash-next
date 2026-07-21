import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireUser, requireRole } from "@/lib/server/auth";
import { getVendor, updateVendor, deleteVendor } from "@/lib/server/vendors";

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    requireUser(req);
    return getVendor(params.id);
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return updateVendor(params.id, await req.json(), user.userId);
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN");
    return deleteVendor(params.id, user.userId);
  });
}
