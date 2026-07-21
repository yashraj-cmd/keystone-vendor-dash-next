import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { ignoreUnassigned } from "@/lib/server/drive/service";

export async function POST(req: NextRequest, { params }: { params: { fileId: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return ignoreUnassigned(params.fileId, user.userId);
  });
}
