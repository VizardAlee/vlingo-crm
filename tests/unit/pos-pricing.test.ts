import { describe, expect, it } from "vitest";
import { resolvePosPrice } from "../../functions/src/pos-pricing";

describe("POS unit-price adjustments", () => {
  it("uses retail price by default", () => {
    expect(resolvePosPrice({ retailPrice: 1000, wholesalePrice: 850, requestedUnitPrice: undefined })).toMatchObject({
      unitPrice: 1000,
      priceSource: "retail",
      priceAdjustment: 0,
    });
  });

  it("recognizes wholesale and custom prices", () => {
    expect(resolvePosPrice({ retailPrice: 1000, wholesalePrice: 850, requestedUnitPrice: 850 }).priceSource).toBe("wholesale");
    expect(resolvePosPrice({ retailPrice: 1000, wholesalePrice: 850, requestedUnitPrice: 925 })).toMatchObject({
      unitPrice: 925,
      priceSource: "adjusted",
      priceAdjustment: -75,
    });
  });

  it("rejects negative or invalid prices", () => {
    expect(() => resolvePosPrice({ retailPrice: 1000, wholesalePrice: 850, requestedUnitPrice: -1 })).toThrow();
    expect(() => resolvePosPrice({ retailPrice: "invalid", wholesalePrice: undefined, requestedUnitPrice: undefined })).toThrow();
  });
});
