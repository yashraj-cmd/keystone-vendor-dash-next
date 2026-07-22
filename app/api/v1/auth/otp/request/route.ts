import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/server/http";
import { HttpError } from "@/lib/server/auth";
import { requestOtp } from "@/lib/server/otp";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = schema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new HttpError(400, "A valid email is required.");
    return requestOtp(body.data.email);
  });
}
