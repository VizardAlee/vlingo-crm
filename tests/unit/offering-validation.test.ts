import { describe, expect, it } from "vitest";
import { offeringSchema } from "../../src/lib/validation/schemas";

const baseOffering = {
  category: "Inverters",
  name: "5kVA inverter",
  status: "active" as const,
  tags: "",
  type: "solarEquipment" as const,
  vertical: "solar" as const,
};

describe("offering inventory validation", () => {
  it("requires and preserves a brand for inventory products", () => {
    expect(offeringSchema.safeParse(baseOffering).success).toBe(false);

    const result = offeringSchema.parse({ ...baseOffering, brandId: "sorotec", brandName: "Sorotec" });
    expect(result.brandId).toBe("sorotec");
    expect(result.brandName).toBe("Sorotec");
  });

  it("allows non-stock services without a brand", () => {
    expect(offeringSchema.safeParse({ ...baseOffering, type: "consultancy", vertical: "generalServices" }).success).toBe(true);
  });

  it("preserves an optional wholesale price", () => {
    const result = offeringSchema.parse({
      ...baseOffering,
      brandId: "sorotec",
      sellingPrice: 1000,
      wholesalePrice: 850,
    });

    expect(result.sellingPrice).toBe(1000);
    expect(result.wholesalePrice).toBe(850);
  });

  it("strips legacy stock quantity from catalog submissions", () => {
    const result = offeringSchema.parse({
      ...baseOffering,
      brandId: "sorotec",
      stockQuantity: 250,
    });

    expect(result).not.toHaveProperty("stockQuantity");
  });
});
