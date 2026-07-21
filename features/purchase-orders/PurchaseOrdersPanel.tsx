import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PurchaseOrderDto, PurchaseOrderStatus } from "@shared";
import { purchaseOrdersApi } from "@/lib/api";
import { apiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/format";

const STATUS_CHIP: Record<PurchaseOrderStatus, string> = {
  PENDING: "bg-keystone-amber/15 text-keystone-amber",
  APPROVED: "bg-keystone-green/10 text-keystone-green",
  REJECTED: "bg-keystone-red/10 text-keystone-red",
};

function inr(n: number) {
  return `₹${(n ?? 0).toLocaleString("en-IN")}`;
}

function PoDetailModal({ po, onClose }: { po: PurchaseOrderDto; onClose: () => void }) {
  const items = po.lineItems ?? [];
  return (
    <Modal title={`Purchase Order — ${po.vendorName ?? "Vendor"}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="label">Status</span>
            <div>
              <span className={`chip ${STATUS_CHIP[po.status]}`}>{po.status.toLowerCase()}</span>
            </div>
          </div>
          <div>
            <span className="label">PO number</span>
            <div>{po.poNumber || "—"}</div>
          </div>
          <div>
            <span className="label">Submitted</span>
            <div>{formatDate(po.createdAt)}</div>
          </div>
          <div>
            <span className="label">In Zoho</span>
            <div>{po.zohoId ? "Yes ✓" : "Not yet"}</div>
          </div>
        </div>

        <div>
          <span className="label">Items</span>
          <div className="overflow-x-auto mt-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 font-medium">HSN</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Price</th>
                  <th className="py-1 font-medium text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-1.5">{li.name}</td>
                    <td className="py-1.5">{li.hsn || "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{li.quantity}</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(li.rate)}</td>
                    <td className="py-1.5 text-right tabular-nums">{inr(li.rate * li.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="py-2 text-right font-semibold">
                    Total
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{inr(po.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {po.status === "REJECTED" && po.decisionReason && (
          <div className="text-sm text-keystone-red">
            <span className="label block">Rejection reason</span>
            {po.decisionReason}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function PurchaseOrdersPanel() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const [viewing, setViewing] = useState<PurchaseOrderDto | null>(null);

  const { data: pos = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => purchaseOrdersApi.list(),
  });

  const pendingCount = pos.filter((p) => p.status === "PENDING").length;

  const approve = useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.approve(id),
    onSuccess: (po) => {
      toast.success(`Approved — created in Zoho as ${po.poNumber || po.zohoId}.`);
      qc.invalidateQueries();
    },
    onError: (err) => toast.error(apiError(err, "Approve failed")),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      purchaseOrdersApi.reject(id, reason),
    onSuccess: () => {
      toast("Purchase order rejected.");
      qc.invalidateQueries();
    },
    onError: (err) => toast.error(apiError(err, "Reject failed")),
  });

  if (pos.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <div className="p-4 border-b border-border flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Purchase Orders</h2>
        <p className="text-xs text-muted">
          {pendingCount} awaiting approval{isAdmin ? "" : " · Admin approves"}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {pos.map((po) => (
          <PoRow
            key={po.id}
            po={po}
            isAdmin={isAdmin}
            onView={() => setViewing(po)}
            onApprove={() => approve.mutate(po.id)}
            onReject={(reason) => reject.mutate({ id: po.id, reason })}
            busy={approve.isPending || reject.isPending}
          />
        ))}
      </ul>
      {viewing && <PoDetailModal po={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function PoRow({
  po,
  isAdmin,
  onView,
  onApprove,
  onReject,
  busy,
}: {
  po: PurchaseOrderDto;
  isAdmin: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const items = po.lineItems ?? [];

  return (
    <li className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{po.vendorName ?? "Vendor"}</span>
            <span className={`chip ${STATUS_CHIP[po.status]}`}>{po.status.toLowerCase()}</span>
            {po.poNumber && <span className="text-xs text-muted">· {po.poNumber}</span>}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {items.length} item(s) · total {inr(po.total)}
            {po.status === "APPROVED" && po.zohoId && <> · in Zoho ✓</>}
          </div>
          <div className="text-xs text-muted mt-1 truncate">
            {items.map((li) => `${li.name}×${li.quantity}`).join(", ")}
          </div>
          {po.status === "REJECTED" && po.decisionReason && (
            <div className="text-xs text-keystone-red mt-1">Rejected: {po.decisionReason}</div>
          )}
        </div>

        {!rejecting && (
          <div className="flex gap-2">
            <button className="btn py-1" onClick={onView}>
              View
            </button>
            {isAdmin && po.status === "PENDING" && (
              <>
                <button className="btn-primary py-1" disabled={busy} onClick={onApprove}>
                  ✓ Approve
                </button>
                <button className="btn-danger py-1" disabled={busy} onClick={() => setRejecting(true)}>
                  ✕ Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isAdmin && po.status === "PENDING" && rejecting && (
        <div className="mt-2 flex gap-2 flex-wrap">
          <input
            className="input py-1 flex-1 min-w-[200px]"
            placeholder="Reason for rejection"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <button
            className="btn-danger py-1"
            disabled={busy}
            onClick={() => {
              onReject(reason.trim() || "No reason given");
              setRejecting(false);
              setReason("");
            }}
          >
            Confirm reject
          </button>
          <button className="btn py-1" onClick={() => setRejecting(false)}>
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}
