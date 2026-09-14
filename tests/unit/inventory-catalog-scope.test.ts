import { describe, expect, it } from "vitest";
import {
  branchInventoryCatalog,
  filterInventoryMovementItems,
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

  it("combines brand, type, category, location, and text filters", () => {
    const filterProducts = [
      {
        id: "panel",
        name: "620W Solar Panel",
        brandId: "red",
        brandName: "Red Solar",
        type: "solarEquipment",
        category: "Panels",
        sku: "RED-620",
      },
      {
        id: "inverter",
        name: "5kVA Inverter",
        brandId: "sorotec",
        brandName: "Sorotec",
        type: "solarEquipment",
        category: "Inverters",
        sku: "REVO-5K",
      },
    ] as Offering[];
    const balances = [
      { offeringId: "panel", locationId: "kano" },
      { offeringId: "inverter", locationId: "kaduna" },
    ] as InventoryBalance[];

    expect(
      filterInventoryMovementItems(filterProducts, balances, {
        search: "620",
        brandId: "red",
        productType: "solarEquipment",
        category: "Panels",
        locationId: "kano",
      }).map((item) => item.id),
    ).toEqual(["panel"]);
    expect(
      filterInventoryMovementItems(filterProducts, balances, {
        search: "",
        brandId: "",
        productType: "",
        category: "",
        locationId: "",
      }),
    ).toHaveLength(2);
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
