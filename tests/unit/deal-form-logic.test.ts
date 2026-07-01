import { describe, expect, it } from "vitest";
import { dealTypesForCategory, dealVisibleFieldNames } from "../../src/features/modules/deal-form-logic";

function visible(category: Parameters<typeof dealVisibleFieldNames>[0], dealType: Parameters<typeof dealVisibleFieldNames>[1]) {
  return dealVisibleFieldNames(category, dealType);
}

describe("deal form visibility rules", () => {
  it("keeps real estate sale fields focused on property, commercial, legal, and commission details", () => {
    const fields = visible("realEstate", "sale");

    expect(fields.has("propertyId")).toBe(true);
    expect(fields.has("unitId")).toBe(true);
    expect(fields.has("offerAmount")).toBe(true);
    expect(fields.has("agreedAmount")).toBe(true);
    expect(fields.has("legalStatus")).toBe(true);
    expect(fields.has("commissionAmount")).toBe(true);
    expect(fields.has("offeringId")).toBe(false);
    expect(fields.has("quoteSubtotal")).toBe(false);
    expect(fields.has("fulfillmentStatus")).toBe(false);
  });

  it("keeps reservations slim and removes closing or fulfillment-only fields", () => {
    const fields = visible("realEstate", "reservation");

    expect(fields.has("propertyId")).toBe(true);
    expect(fields.has("reservationAmount")).toBe(true);
    expect(fields.has("depositAmount")).toBe(true);
    expect(fields.has("offerAmount")).toBe(false);
    expect(fields.has("agreedAmount")).toBe(false);
    expect(fields.has("legalStatus")).toBe(false);
    expect(fields.has("commissionAmount")).toBe(false);
    expect(fields.has("fulfillmentStatus")).toBe(false);
  });

  it("shows catalog quote and fulfillment fields for product sales", () => {
    const fields = visible("solar", "sale");

    expect(fields.has("offeringId")).toBe(true);
    expect(fields.has("offeringQuantity")).toBe(true);
    expect(fields.has("offeringUnitPrice")).toBe(true);
    expect(fields.has("quoteSubtotal")).toBe(true);
    expect(fields.has("agreedAmount")).toBe(true);
    expect(fields.has("proposalStatus")).toBe(true);
    expect(fields.has("fulfillmentStatus")).toBe(true);
    expect(fields.has("propertyId")).toBe(false);
    expect(fields.has("offerAmount")).toBe(false);
    expect(fields.has("legalStatus")).toBe(false);
  });

  it("limits deal type choices by business category", () => {
    expect(dealTypesForCategory("buildingMaterials")).toEqual(["sale", "reservation", "other"]);
    expect(dealTypesForCategory("generalServices")).toEqual(["sale", "lease", "reservation", "other"]);
    expect(dealTypesForCategory("realEstate")).toContain("rent");
  });
});
