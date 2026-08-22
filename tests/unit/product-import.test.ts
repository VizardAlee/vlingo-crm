import { describe, expect, it } from "vitest";
import {
  detectProductColumnMapping,
  hasLegacyQuantityHeader,
  parseProductCsv,
  previewProductImport,
} from "../../src/features/offerings/product-import-utils";
import type { Branch, InventoryBrand } from "../../src/types/crm";

const brands = [
  { code: "SOR", id: "brand-sorotec", name: "Sorotec", status: "active" },
] as InventoryBrand[];
const branches = [
  { code: "KAD", id: "head-office", name: "Head Office", status: "active" },
  { code: "KAN", id: "kano", name: "Kano Branch", status: "active" },
] as Branch[];

describe("product spreadsheet import", () => {
  it("parses quoted CSV cells and detects common column names", () => {
    const sheet = parseProductCsv('Product Name,Business Vertical,Product Type,Category,Brand,Price,Quantity\n"Inverter, 5kVA",Solar,Solar Equipment,Inverters,SOR,"850,000",25');
    const mapping = detectProductColumnMapping(sheet.headers, false);

    expect(sheet.rows[0]["Product Name"]).toBe("Inverter, 5kVA");
    expect(mapping.name).toBe("Product Name");
    expect(mapping.sellingPrice).toBe("Price");
    expect(hasLegacyQuantityHeader(sheet.headers)).toBe(true);
    expect(mapping).not.toHaveProperty("quantity");
  });

  it("resolves brands and branches while excluding quantity from the product payload", () => {
    const rows = [{ Name: "5kVA Inverter", Vertical: "Solar", Type: "Solar Equipment", Category: "Inverters", Brand: "SOR", Branch: "KAN", Price: "850,000", Quantity: "25" }];
    const mapping = {
      branch: "Branch",
      brand: "Brand",
      category: "Category",
      name: "Name",
      sellingPrice: "Price",
      type: "Type",
      vertical: "Vertical",
    };
    const [preview] = previewProductImport(rows, mapping, brands, branches, "head-office", true);

    expect(preview.errors).toEqual([]);
    expect(preview.branchId).toBe("kano");
    expect(preview.data.brandId).toBe("brand-sorotec");
    expect(preview.data.sellingPrice).toBe(850000);
    expect(preview.data).not.toHaveProperty("quantity");
    expect(preview.data).not.toHaveProperty("stockQuantity");
  });

  it("blocks inventory products whose mapped brand does not exist", () => {
    const [preview] = previewProductImport(
      [{ Name: "Panel", Vertical: "solar", Type: "solarEquipment", Category: "Panels", Brand: "Unknown" }],
      { brand: "Brand", category: "Category", name: "Name", type: "Type", vertical: "Vertical" },
      brands,
      branches,
      "head-office",
      false,
    );

    expect(preview.errors.join(" ")).toContain("Brand not found");
    expect(preview.errors.join(" ")).toContain("Brand is required");
  });
});
