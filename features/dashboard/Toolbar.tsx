import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  VENDOR_CATEGORY_LABELS,
  VENDOR_STAGE_LABELS,
  VendorCategory,
  VendorStage,
} from "@shared";
import { driveApi, vendorsApi, VendorQuery } from "@/lib/api";
import { apiError } from "@/lib/api-client";

interface Props {
  query: VendorQuery;
  onQueryChange: (patch: Partial<VendorQuery>) => void;
  onAddVendor: () => void;
  onGeneratePo: () => void;
}

export function Toolbar({ query, onQueryChange, onAddVendor, onGeneratePo }: Props) {
  const qc = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: () => driveApi.sync(),
    onSuccess: (res) => {
      toast.success(
        `Sync done — attached ${res.attached}, unassigned ${res.unassigned}, skipped ${res.skipped}.`,
      );
      qc.invalidateQueries();
    },
    onError: (err) => toast.error(apiError(err, "Drive sync failed")),
  });

  async function onExport() {
    try {
      const csv = await vendorsApi.exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiError(err, "Export failed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        className="input max-w-xs"
        placeholder="Search name, contact, email…"
        value={query.search ?? ""}
        onChange={(e) => onQueryChange({ search: e.target.value })}
      />
      <select
        className="input max-w-[180px]"
        value={query.category ?? ""}
        onChange={(e) => onQueryChange({ category: (e.target.value || "") as VendorCategory | "" })}
      >
        <option value="">All Categories</option>
        {(Object.keys(VENDOR_CATEGORY_LABELS) as VendorCategory[]).map((c) => (
          <option key={c} value={c}>
            {VENDOR_CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <select
        className="input max-w-[180px]"
        value={query.stage ?? ""}
        onChange={(e) => onQueryChange({ stage: (e.target.value || "") as VendorStage | "" })}
      >
        <option value="">All Stages</option>
        {(Object.keys(VENDOR_STAGE_LABELS) as VendorStage[]).map((s) => (
          <option key={s} value={s}>
            {VENDOR_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      <div className="flex-1" />
      <button className="btn" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
        ⟳ {syncMutation.isPending ? "Syncing…" : "Sync Drive"}
      </button>
      <button className="btn" onClick={onExport}>
        Export CSV
      </button>
      <button className="btn" onClick={onGeneratePo}>
        Generate PO
      </button>
      <button className="btn-primary" onClick={onAddVendor}>
        + Add Vendor
      </button>
    </div>
  );
}
