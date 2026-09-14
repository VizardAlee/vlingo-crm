import { describe, expect, it } from "vitest";
import {
  branchInventoryCatalog,
  organizationInventoryCatalog,
} from "../../src/features/inventory/inventory-catalog-scope";
import type { InventoryBalance, Offering } from "../../src/types/crm";

const products = [
  { id: "head-office-product", brandId: "red", branchId: "head-office" },
  { id: "kano-product", brandId: "sorotec", branchId: "kano" },
  { id: "unbranded-service", branchId: "head-office" },
] as Offering[];

describe("inventory catalogue scope", () => {
  it("shares every branded product across the organization movement catalogue", () => {
    expect(organizationInventoryCatalog(products).map((item) => item.id)).toEqual([
      "head-office-product",
      "kano-product",
    ]);
  });

  it("keeps branch inventory presentation separate from the shared catalogue", () => {
    const balances = [
      { branchId: "head-office", offeringId: "kano-product" },
    ] as InventoryBalance[];

    expect(
      branchInventoryCatalog(products, balances, "head-office").map((item) => item.id),
    ).toEqual(["head-office-product", "kano-product"]);
    expect(branchInventoryCatalog(products, [], "kano").map((item) => item.id)).toEqual([
      "kano-product",
    ]);
  });
});
