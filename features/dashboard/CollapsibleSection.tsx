import { ReactNode, useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A titled section that can be shown/hidden — used to tuck analytics away by default. */
export function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button
        className="w-full p-4 flex items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-3">
          <span className="text-lg font-bold">{title}</span>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </span>
        <span className="text-muted text-sm">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
