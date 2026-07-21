import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { listUnassigned } from "@/lib/server/drive/service";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireUser(req);
    return listUnassigned();
  });
}
