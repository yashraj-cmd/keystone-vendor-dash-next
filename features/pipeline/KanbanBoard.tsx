import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  VENDOR_CATEGORY_LABELS,
  VENDOR_STAGE_HINTS,
  VENDOR_STAGE_LABELS,
  VendorDto,
  VendorStage,
} from "@shared";
import { vendorsApi } from "@/lib/api";
import { apiError } from "@/lib/api-client";
import { formatInr } from "@/lib/format";

interface Props {
  vendors: VendorDto[];
  onOpenVendor: (id: string) => void;
}

const STAGES: VendorStage[] = ["IN_TALKS", "CATALOGUE_RECEIVED", "PURCHASE_MADE"];

export function KanbanBoard({ vendors, onOpenVendor }: Props) {
  const grouped: Record<VendorStage, VendorDto[]> = {
    IN_TALKS: [],
    CATALOGUE_RECEIVED: [],
    PURCHASE_MADE: [],
  };
  for (const v of vendors) grouped[v.stage].push(v);

  const hasAny = vendors.length > 0;

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-lg font-bold">Vendor Progress</h2>
        <p className="text-xs text-muted">Where each vendor is in the process</p>
      </div>
      <p className="text-xs text-muted mb-3">
        Vendors move left → right: <b>In Discussion</b> → <b>Catalogue Received</b> →{" "}
        <b>Purchased</b>. Click a card to open the vendor; use the buttons to move them along.
      </p>
      {!hasAny ? (
        <div className="card p-8 text-center text-sm text-muted">
          No vendors yet. Click <b>“+ Add Vendor”</b> above to add your first one — it’ll appear
          here under <b>In Discussion</b>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              vendors={grouped[stage]}
              onOpenVendor={onOpenVendor}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Column({
  stage,
  vendors,
  onOpenVendor,
}: {
  stage: VendorStage;
  vendors: VendorDto[];
  onOpenVendor: (id: string) => void;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1 px-1">
        <h3 className="font-semibold" title={VENDOR_STAGE_HINTS[stage]}>
          {VENDOR_STAGE_LABELS[stage]}
        </h3>
        <span className="chip bg-orange-light text-orange-deep">{vendors.length}</span>
      </div>
      <p className="text-[11px] text-muted mb-2 px-1">{VENDOR_STAGE_HINTS[stage]}</p>
      <div className="space-y-2">
        {vendors.length === 0 && (
          <div className="text-xs text-muted p-4 text-center border border-dashed border-border rounded-keystone">
            No vendors in this stage.
          </div>
        )}
        {vendors.map((v) => (
          <KanbanCard key={v.id} vendor={v} onOpenVendor={onOpenVendor} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  vendor,
  onOpenVendor,
}: {
  vendor: VendorDto;
  onOpenVendor: (id: string) => void;
}) {
  const qc = useQueryClient();

  const move = useMutation({
    mutationFn: (direction: "advance" | "back") => vendorsApi.transition(vendor.id, { direction }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(apiError(err, "Stage change blocked")),
  });

  const canBack = vendor.stage !== "IN_TALKS";
  const canAdvance = vendor.stage !== "PURCHASE_MADE";

  return (
    <div
      className="bg-orange-light/40 hover:bg-orange-light border border-border rounded-keystone p-3 cursor-pointer transition-colors"
      onClick={() => onOpenVendor(vendor.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{vendor.name}</div>
          <div className="text-xs text-muted">{VENDOR_CATEGORY_LABELS[vendor.category]}</div>
        </div>
        <div className="text-sm font-semibold whitespace-nowrap">
          {formatInr(vendor.contractValue)}
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-xs">
        <span className="text-keystone-blue font-medium">
          {vendor.catalogueCount ?? 0} catalogue(s)
        </span>
        <span className="text-keystone-green font-medium">
          {vendor.invoiceCount ?? 0} invoice(s)
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        {canBack && (
          <button
            className="btn flex-1 py-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              move.mutate("back");
            }}
            disabled={move.isPending}
          >
            ← Back
          </button>
        )}
        {canAdvance && (
          <button
            className="btn-primary flex-1 py-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              move.mutate("advance");
            }}
            disabled={move.isPending}
          >
            Advance →
          </button>
        )}
      </div>
    </div>
  );
}
