import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { runSync } from "@/lib/server/zoho/service";

// Sync can take a while against the live Zoho API.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return runSync(user.userId);
  });
}
