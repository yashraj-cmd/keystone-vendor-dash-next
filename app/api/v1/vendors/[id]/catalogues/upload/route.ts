import { NextRequest } from "next/server";
import { DocumentSource } from "@shared";
import { handle } from "@/lib/server/http";
import { requireRole, HttpError } from "@/lib/server/auth";
import { prisma } from "@/lib/prisma";
import { uploadOnBehalfOfVendor } from "@/lib/server/drive/service";
import { attachCatalogue } from "@/lib/server/catalogues";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/** Upload a catalogue file to Google Drive and attach it to the vendor. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = requireRole(req, "ADMIN", "PROCUREMENT_MEMBER");
    const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
    if (!vendor) throw new HttpError(404, "Vendor not found.");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Please choose a file to upload.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File is too large (max 15 MB).");

    const title = String(form.get("title") ?? "").trim();
    const rename = String(form.get("filename") ?? "").trim();

    // Respect the user's chosen name; keep the original extension if they left it off.
    const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
    const originalFilename = rename
      ? /\.[a-z0-9]+$/i.test(rename)
        ? rename
        : rename + ext
      : file.name;

    const data = Buffer.from(await file.arrayBuffer());
    let uploaded;
    try {
      uploaded = await uploadOnBehalfOfVendor({
        vendorName: vendor.name,
        kind: "catalogue",
        uploadedAt: new Date(),
        originalFilename,
        mimeType: file.type || "application/octet-stream",
        data,
      });
    } catch (err) {
      const msg = (err as Error).message || "";
      if (/permission/i.test(msg)) {
        throw new HttpError(
          502,
          "Google Drive denied the upload. The Drive folder must be shared with the service account as an Editor.",
        );
      }
      throw new HttpError(502, `Drive upload failed: ${msg}`);
    }

    return attachCatalogue(
      params.id,
      {
        title: title || rename || file.name,
        driveFileId: uploaded.fileId,
        viewUrl: uploaded.webViewLink || undefined,
      },
      user.userId,
      DocumentSource.DRIVE_SYNC,
    );
  });
}
