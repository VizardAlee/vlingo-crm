import { describe, expect, it } from "vitest";
import { formatCurrency, statusTone, titleCase } from "../../src/lib/utils";

describe("CRM utilities", () => {
  it("formats Nigerian Naira", () => {
    expect(formatCurrency(25000000)).toBe("₦25,000,000");
  });

  it("maps statuses to badge tones", () => {
    expect(statusTone("qualified")).toBe("success");
    expect(statusTone("lost")).toBe("danger");
  });

  it("formats enum labels", () => {
    expect(titleCase("propertyRecommended")).toBe("Property Recommended");
  });
});
