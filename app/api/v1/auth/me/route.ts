import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/server/http";
import { HttpError, requireUser } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = requireUser(req);
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) throw new HttpError(401, "User no longer exists.");
    return publicUser(user);
  });
}
