import { toast } from "sonner";
import { VENDOR_CATEGORIES, VendorCategory, VendorStage } from "@shared";
import { vendorsApi, VendorQuery } from "@/lib/api";
import { apiError } from "@/lib/api-client";
import { SearchableSelect } from "@/components/SearchableSelect";

interface Props {
  query: VendorQuery;
  onQueryChange: (patch: Partial<VendorQuery>) => void;
  onAddVendor: () => void;
  onGeneratePo: () => void;
}

const STAGE_LABELS: Record<VendorStage, string> = {
  IN_TALKS: "In Talks",
  CATALOGUE_RECEIVED: "Catalogue Received",
  PURCHASE_MADE: "Purchase Made",
};

export function Toolbar({ query, onQueryChange, onAddVendor, onGeneratePo }: Props) {
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
      <SearchableSelect
        className="w-[200px]"
        value={query.category ?? ""}
        onChange={(v) => onQueryChange({ category: v as VendorCategory | "" })}
        options={VENDOR_CATEGORIES}
        allowEmpty
        emptyLabel="All Categories"
        placeholder="All Categories"
      />
      <SearchableSelect
        className="w-[180px]"
        value={query.stage ?? ""}
        onChange={(v) => onQueryChange({ stage: v as VendorStage | "" })}
        options={(Object.keys(STAGE_LABELS) as VendorStage[]).map((s) => ({
          value: s,
          label: STAGE_LABELS[s],
        }))}
        allowEmpty
        emptyLabel="All Stages"
        placeholder="All Stages"
      />
      <div className="flex-1" />
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
