import { describe, expect, it } from "vitest";
import { matchesCustomerSearch, normalizedCustomerPhone } from "../../functions/src/pos-customers";

const customer = {
  fullName: "Amina Yusuf",
  companyName: "Amina Ventures",
  phoneNumber: "0803 123 4567",
  email: "amina@example.com",
  referenceNumber: "CLIENT-20260915-AB123",
};

describe("POS customer matching", () => {
  it("normalizes Nigerian local and international phone formats consistently", () => {
    expect(normalizedCustomerPhone("+234 803 123 4567")).toBe("08031234567");
    expect(normalizedCustomerPhone("0803-123-4567")).toBe("08031234567");
  });

  it("matches repeat customers by name, company, phone, email, or reference", () => {
    expect(matchesCustomerSearch(customer, "amina ventures")).toBe(true);
    expect(matchesCustomerSearch(customer, "0803 123")).toBe(true);
    expect(matchesCustomerSearch(customer, "+2348031234567")).toBe(true);
    expect(matchesCustomerSearch(customer, "ab123")).toBe(true);
    expect(matchesCustomerSearch(customer, "not this customer")).toBe(false);
  });
});
