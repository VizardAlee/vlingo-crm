"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import { ArrowDownAZ, Download, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/state";
import { cn, titleCase } from "@/lib/utils";

function headerLabel<TData>(column: ColumnDef<TData>) {
  return typeof column.header === "string" ? column.header : "Detail";
}

interface CompactContactView<TData> {
  getHref: (row: TData) => string;
  getName: (row: TData) => string;
  getPhone: (row: TData) => string;
}

const filterCandidateKeys = [
  "status",
  "propertyStatus",
  "paymentStatus",
  "agreementStatus",
  "listingStatus",
  "marketingStatus",
  "priority",
  "leadTemperature",
  "source",
  "transactionInterest",
  "category",
  "city",
  "propertyType",
  "clientType",
  "relatedEntityType",
  "type",
];

const sortCandidateKeys = [
  "updatedAt",
  "createdAt",
  "referenceNumber",
  "fullName",
  "name",
  "title",
  "subject",
  "tenantName",
  "unitNumber",
  "status",
];

function rawValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      return (value.toDate() as Date).toISOString();
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function timestampValue(value: unknown) {
  const raw = rawValue(value);
  if (!raw) {
    return 0;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compareValues(a: unknown, b: unknown, direction: "asc" | "desc") {
  const first = rawValue(a);
  const second = rawValue(b);
  const firstDate = timestampValue(a);
  const secondDate = timestampValue(b);
  const result = firstDate || secondDate
    ? firstDate - secondDate
    : first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" });

  return direction === "asc" ? result : -result;
}

function csvEscape(value: unknown) {
  const text = rawValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function downloadCsv<TData extends Record<string, unknown>>(filename: string, rows: TData[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !["id", "isDeleted"].includes(key));
  const csv = [
    keys.map(csvEscape).join(","),
    ...rows.map((row) => keys.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filterOptions<TData extends Record<string, unknown>>(data: TData[], key: string) {
  const values = Array.from(new Set(data.map((row) => rawValue(row[key])).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return values.length > 1 && values.length <= 40 ? values : [];
}

function defaultSortKey<TData extends Record<string, unknown>>(data: TData[]) {
  const keys = new Set(data.flatMap((row) => Object.keys(row)));
  return sortCandidateKeys.find((key) => keys.has(key)) ?? "";
}

function inputByLabel(row: Record<string, unknown>) {
  return rawValue(row.createdByName) || rawValue(row.createdByEmail) || rawValue(row.createdBy);
}

export function CrmTable<TData extends Record<string, unknown>>({
  compactContactView,
  columns,
  data,
  emptyActionHref,
  emptyActionLabel,
  emptyTitle,
  exportFilename = "records.csv",
}: {
  compactContactView?: CompactContactView<TData>;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyActionHref?: string;
  emptyActionLabel?: string;
  emptyTitle: string;
  exportFilename?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"cards" | "contacts">("cards");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [sortKey, setSortKey] = useState(() => defaultSortKey(data));
  const availableFilters = useMemo(() => filterCandidateKeys
    .map((key) => ({ key, label: titleCase(key), options: filterOptions(data, key) }))
    .filter((filter) => filter.options.length), [data]);
  const availableSorts = useMemo(() => sortCandidateKeys
    .filter((key) => data.some((row) => rawValue(row[key])))
    .map((key) => ({ key, label: titleCase(key) })), [data]);
  const operationalData = useMemo(() => {
    const entries = Object.entries(activeFilters).filter(([, value]) => value);
    const filtered = entries.length
      ? data.filter((row) => entries.every(([key, value]) => rawValue(row[key]) === value))
      : data;
    const search = globalFilter.trim().toLowerCase();
    const searched = search
      ? filtered.filter((row) => Object.values(row).some((value) => rawValue(value).toLowerCase().includes(search)))
      : filtered;

    if (!sortKey) {
      return searched;
    }

    return searched.slice().sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDirection));
  }, [activeFilters, data, globalFilter, sortDirection, sortKey]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: operationalData,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const filteredCount = table.getFilteredRowModel().rows.length;
  const exportRows = table.getFilteredRowModel().rows.map((row) => row.original);
  const pageRows = table.getRowModel().rows;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageStart = filteredCount ? pageIndex * pageSize + 1 : 0;
  const pageEnd = Math.min((pageIndex + 1) * pageSize, filteredCount);
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

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
          <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted p-1 md:w-52 lg:hidden">
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
          <Button className="h-11 md:h-10" disabled={!availableFilters.length && !availableSorts.length} onClick={() => setFiltersOpen((value) => !value)} type="button" variant={filtersOpen || activeFilterCount ? "secondary" : "outline"}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <Button className="h-11 md:h-10" disabled={!exportRows.length} onClick={() => downloadCsv(exportFilename, exportRows)} type="button" variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      <div className={cn("grid gap-3 border-b bg-muted/30 p-3 md:grid-cols-[1fr_auto_auto] md:items-end md:p-4", !filtersOpen && !activeFilterCount && "hidden")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {availableFilters.map((filter) => (
            <label className="grid gap-1.5 text-sm font-medium" key={filter.key}>
              <span>{filter.label}</span>
              <Select
                className="h-10"
                value={activeFilters[filter.key] ?? ""}
                onChange={(event) => {
                  setActiveFilters((current) => ({ ...current, [filter.key]: event.target.value }));
                  table.setPageIndex(0);
                }}
              >
                <option value="">All</option>
                {filter.options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
              </Select>
            </label>
          ))}
        </div>
        {availableSorts.length ? (
          <>
            <label className="grid gap-1.5 text-sm font-medium md:w-56">
              <span>Sort by</span>
              <Select className="h-10" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                {availableSorts.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </Select>
            </label>
            <Button className="h-10" onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")} type="button" variant="outline">
              <ArrowDownAZ className="h-4 w-4" />
              {sortDirection === "asc" ? "Ascending" : "Descending"}
            </Button>
          </>
        ) : null}
        {activeFilterCount ? (
          <Button className="h-10 md:col-start-3" onClick={() => {
            setActiveFilters({});
            table.setPageIndex(0);
          }} type="button" variant="ghost">
            Clear filters
          </Button>
        ) : null}
      </div>
      {pageRows.length ? (
        compactContactView && mobileView === "contacts" ? (
          <div className="grid gap-2 bg-muted/40 p-3 lg:hidden">
            {pageRows.map((row) => (
              <Link className="flex items-center justify-between gap-3 rounded-md border bg-white p-3 shadow-sm hover:bg-muted" href={compactContactView.getHref(row.original)} key={row.id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{compactContactView.getName(row.original)}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{compactContactView.getPhone(row.original) || "No phone"}</p>
                  {inputByLabel(row.original) ? <p className="mt-1 truncate text-xs text-muted-foreground">Input by {inputByLabel(row.original)}</p> : null}
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
              const creator = inputByLabel(row.original);
              return (
                <article className="rounded-md border bg-white p-4 shadow-sm md:min-h-56" key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-base font-semibold leading-6">
                      {primaryCell ? flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext()) : "Record"}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3">
                    {detailCells.filter((cell) => headerLabel(cell.column.columnDef) !== "Input by").slice(0, 5).map((cell) => (
                      <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 text-sm" key={cell.id}>
                        <dt className="text-muted-foreground">{headerLabel(cell.column.columnDef)}</dt>
                        <dd className={cn("min-w-0 text-right font-medium", cell.column.id.toLowerCase().includes("status") && "text-left")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </div>
                    ))}
                    {creator ? (
                      <div className="grid grid-cols-[6.5rem_1fr] items-start gap-3 text-sm">
                        <dt className="text-muted-foreground">Input by</dt>
                        <dd className="min-w-0 truncate text-right font-medium">{creator}</dd>
                      </div>
                    ) : null}
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
