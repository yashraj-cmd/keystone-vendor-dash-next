import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { assignUnassigned } from "@/lib/server/drive/service";

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    const body = await req.json().catch(() => ({}));
    return assignUnassigned(params.fileId, body.vendorId, user.userId);
  });
}
