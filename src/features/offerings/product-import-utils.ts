import { offeringSchema } from "../../lib/validation/schemas";
import type { Branch, InventoryBrand } from "../../types/crm";

export interface ProductImportSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ProductImportPreviewRow {
  branchId: string;
  data: Record<string, unknown>;
  errors: string[];
  rowNumber: number;
}

export const productImportFields = [
  { key: "name", label: "Product/service name", required: true },
  { key: "vertical", label: "Business vertical", required: true },
  { key: "type", label: "Product/service type", required: true },
  { key: "category", label: "Category", required: true },
  { key: "brand", label: "Brand name, code, or ID" },
  { key: "status", label: "Status" },
  { key: "description", label: "Description" },
  { key: "barcode", label: "Barcode / GTIN" },
  { key: "trackingMode", label: "Traceability" },
  { key: "unitOfMeasure", label: "Unit of measure" },
  { key: "sellingPrice", label: "Selling price" },
  { key: "costPrice", label: "Cost price" },
  { key: "reorderLevel", label: "Reorder level" },
  { key: "supplierName", label: "Supplier / partner" },
  { key: "serviceDurationDays", label: "Service duration days" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Internal notes" },
] as const;

export const branchImportField = {
  key: "branch",
  label: "Branch name, code, or ID",
} as const;

const headerAliases: Record<string, string[]> = {
  barcode: ["barcode", "gtin", "ean", "upc"],
  branch: ["branch", "branchname", "location", "stocklocation"],
  brand: ["brand", "brandname", "manufacturer", "make"],
  category: ["category", "productcategory", "itemcategory"],
  costPrice: ["costprice", "cost", "buyingprice", "purchaseprice"],
  description: ["description", "productdescription", "details"],
  name: ["name", "productname", "itemname", "product", "item", "service"],
  notes: ["notes", "internalnotes", "remarks"],
  reorderLevel: ["reorderlevel", "reorderpoint", "minimumstock", "minstock"],
  sellingPrice: ["sellingprice", "saleprice", "price", "unitprice"],
  serviceDurationDays: ["servicedurationdays", "durationdays", "duration"],
  status: ["status", "productstatus"],
  supplierName: ["supplier", "suppliername", "partner", "vendor"],
  tags: ["tags", "tag", "labels"],
  trackingMode: ["trackingmode", "traceability", "tracking", "trackby"],
  type: ["type", "producttype", "itemtype", "servicetype"],
  unitOfMeasure: ["unitofmeasure", "uom", "unit", "measure"],
  vertical: ["vertical", "businessvertical", "businessline", "division"],
};

const verticals = ["realEstate", "solar", "buildingMaterials", "generalServices", "custom"];
const productTypes = ["property", "unit", "material", "solarEquipment", "solarService", "installationProject", "consultancy", "maintenance", "service", "other"];
const statuses = ["active", "draft", "inactive", "archived"];
const trackingModes = ["none", "batch", "serial"];

export function normalizeImportValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLookup(value: unknown) {
  return normalizeImportValue(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cleanProductHeaders(headers: unknown[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = normalizeImportValue(header) || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

export function parseProductCsv(text: string): ProductImportSheet {
  const parsedRows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) parsedRows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) parsedRows.push(row);
  const [headers = [], ...body] = parsedRows;
  const cleanHeaders = cleanProductHeaders(headers);
  return {
    headers: cleanHeaders,
    rows: body
      .filter((cells) => cells.some((cell) => normalizeImportValue(cell)))
      .map((cells) => Object.fromEntries(cleanHeaders.map((header, index) => [header, cells[index] ?? ""]))),
  };
}

export function detectProductColumnMapping(headers: string[], includeBranch: boolean) {
  const fields = includeBranch ? [...productImportFields, branchImportField] : productImportFields;
  return Object.fromEntries(fields.map(({ key }) => {
    const aliases = headerAliases[key] ?? [key];
    const header = headers.find((candidate) => aliases.some((alias) => normalizeLookup(candidate) === normalizeLookup(alias)));
    return [key, header ?? ""];
  }));
}

export function hasLegacyQuantityHeader(headers: string[]) {
  const quantityAliases = ["quantity", "qty", "stock", "stockqty", "stockquantity", "openingstock", "openingquantity", "onhand", "onhandquantity"];
  return headers.some((header) => quantityAliases.includes(normalizeLookup(header)));
}

function mappedValue(row: Record<string, unknown>, key: string, mapping: Record<string, string>) {
  const header = mapping[key];
  return header ? normalizeImportValue(row[header]) : "";
}

function canonicalValue(value: string, allowed: string[]) {
  const normalized = normalizeLookup(value);
  return allowed.find((item) => normalizeLookup(item) === normalized) ?? "";
}

function optionalNumber(value: string, label: string, errors: string[]) {
  if (!value) return undefined;
  const normalized = value.replace(/[₦$£€,%\s]/g, "").replace(/,/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    errors.push(`${label} must be a non-negative number.`);
    return undefined;
  }
  return number;
}

function resolveBrand(value: string, brands: InventoryBrand[]) {
  const lookup = normalizeLookup(value);
  return brands.find((brand) => [brand.id, brand.name, brand.code].some((candidate) => normalizeLookup(candidate) === lookup));
}

function resolveBranch(value: string, branches: Branch[]) {
  const lookup = normalizeLookup(value);
  return branches.find((branch) => [branch.id, branch.name, branch.code].some((candidate) => normalizeLookup(candidate) === lookup));
}

export function previewProductImport(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  brands: InventoryBrand[],
  branches: Branch[],
  defaultBranchId: string,
  canMapBranch: boolean,
) {
  return rows.map<ProductImportPreviewRow>((row, index) => {
    const errors: string[] = [];
    const verticalInput = mappedValue(row, "vertical", mapping);
    const typeInput = mappedValue(row, "type", mapping);
    const statusInput = mappedValue(row, "status", mapping);
    const trackingInput = mappedValue(row, "trackingMode", mapping);
    const vertical = canonicalValue(verticalInput, verticals);
    const type = canonicalValue(typeInput, productTypes);
    const status = statusInput ? canonicalValue(statusInput, statuses) : "active";
    const trackingMode = trackingInput ? canonicalValue(trackingInput, trackingModes) : undefined;

    if (verticalInput && !vertical) errors.push(`Unknown business vertical: ${verticalInput}.`);
    if (typeInput && !type) errors.push(`Unknown product/service type: ${typeInput}.`);
    if (statusInput && !status) errors.push(`Unknown status: ${statusInput}.`);
    if (trackingInput && !trackingMode) errors.push(`Unknown traceability value: ${trackingInput}.`);

    const brandInput = mappedValue(row, "brand", mapping);
    const brand = brandInput ? resolveBrand(brandInput, brands) : undefined;
    if (brandInput && !brand) errors.push(`Brand not found: ${brandInput}. Create it before importing.`);
    if (["material", "solarEquipment"].includes(type) && !brand) errors.push("Brand is required for inventory products.");

    const branchInput = canMapBranch ? mappedValue(row, "branch", mapping) : "";
    const branch = branchInput ? resolveBranch(branchInput, branches) : branches.find((item) => item.id === defaultBranchId);
    const branchId = branch?.id ?? defaultBranchId;
    if (branchInput && !branch) errors.push(`Branch not found or inaccessible: ${branchInput}.`);
    if (!branchId) errors.push("Select a destination branch.");

    const payload = {
      barcode: mappedValue(row, "barcode", mapping),
      brandId: brand?.id ?? "",
      brandName: brand?.name ?? "",
      category: mappedValue(row, "category", mapping),
      costPrice: optionalNumber(mappedValue(row, "costPrice", mapping), "Cost price", errors),
      description: mappedValue(row, "description", mapping),
      name: mappedValue(row, "name", mapping),
      notes: mappedValue(row, "notes", mapping),
      reorderLevel: optionalNumber(mappedValue(row, "reorderLevel", mapping), "Reorder level", errors),
      sellingPrice: optionalNumber(mappedValue(row, "sellingPrice", mapping), "Selling price", errors),
      serviceDurationDays: optionalNumber(mappedValue(row, "serviceDurationDays", mapping), "Service duration", errors),
      status,
      supplierName: mappedValue(row, "supplierName", mapping),
      tags: mappedValue(row, "tags", mapping),
      trackingMode,
      type,
      unitOfMeasure: mappedValue(row, "unitOfMeasure", mapping),
      vertical,
    };
    const parsed = offeringSchema.safeParse(payload);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`));
    }

    return {
      branchId,
      data: parsed.success ? parsed.data as Record<string, unknown> : payload,
      errors: Array.from(new Set(errors)),
      rowNumber: index + 2,
    };
  });
}
