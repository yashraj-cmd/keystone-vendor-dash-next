import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireUser, requireRole } from "@/lib/server/auth";
import { listVendors, createVendor } from "@/lib/server/vendors";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireUser(req);
    const sp = req.nextUrl.searchParams;
    const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
    return listVendors({
      search: sp.get("search") ?? undefined,
      stage: sp.get("stage") ?? undefined,
      status: sp.get("status") ?? undefined,
      category: sp.get("category") ?? undefined,
      page: num("page"),
      pageSize: num("pageSize"),
      sortBy: sp.get("sortBy") ?? undefined,
      sortDir: (sp.get("sortDir") as "asc" | "desc") ?? undefined,
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return createVendor(await req.json(), user.userId);
  });
}
