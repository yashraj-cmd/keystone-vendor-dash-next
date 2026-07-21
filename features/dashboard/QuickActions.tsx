import { useAuthStore } from "@/lib/auth-store";

interface Props {
  onAddVendor: () => void;
  onGeneratePo: () => void;
  vendorCount: number;
}

/**
 * Friendly "what do you want to do?" panel shown at the top of the dashboard.
 * Gives procurement a clear starting point and a plain-language 3-step overview
 * instead of dropping them straight into charts and tables.
 */
export function QuickActions({ onAddVendor, onGeneratePo, vendorCount }: Props) {
  const firstName = (useAuthStore((s) => s.user?.name) ?? "there").split(" ")[0];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Hi {firstName} 👋</h2>
          <p className="text-sm text-muted mt-0.5">
            Add your vendors, keep their catalogues in one place, and raise purchase orders for
            approval — all from here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={onGeneratePo}>
            Raise Purchase Order
          </button>
          <button className="btn-primary" onClick={onAddVendor}>
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Plain-language 3-step overview of how the tool works. */}
      <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Step
          n={1}
          title="Add a vendor"
          body="Create the vendor with their contact and category details."
          done={vendorCount > 0}
        />
        <Step
          n={2}
          title="Attach a catalogue"
          body="Open the vendor and add their price list (upload or type it in)."
        />
        <Step
          n={3}
          title="Raise a purchase order"
          body="Send it for the admin to approve — you'll get an email either way."
        />
      </ol>
    </section>
  );
}

function Step({ n, title, body, done }: { n: number; title: string; body: string; done?: boolean }) {
  return (
    <li className="flex gap-3 rounded-keystone border border-border bg-orange-light/30 p-3">
      <span
        className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-sm font-bold ${
          done ? "bg-keystone-green text-white" : "bg-orange text-white"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted mt-0.5">{body}</div>
      </div>
    </li>
  );
}
