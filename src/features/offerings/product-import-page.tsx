"use client";

import { readSheet } from "read-excel-file/browser";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import {
  branchImportField,
  cleanProductHeaders,
  detectProductColumnMapping,
  hasLegacyQuantityHeader,
  parseProductCsv,
  previewProductImport,
  productImportFields,
  type ProductImportPreviewRow,
  type ProductImportSheet,
} from "@/features/offerings/product-import-utils";
import { canAccessAllBranches, effectiveBranchId, hasPermission } from "@/lib/permissions";
import { createReference, titleCase } from "@/lib/utils";
import { listInventoryBrands } from "@/services/inventory";
import { createOrgRecord, writeAuditLog } from "@/services/repository";
import { listBranches } from "@/services/users";
import type { Branch, InventoryBrand } from "@/types/crm";

async function readProductSheet(file: File): Promise<ProductImportSheet> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseProductCsv(await file.text());
  }

  const rows: unknown[][] = await readSheet(file);
  const [headers = [], ...body] = rows;
  const cleanHeaders = cleanProductHeaders(headers);
  return {
    headers: cleanHeaders,
    rows: body
      .filter((cells) => cells.some((cell) => String(cell ?? "").trim()))
      .map((cells) => Object.fromEntries(cleanHeaders.map((header, index) => [header, cells[index] ?? ""]))),
  };
}

function downloadProductTemplate() {
  const headers = [
    "name",
    "vertical",
    "type",
    "category",
    "brand",
    "status",
    "description",
    "barcode",
    "trackingMode",
    "unitOfMeasure",
    "sellingPrice",
    "costPrice",
    "reorderLevel",
    "supplierName",
    "serviceDurationDays",
    "tags",
    "notes",
    "branch",
  ];
  const example = [
    "5kVA Hybrid Inverter",
    "solar",
    "solarEquipment",
    "Inverters",
    "Sorotec",
    "active",
    "Hybrid solar inverter",
    "",
    "none",
    "unit",
    "850000",
    "720000",
    "5",
    "",
    "",
    "solar,inverter",
    "Imported catalog item",
    "Head Office",
  ];
  const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = [headers, example].map((row) => row.map(escapeCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "product-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ProductImportPage() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [failedRows, setFailedRows] = useState<ProductImportPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canMapBranch = canAccessAllBranches(member);
  const mappingFields = useMemo(
    () => canMapBranch ? [...productImportFields, branchImportField] : [...productImportFields],
    [canMapBranch],
  );
  const calculatedPreview = useMemo(
    () => rows.length ? previewProductImport(rows, mapping, brands, branches, defaultBranchId, canMapBranch) : [],
    [brands, branches, canMapBranch, defaultBranchId, mapping, rows],
  );
  const preview = failedRows.length ? failedRows : calculatedPreview;
  const validRows = preview.filter((row) => row.errors.length === 0);
  const invalidCount = preview.length - validRows.length;
  const quantityColumnDetected = hasLegacyQuantityHeader(headers);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      listInventoryBrands(activeOrganizationId, member),
      listBranches(activeOrganizationId),
    ])
      .then(([brandItems, branchItems]) => {
        if (!mounted) return;
        const activeBrands = brandItems.filter((brand) => brand.status === "active");
        const activeBranches = branchItems
          .filter((branch) => branch.status === "active")
          .filter((branch) => canAccessAllBranches(member) || branch.id === member?.branchId);
        const preferredBranchId = effectiveBranchId(member, activeBranchId);
        setBrands(activeBrands);
        setBranches(activeBranches);
        setDefaultBranchId(activeBranches.some((branch) => branch.id === preferredBranchId)
          ? preferredBranchId
          : activeBranches[0]?.id ?? preferredBranchId);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Unable to load import options."))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [activeBranchId, activeOrganizationId, member]);

  async function handleFile(file: File | null) {
    setError(null);
    setImportedCount(0);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setFailedRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const sheet = await readProductSheet(file);
      if (!sheet.headers.length) throw new Error("The selected file has no header row.");
      if (!sheet.rows.length) throw new Error("The selected file has no product rows.");
      setHeaders(sheet.headers);
      setRows(sheet.rows);
      setMapping(detectProductColumnMapping(sheet.headers, canMapBranch));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to read the spreadsheet.");
    }
  }

  function updateMapping(key: string, header: string) {
    setMapping((current) => ({ ...current, [key]: header }));
  }

  async function importProducts() {
    if (!user || !validRows.length) return;
    setSaving(true);
    setError(null);
    setImportedCount(0);
    const failures: ProductImportPreviewRow[] = [];
    let completed = 0;

    for (const row of validRows) {
      const context = {
        branchId: row.branchId,
        organizationId: activeOrganizationId,
        userEmail: member?.email || user.email || "",
        userId: user.uid,
        userName: member?.displayName || user.displayName || user.email || "",
      };
      const payload = { ...row.data, sku: createReference("SKU") };
      try {
        const id = await createOrgRecord("offerings", payload, context, "OFR");
        await writeAuditLog(context, "offering.create", "offerings", id, payload);
        completed += 1;
        setImportedCount(completed);
      } catch (nextError) {
        failures.push({
          ...row,
          errors: [`Import failed: ${nextError instanceof Error ? nextError.message : "Unable to create product."}`],
        });
      }
    }

    setSaving(false);
    if (failures.length) {
      setFailedRows(failures);
      setRows([]);
      setError(`${completed} imported; ${failures.length} failed. Review the row errors below.`);
      toast({ title: "Product import partially completed", description: `${completed} imported and ${failures.length} failed.`, variant: "error" });
      return;
    }

    setHeaders([]);
    setRows([]);
    setMapping({});
    setFailedRows([]);
    setFileName("");
    toast({ title: "Products imported", description: `${completed} product${completed === 1 ? "" : "s"} created. Add quantities through Inventory.`, variant: "success" });
  }

  if (!hasPermission(member, "offerings.create")) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading product importer" />;

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary" href="/offerings">
            <ArrowLeft className="h-4 w-4" /> Back to Products/Services
          </Link>
          <h1 className="mt-3 text-xl font-semibold md:text-2xl">Import products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload CSV or Excel, match your columns, review the preview, and create valid catalog items.</p>
        </div>
        <Button className="h-11 w-full md:h-10 md:w-auto" onClick={downloadProductTemplate} type="button" variant="outline">
          <Download className="h-4 w-4" /> Download template
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div>
          <p className="font-semibold">Product quantity is not imported here.</p>
          <p className="mt-1 text-muted-foreground">This creates catalog products only. After import, use Inventory → Add / move stock to enter existing opening stock, or use Purchasing/Receiving for procured stock. This keeps every quantity tied to a branch, location, and audit record.</p>
          {quantityColumnDetected ? <p className="mt-2 font-semibold text-warning">A quantity/stock column was detected in {fileName}; it will be ignored.</p> : null}
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {importedCount > 0 && !error ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-4 text-sm font-medium text-success">
          <CheckCircle2 className="h-5 w-5" /> {importedCount} product{importedCount === 1 ? "" : "s"} imported.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>1. Choose file and default branch</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_280px]">
          <Field label="CSV or Excel file">
            <Input accept=".csv,.xls,.xlsx" disabled={saving} type="file" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Default product branch">
            <Select disabled={!canMapBranch || saving} value={defaultBranchId} onChange={(event) => setDefaultBranchId(event.target.value)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
            <span className="text-xs font-normal text-muted-foreground">Used when a row has no mapped branch. Branch-limited users always import to their assigned branch.</span>
          </Field>
        </CardContent>
      </Card>

      {headers.length ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Match your columns</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Choose which file column supplies each system field. Required fields are marked. SKU is generated automatically; quantity is not available for mapping.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mappingFields.map((field) => (
              <Field key={field.key} label={`${field.label}${"required" in field && field.required ? " *" : ""}`}>
                <Select disabled={saving} value={mapping[field.key] ?? ""} onChange={(event) => updateMapping(field.key, event.target.value)}>
                  <option value="">{"required" in field && field.required ? "Select a file column" : "Do not import"}</option>
                  {headers.map((header) => <option key={`${field.key}-${header}`} value={header}>{header}</option>)}
                </Select>
              </Field>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {preview.length ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>3. Review and import</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="muted">{preview.length} rows</Badge>
                <Badge tone="success">{validRows.length} valid</Badge>
                <Badge tone={invalidCount ? "danger" : "muted"}>{invalidCount} issues</Badge>
              </div>
            </div>
            <Button disabled={!validRows.length || saving} onClick={() => void importProducts()} type="button">
              <Upload className="h-4 w-4" />
              {saving ? `Importing ${importedCount + 1} of ${validRows.length}` : `Import ${validRows.length} valid row${validRows.length === 1 ? "" : "s"}`}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:hidden">
              {preview.map((row) => (
                <div className="rounded-md border p-4" key={row.rowNumber}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-semibold">Row {row.rowNumber}: {String(row.data.name || "Unnamed")}</p><p className="mt-1 text-xs text-muted-foreground">{titleCase(String(row.data.type || "No type"))} · {branches.find((branch) => branch.id === row.branchId)?.name ?? row.branchId}</p></div>
                    <Badge tone={row.errors.length ? "danger" : "success"}>{row.errors.length ? "Issue" : "Valid"}</Badge>
                  </div>
                  {row.errors.length ? <p className="mt-3 text-sm text-destructive">{row.errors.join(" · ")}</p> : null}
                </div>
              ))}
            </div>
            <div className="hidden max-w-full overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Row</th><th className="px-4 py-3">Product/service</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Brand</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Result</th></tr></thead>
                <tbody>{preview.map((row) => <tr className="border-t align-top" key={row.rowNumber}><td className="px-4 py-3">{row.rowNumber}</td><td className="px-4 py-3 font-semibold">{String(row.data.name || "Unnamed")}</td><td className="px-4 py-3">{titleCase(String(row.data.type || "—"))}</td><td className="px-4 py-3">{String(row.data.brandName || "—")}</td><td className="px-4 py-3">{branches.find((branch) => branch.id === row.branchId)?.name ?? row.branchId}</td><td className="max-w-sm px-4 py-3">{row.errors.length ? <span className="text-destructive">{row.errors.join(" · ")}</span> : <span className="text-success">Ready</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!brands.length ? <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">No active brands are available. Inventory products such as materials and solar equipment require an existing active brand before they can be imported.</div> : null}
      <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p>Supported files: CSV, XLS, and XLSX with headers in the first row. The importer auto-matches common column names, but you can change every mapping before creating records.</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-foreground">Accepted type values</summary>
            <div className="mt-2 grid gap-1 text-xs">
              <p><strong>Business vertical:</strong> Real estate, Solar, Building materials, General services, or Custom.</p>
              <p><strong>Product/service type:</strong> Property, Unit, Material, Solar equipment, Solar service, Installation project, Consultancy, Maintenance, Service, or Other.</p>
              <p><strong>Traceability:</strong> None, Batch, or Serial. <strong>Status:</strong> Active, Draft, Inactive, or Archived.</p>
              <p>Inventory products must reference an active brand already configured in Inventory. Brand and branch values may use their name, code, or system ID.</p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
