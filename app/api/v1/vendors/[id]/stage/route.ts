import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { transitionStage } from "@/lib/server/stage-engine";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    const body = await req.json().catch(() => ({}));
    return transitionStage(params.id, body, user.userId);
  });
}
