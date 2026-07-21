import { InvoiceStatus, VendorStage } from "@shared";
import { prisma } from "@/lib/prisma";

export async function dashboardStats() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalVendors,
    pipelineByStage,
    contractValueByCategory,
    totalContractValueAgg,
    paidInvoicesAgg,
    outstandingInvoicesAgg,
    invoiceStatusCounts,
    contractsExpiring,
    topVendors,
    totalInvoices,
  ] = await prisma.$transaction([
    prisma.vendor.count(),
    prisma.vendor.groupBy({ by: ["stage"], _count: { _all: true }, orderBy: { stage: "asc" } }),
    prisma.vendor.groupBy({ by: ["category"], _sum: { contractValue: true }, orderBy: { category: "asc" } }),
    prisma.vendor.aggregate({ _sum: { contractValue: true } }),
    prisma.invoice.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { status: InvoiceStatus.PAID } }),
    prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } } }),
    prisma.invoice.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.vendor.count({ where: { contractEnd: { gte: now, lte: in30Days } } }),
    prisma.vendor.findMany({ orderBy: { contractValue: "desc" }, take: 5, select: { id: true, name: true, contractValue: true } }),
    prisma.invoice.count(),
  ]);

  const pipeline: Record<VendorStage, number> = { IN_TALKS: 0, CATALOGUE_RECEIVED: 0, PURCHASE_MADE: 0 };
  for (const row of pipelineByStage) {
    const c = row._count as { _all: number } | undefined;
    pipeline[row.stage as VendorStage] = c?._all ?? 0;
  }
  const invoiceStatus: Record<InvoiceStatus, number> = { PAID: 0, UNPAID: 0, OVERDUE: 0 };
  for (const row of invoiceStatusCounts) {
    const c = row._count as { _all: number } | undefined;
    invoiceStatus[row.status as InvoiceStatus] = c?._all ?? 0;
  }

  return {
    totals: {
      totalVendors,
      purchaseMade: pipeline.PURCHASE_MADE,
      totalContractValue: totalContractValueAgg._sum.contractValue ?? 0,
      invoicedPaid: paidInvoicesAgg._sum.amount ?? 0,
      paidInvoiceCount: paidInvoicesAgg._count._all,
      outstanding: outstandingInvoicesAgg._sum.amount ?? 0,
      contractsExpiring,
      totalInvoices,
    },
    pipeline,
    contractValueByCategory: contractValueByCategory.map((row) => ({
      category: row.category,
      value: row._sum?.contractValue ?? 0,
    })),
    invoiceStatus,
    topVendors,
  };
}
