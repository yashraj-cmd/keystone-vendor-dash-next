import { NextRequest } from "next/server";
import * as bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/server/http";
import { HttpError, signAccessToken, signRefreshToken } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/users";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = loginSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "Email and password are required.");

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password.");
    }
    return {
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      user: publicUser(user),
    };
  });
}
