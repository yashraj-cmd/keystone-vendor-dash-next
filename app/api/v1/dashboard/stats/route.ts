import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { dashboardStats } from "@/lib/server/dashboard";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireUser(req);
    return dashboardStats();
  });
}
