import { describe, expect, it } from "vitest";
import {
  filterPurchaseProducts,
  purchaseProductOptions,
} from "../../src/features/inventory/purchase-product-search";
import type { Offering } from "../../src/types/crm";

const products = [
  {
    id: "panel",
    name: "620W Solar Panel",
    brandName: "Red Solar",
    sku: "RED-620",
    barcode: "123456",
    category: "Panels",
    referenceNumber: "OFF-001",
  },
  {
    id: "inverter",
    name: "5kVA Inverter",
    brandName: "Sorotec",
    sku: "REVO-5K",
    category: "Inverters",
    referenceNumber: "OFF-002",
  },
] as Offering[];

describe("purchase product search", () => {
  it("finds products by common catalogue identifiers", () => {
    expect(filterPurchaseProducts(products, "red solar").map((item) => item.id)).toEqual(["panel"]);
    expect(filterPurchaseProducts(products, "revo-5k").map((item) => item.id)).toEqual(["inverter"]);
    expect(filterPurchaseProducts(products, "123456").map((item) => item.id)).toEqual(["panel"]);
    expect(filterPurchaseProducts(products, "inverters").map((item) => item.id)).toEqual(["inverter"]);
  });

  it("keeps a selected line item available while searching for another product", () => {
    const filtered = filterPurchaseProducts(products, "inverter");
    expect(purchaseProductOptions(products, filtered, "panel").map((item) => item.id)).toEqual([
      "panel",
      "inverter",
    ]);
  });
});
