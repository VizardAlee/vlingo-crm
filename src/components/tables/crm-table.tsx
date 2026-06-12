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
import Link from "next/link";
import { Download, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/state";
import { cn } from "@/lib/utils";

function headerLabel<TData>(column: ColumnDef<TData>) {
  return typeof column.header === "string" ? column.header : "Detail";
}

interface CompactContactView<TData> {
  getHref: (row: TData) => string;
  getName: (row: TData) => string;
  getPhone: (row: TData) => string;
}

export function CrmTable<TData>({
  compactContactView,
  columns,
  data,
  emptyActionHref,
  emptyActionLabel,
  emptyTitle,
}: {
  compactContactView?: CompactContactView<TData>;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyActionHref?: string;
  emptyActionLabel?: string;
  emptyTitle: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [mobileView, setMobileView] = useState<"cards" | "contacts">("cards");
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
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageStart = filteredCount ? pageIndex * pageSize + 1 : 0;
  const pageEnd = Math.min((pageIndex + 1) * pageSize, filteredCount);

  if (!data.length) {
    return <EmptyState actionHref={emptyActionHref} actionLabel={emptyActionLabel} title={emptyTitle} />;
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <div className="relative flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-11 rounded-md pl-9 md:h-10"
            placeholder="Search records"
            value={globalFilter}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              table.setPageIndex(0);
            }}
          />
        </div>
        {compactContactView ? (
          <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted p-1 lg:hidden">
            <Button className="h-9 shadow-none" onClick={() => setMobileView("cards")} size="sm" type="button" variant={mobileView === "cards" ? "primary" : "ghost"}>
              <LayoutGrid className="h-4 w-4" />
              Cards
            </Button>
            <Button className="h-9 shadow-none" onClick={() => setMobileView("contacts")} size="sm" type="button" variant={mobileView === "contacts" ? "primary" : "ghost"}>
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        ) : null}
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
      {pageRows.length ? (
        compactContactView && mobileView === "contacts" ? (
          <div className="grid gap-2 bg-muted/40 p-3 lg:hidden">
            {pageRows.map((row) => (
              <Link className="flex items-center justify-between gap-3 rounded-md border bg-white p-3 shadow-sm hover:bg-muted" href={compactContactView.getHref(row.original)} key={row.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{compactContactView.getName(row.original)}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{compactContactView.getPhone(row.original) || "No phone"}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary">View</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 bg-muted/40 p-3 md:grid-cols-2 lg:hidden">
            {pageRows.map((row) => {
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
        )
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
            {pageRows.map((row) => (
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
        {!pageRows.length ? (
          <div className="p-3">
            <EmptyState title="No records match this search." />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 border-t p-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Showing {pageStart}-{pageEnd} of {filteredCount}
          </span>
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <Select className="h-9 w-20" value={String(pageSize)} onChange={(event) => table.setPageSize(Number(event.target.value))}>
              {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </Select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <span>
            Page {table.getPageCount() ? pageIndex + 1 : 0} of {table.getPageCount()}
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
    </div>
  );
}
