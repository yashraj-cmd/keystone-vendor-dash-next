import { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/auth";
import { removeCatalogueItem } from "@/lib/server/catalogues";

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    return removeCatalogueItem(params.itemId, user.userId);
  });
}
