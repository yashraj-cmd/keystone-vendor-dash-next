import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/server/http";
import {
  HttpError,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "refreshToken is required.");

    let payload;
    try {
      payload = verifyRefreshToken(body.data.refreshToken);
    } catch {
      throw new HttpError(401, "Invalid or expired refresh token.");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, "User no longer exists.");

    return {
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      user: publicUser(user),
    };
  });
}
