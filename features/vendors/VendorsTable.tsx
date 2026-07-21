import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { VENDOR_CATEGORY_LABELS, VendorDto, VendorStage } from "@shared";
import { formatInr, formatDate } from "@/lib/format";

const STAGE_CHIP: Record<VendorStage, string> = {
  IN_TALKS: "bg-keystone-blue/10 text-keystone-blue",
  CATALOGUE_RECEIVED: "bg-orange/15 text-orange-deep",
  PURCHASE_MADE: "bg-keystone-green/10 text-keystone-green",
};

const STAGE_LABEL: Record<VendorStage, string> = {
  IN_TALKS: "In Talks",
  CATALOGUE_RECEIVED: "Catalogue Received",
  PURCHASE_MADE: "Purchase Made",
};

interface Props {
  vendors: VendorDto[];
  total: number;
  onOpenVendor: (id: string) => void;
}

export function VendorsTable({ vendors, total, onOpenVendor }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<VendorDto>[]>(
    () => [
      { accessorKey: "name", header: "Vendor" },
      {
        accessorKey: "category",
        header: "Category",
        cell: (info) => VENDOR_CATEGORY_LABELS[info.getValue<VendorDto["category"]>()],
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: (info) => {
          const stage = info.getValue<VendorStage>();
          return <span className={`chip ${STAGE_CHIP[stage]}`}>{STAGE_LABEL[stage]}</span>;
        },
      },
      { accessorKey: "contactName", header: "Contact", cell: (info) => info.getValue() ?? "—" },
      {
        accessorKey: "contractValue",
        header: "Value",
        cell: (info) => formatInr(info.getValue<number>()),
      },
      {
        accessorKey: "contractEnd",
        header: "Expires",
        cell: (info) => formatDate(info.getValue<string | null>()),
      },
      {
        id: "docs",
        header: "Docs",
        cell: ({ row }) =>
          `${row.original.catalogueCount ?? 0} cat / ${row.original.invoiceCount ?? 0} inv`,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: vendors,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="card overflow-hidden">
      <div className="p-4 border-b border-border flex items-baseline justify-between">
        <h2 className="text-lg font-bold">All Vendors</h2>
        <p className="text-xs text-muted">
          {vendors.length} of {total} shown
        </p>
      </div>
      {vendors.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted">No vendors match your filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-orange-light/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-4 py-2 text-left font-semibold text-xs uppercase tracking-wide cursor-pointer select-none"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-orange-light/30 cursor-pointer"
                  onClick={() => onOpenVendor(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
