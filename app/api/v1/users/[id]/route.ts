import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { deleteUser } from "@/lib/server/users";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN");
    return deleteUser(params.id, user.userId);
  });
}
