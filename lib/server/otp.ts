import { randomInt } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { HttpError, signAccessToken, signRefreshToken } from "./auth";
import { publicUser } from "./users";
import { sendMail } from "./mail";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** 6-digit numeric code as a zero-padded string (crypto for unbiased randomness). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Case-insensitive lookup so "Shlok@..." matches "shlok@...". */
function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

/**
 * Request a login code. Only provisioned users get one; unknown emails get the
 * same generic response (no enumeration) and nothing is sent.
 */
export async function requestOtp(rawEmail: string): Promise<{ sent: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (!user) return { sent: true }; // generic — reveal nothing

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  // one active code per email
  await prisma.loginOtp.deleteMany({ where: { email } });
  await prisma.loginOtp.create({
    data: { email, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  await sendMail({
    to: user.email,
    subject: `Your Keystone login code: ${code}`,
    text:
      `Hi ${user.name || "there"},\n\n` +
      `Your login code for the Keystone Vendor Dashboard is:\n\n    ${code}\n\n` +
      `It expires in 10 minutes. If you didn't request this, you can ignore this email.\n`,
  });
  return { sent: true };
}

/** Verify a code and, on success, issue a JWT session (same shape as password login). */
export async function verifyOtp(rawEmail: string, rawCode: string) {
  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.trim();

  const otp = await prisma.loginOtp.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new HttpError(400, "No code was requested for this email. Request a new one.");
  if (otp.expiresAt < new Date()) {
    await prisma.loginOtp.deleteMany({ where: { email } });
    throw new HttpError(400, "This code has expired. Request a new one.");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.loginOtp.deleteMany({ where: { email } });
    throw new HttpError(429, "Too many incorrect attempts. Request a new code.");
  }

  const ok = await bcrypt.compare(code, otp.codeHash);
  if (!ok) {
    await prisma.loginOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(401, "Incorrect code. Please try again.");
  }

  // consume the code
  await prisma.loginOtp.deleteMany({ where: { email } });

  const user = await findUserByEmail(email);
  if (!user) throw new HttpError(401, "Account not found."); // safety (shouldn't happen)

  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    user: publicUser(user),
  };
}
