import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/features/layout/Header";
import { Footer } from "@/features/layout/Footer";
import { DriveBanner } from "./DriveBanner";
import { ZohoBanner } from "./ZohoBanner";
import { Toolbar } from "./Toolbar";
import { StatCards } from "./StatCards";
import {
  CategoryValueChart,
  InvoiceStatusChart,
  PipelineChart,
  TopVendorsChart,
} from "./Charts";
import { KanbanBoard } from "@/features/pipeline/KanbanBoard";
import { VendorsTable } from "@/features/vendors/VendorsTable";
import { VendorDetailModal } from "@/features/vendors/VendorDetailModal";
import { Modal } from "@/components/Modal";
import { VendorForm } from "@/features/vendors/VendorForm";
import { GeneratePoModal } from "@/features/zoho/GeneratePoModal";
import { PurchaseOrdersPanel } from "@/features/purchase-orders/PurchaseOrdersPanel";
import { QuickActions } from "./QuickActions";
import { CollapsibleSection } from "./CollapsibleSection";
import { dashboardApi, vendorsApi, VendorQuery } from "@/lib/api";

export function DashboardPage() {
  const [query, setQuery] = useState<VendorQuery>({ pageSize: 100 });
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [generatingPo, setGeneratingPo] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardApi.stats,
  });

  const { data: vendorsPage } = useQuery({
    queryKey: ["vendors", query],
    queryFn: () => vendorsApi.list(query),
  });

  const vendors = vendorsPage?.items ?? [];
  const total = vendorsPage?.total ?? 0;

  return (
    <div className="min-h-full flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-6 space-y-5">
        {/* Guided starting point + the two main actions. */}
        <QuickActions
          onAddVendor={() => setCreatingVendor(true)}
          onGeneratePo={() => setGeneratingPo(true)}
          vendorCount={total}
        />

        {/* Key numbers at a glance. */}
        {stats && <StatCards stats={stats} />}

        {/* Anything from Zoho/Drive that needs a person to sort out shows here. */}
        <ZohoBanner />
        <DriveBanner />

        {/* Day-to-day work: approvals, the pipeline, and the vendor list. */}
        <PurchaseOrdersPanel />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Toolbar
              query={query}
              onQueryChange={(p) => setQuery((q) => ({ ...q, ...p }))}
              onAddVendor={() => setCreatingVendor(true)}
              onGeneratePo={() => setGeneratingPo(true)}
            />
          </div>
          <KanbanBoard vendors={vendors} onOpenVendor={setOpenVendorId} />
          <VendorsTable vendors={vendors} total={total} onOpenVendor={setOpenVendorId} />
        </div>

        {/* Charts are useful but not day-to-day — tucked away, collapsed by default. */}
        {stats && (
          <CollapsibleSection title="Insights" subtitle="Charts &amp; analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PipelineChart stats={stats} />
              <CategoryValueChart stats={stats} />
              <InvoiceStatusChart stats={stats} />
              <TopVendorsChart stats={stats} />
            </div>
          </CollapsibleSection>
        )}
      </main>
      <Footer />

      {openVendorId && (
        <VendorDetailModal vendorId={openVendorId} onClose={() => setOpenVendorId(null)} />
      )}
      {creatingVendor && (
        <Modal title="Add Vendor" onClose={() => setCreatingVendor(false)}>
          <VendorForm onClose={() => setCreatingVendor(false)} />
        </Modal>
      )}
      {generatingPo && <GeneratePoModal onClose={() => setGeneratingPo(false)} />}
    </div>
  );
}
