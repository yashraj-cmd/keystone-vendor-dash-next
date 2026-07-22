import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/auth";
import { verifyOtp } from "@/lib/server/otp";

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "Email and a 6-digit code are required.");
    return verifyOtp(body.data.email, body.data.code);
  });
}
