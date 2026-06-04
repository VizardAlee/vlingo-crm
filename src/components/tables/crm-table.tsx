"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/state";

export function CrmTable<TData>({
  columns,
  data,
  emptyActionHref,
  emptyActionLabel,
  emptyTitle,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyActionHref?: string;
  emptyActionLabel?: string;
  emptyTitle: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  if (!data.length) {
    return <EmptyState actionHref={emptyActionHref} actionLabel={emptyActionLabel} title={emptyTitle} />;
  }

  return (
    <div className="rounded-md border bg-white">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search table" value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <Button type="button" variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-t hover:bg-muted/40" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="px-4 py-3 align-top" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <div className="flex gap-2">
          <Button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} size="sm" type="button" variant="outline">
            Previous
          </Button>
          <Button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} size="sm" type="button" variant="outline">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
