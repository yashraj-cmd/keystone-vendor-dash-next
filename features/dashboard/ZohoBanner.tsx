import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { VendorDto, ZohoUnmatchedInvoiceDto } from "@shared";
import { vendorsApi, zohoApi } from "@/lib/api";
import { apiError } from "@/lib/api-client";
import { formatInr } from "@shared";

/**
 * Zoho Books connection strip: live status indicator, a "Sync invoices" button,
 * and the unmatched-invoices assignment flow (PRD §9.1 / §9.2).
 */
export function ZohoBanner() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["zoho", "status"],
    queryFn: zohoApi.status,
    refetchInterval: 60_000,
  });
  const { data: unmatched = [] } = useQuery({
    queryKey: ["zoho", "unmatched"],
    queryFn: zohoApi.unmatched,
  });

  const sync = useMutation({
    mutationFn: zohoApi.sync,
    onSuccess: (r) => {
      toast.success(
        `Zoho sync complete — ${r.added} added, ${r.updated} updated, ${r.unmatched} unmatched.`,
      );
      qc.invalidateQueries();
      if (r.unmatched > 0) setExpanded(true);
    },
    onError: (err) => toast.error(apiError(err, "Sync failed")),
  });

  // Green = connected; amber = needs attention (disabled or unreachable).
  const healthy = status?.connected ?? false;
  const dotClass = healthy ? "bg-keystone-green" : "bg-keystone-amber";
  const title = !status
    ? "Checking connection to Zoho Books…"
    : status.enabled
      ? healthy
        ? "Zoho Books is connected"
        : "Zoho Books needs attention"
      : "Zoho Books — demo mode (no live account connected)";
  const subtitle = !status
    ? ""
    : status.enabled && healthy
      ? `Invoices are pulled in automatically from your Zoho Books account (${status.dataCenter.toUpperCase()}).`
      : status.enabled
        ? status.message || "Couldn't reach Zoho Books — check the connection and try syncing again."
        : "Using sample invoice data until a real Zoho Books account is connected.";

  return (
    <div className="card bg-orange-light border-orange/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} title={title} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-rust-dark">{title}</p>
          <p className="text-xs text-muted">
            {subtitle}{" "}
            {status?.lastSyncAt
              ? `Last synced ${new Date(status.lastSyncAt).toLocaleString("en-IN")}.`
              : "Not synced yet this session."}
          </p>
        </div>
        <button className="btn-primary" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? "Syncing…" : "Sync invoices"}
        </button>
      </div>

      {unmatched.length > 0 && (
        <div className="mt-3 pt-3 border-t border-orange/30">
          <button
            className="text-sm font-medium text-rust-dark"
            onClick={() => setExpanded((v) => !v)}
          >
            {unmatched.length} invoice(s) need to be linked to a vendor {expanded ? "▲" : "▼"}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {unmatched.map((inv) => (
                <UnmatchedRow key={inv.zohoId} inv={inv} onDone={() => qc.invalidateQueries()} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnmatchedRow({
  inv,
  onDone,
}: {
  inv: ZohoUnmatchedInvoiceDto;
  onDone: () => void;
}) {
  const [selectedVendor, setSelectedVendor] = useState("");
  const { data: vendors } = useQuery({
    queryKey: ["vendors", "picker"],
    queryFn: () => vendorsApi.list({ pageSize: 200 }),
  });

  const assign = useMutation({
    mutationFn: () => zohoApi.assign(inv.zohoId, selectedVendor),
    onSuccess: () => {
      toast.success(`Linked "${inv.invoiceNumber}" (${inv.vendorName})`);
      onDone();
    },
    onError: (err) => toast.error(apiError(err, "Assign failed")),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white/80 rounded-keystone p-2">
      <span className="text-xs font-medium flex-1 min-w-0 truncate" title={inv.vendorName}>
        <span className="chip bg-orange text-white mr-2">{inv.invoiceNumber}</span>
        {inv.vendorName} · {formatInr(inv.amount)} · {inv.status}
      </span>
      {inv.viewUrl && (
        <a className="btn py-1" href={inv.viewUrl} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      )}
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
    </div>
  );
}
