import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { VendorDto } from "@shared";
import { driveApi, UnassignedFile, vendorsApi } from "@/lib/api";
import { apiError } from "@/lib/api-client";

export function DriveBanner() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["drive", "status"],
    queryFn: driveApi.status,
  });
  const { data: unassigned = [] } = useQuery({
    queryKey: ["drive", "unassigned"],
    queryFn: driveApi.unassigned,
  });

  const dotClass = status?.enabled ? "bg-keystone-green" : "bg-keystone-amber";
  const title = !status
    ? "Checking Google Drive…"
    : status.enabled
      ? "Google Drive is connected"
      : "Google Drive — demo mode (no live folder connected)";

  return (
    <div className="card bg-orange-light border-orange/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} title={title} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-rust-dark">{title}</p>
          <p className="text-xs text-muted">
            Drop a vendor's catalogue in the Drive folder, named{" "}
            <span className="font-mono">"Vendor Name - Catalogue - …"</span>, and it links to that
            vendor automatically. (Invoices come from Zoho or manual entry, not Drive.)
          </p>
        </div>
        {status?.folderUrl && (
          <a
            className="text-orange-deep font-semibold text-sm whitespace-nowrap"
            href={status.folderUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open Drive folder ↗
          </a>
        )}
      </div>
      {unassigned.length > 0 && (
        <div className="mt-3 pt-3 border-t border-orange/30">
          <button
            className="text-sm font-medium text-rust-dark"
            onClick={() => setExpanded((v) => !v)}
          >
            {unassigned.length} catalogue file(s) need to be linked to a vendor{" "}
            {expanded ? "▲" : "▼"}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {unassigned.map((f) => (
                <UnassignedRow key={f.fileId} file={f} onDone={() => qc.invalidateQueries()} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnassignedRow({ file, onDone }: { file: UnassignedFile; onDone: () => void }) {
  const [selectedVendor, setSelectedVendor] = useState("");
  const { data: vendors } = useQuery({
    queryKey: ["vendors", "picker"],
    queryFn: () => vendorsApi.list({ pageSize: 200 }),
  });

  const assign = useMutation({
    mutationFn: () => driveApi.assign(file.fileId, selectedVendor),
    onSuccess: () => {
      toast.success(`Assigned "${file.name}"`);
      onDone();
    },
    onError: (err) => toast.error(apiError(err, "Assign failed")),
  });

  const ignore = useMutation({
    mutationFn: () => driveApi.ignore(file.fileId),
    onSuccess: () => {
      toast(`Ignored "${file.name}"`);
      onDone();
    },
    onError: (err) => toast.error(apiError(err, "Ignore failed")),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white/80 rounded-keystone p-2">
      <span className="text-xs font-medium flex-1 min-w-0 truncate" title={file.name}>
        <span className="chip bg-orange text-white mr-2">{file.kind}</span>
        {file.name}
      </span>
      <select
        className="input max-w-[220px] py-1"
        value={selectedVendor}
        onChange={(e) => setSelectedVendor(e.target.value)}
      >
        <option value="">Assign to vendor…</option>
        {vendors?.items.map((v: VendorDto) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <button
        className="btn py-1"
        disabled={!selectedVendor || assign.isPending}
        onClick={() => assign.mutate()}
      >
        Assign
      </button>
      <button className="btn py-1" disabled={ignore.isPending} onClick={() => ignore.mutate()}>
        Ignore
      </button>
    </div>
  );
}
