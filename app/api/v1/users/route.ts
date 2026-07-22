import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/server/http";
import { requireRole, HttpError } from "@/lib/server/auth";
import { listUsers, createTeamMember } from "@/lib/server/users";

export async function GET(req: NextRequest) {
  return handle(async () => {
    requireRole(req, "ADMIN");
    return listUsers();
  });
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "PROCUREMENT_MEMBER", "VIEWER"]),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN");
    const body = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "Email and a valid role are required.");
    return createTeamMember(body.data, user.userId);
  });
}
