import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import type { UserRole } from "@shared";

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "7d";

type Payload = { sub: string; email: string; role: UserRole };

export function signAccessToken(u: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: u.id, email: u.email, role: u.role } as Payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  } as jwt.SignOptions);
}

export function signRefreshToken(u: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: u.id, email: u.email, role: u.role } as Payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): Payload {
  return jwt.verify(token, REFRESH_SECRET) as Payload;
}

/** Extract + verify the Bearer access token. Returns null if missing/invalid. */
export function getAuthUser(req: NextRequest): AuthUser | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const p = jwt.verify(token, ACCESS_SECRET) as Payload;
    return { userId: p.sub, email: p.email, role: p.role };
  } catch {
    return null;
  }
}

/** Thrown to signal an HTTP error from deep in a handler; caught by withAuth/handler wrapper. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Require a logged-in user (any role). Throws HttpError(401) otherwise. */
export function requireUser(req: NextRequest): AuthUser {
  const user = getAuthUser(req);
  if (!user) throw new HttpError(401, "Authentication required.");
  return user;
}

/** Require one of the given roles. Throws 401 if not logged in, 403 if wrong role. */
export function requireRole(req: NextRequest, ...roles: UserRole[]): AuthUser {
  const user = requireUser(req);
  if (roles.length && !roles.includes(user.role)) {
    throw new HttpError(403, "You don't have permission to do this.");
  }
  return user;
}
