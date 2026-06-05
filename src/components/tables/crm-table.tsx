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
import { cn } from "@/lib/utils";

function headerLabel<TData>(column: ColumnDef<TData>) {
  return typeof column.header === "string" ? column.header : "Detail";
}

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
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <div className="relative flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="h-11 rounded-md pl-9 md:h-10" placeholder="Search records" value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Button className="h-11 md:h-10" type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <Button className="h-11 md:h-10" type="button" variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      {table.getRowModel().rows.length ? (
        <div className="grid gap-3 bg-muted/40 p-3 md:grid-cols-2 lg:hidden">
          {table.getRowModel().rows.map((row) => {
            const cells = row.getVisibleCells();
            const [primaryCell, ...detailCells] = cells;
            return (
              <article className="rounded-md border bg-white p-4 shadow-sm md:min-h-56" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-base font-semibold leading-6">
                    {primaryCell ? flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext()) : "Record"}
                  </div>
                </div>
                <dl className="mt-4 grid gap-3">
                  {detailCells.slice(0, 5).map((cell) => (
                    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 text-sm" key={cell.id}>
                      <dt className="text-muted-foreground">{headerLabel(cell.column.columnDef)}</dt>
                      <dd className={cn("min-w-0 text-right font-medium", cell.column.id.toLowerCase().includes("status") && "text-left")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="p-3 lg:hidden">
          <EmptyState title="No records match this search." />
        </div>
      )}
      <div className="hidden max-w-full overflow-x-auto lg:block">
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
      <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground md:p-4">
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
