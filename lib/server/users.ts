import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import type { UserDto, UserRole } from "@shared";
import { prisma } from "@/lib/prisma";
import { HttpError } from "./auth";
import { audit } from "./audit";

export function publicUser(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/** All team members, newest first. */
export async function listUsers(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(publicUser);
}

/**
 * Provision a team member for passwordless (OTP) login. No password is set —
 * they sign in with an emailed code. Email is stored lowercase and must be unique.
 */
export async function createTeamMember(
  input: { email: string; name?: string; role: UserRole },
  actorUserId: string | null,
): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) throw new HttpError(409, "A member with this email already exists.");

  // Random, unusable password hash — this account logs in via OTP only.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
  const name = (input.name?.trim() || email.split("@")[0]) as string;

  const user = await prisma.user.create({
    data: { email, name, role: input.role, passwordHash },
  });
  await audit({
    userId: actorUserId,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    metadata: { email, role: input.role },
  });
  return publicUser(user);
}

/** Remove a team member. Can't remove yourself, and can't remove the last admin. */
export async function deleteUser(id: string, actorUserId: string | null): Promise<{ success: true }> {
  if (id === actorUserId) throw new HttpError(400, "You can't remove your own account.");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "Member not found.");

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) throw new HttpError(400, "Can't remove the only admin.");
  }

  await prisma.user.delete({ where: { id } });
  await audit({
    userId: actorUserId,
    action: "USER_DELETE",
    entityType: "User",
    entityId: id,
    metadata: { email: target.email },
  });
  return { success: true };
}
