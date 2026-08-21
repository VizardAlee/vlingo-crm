import { describe, expect, it } from "vitest";
import { nairaAmountInWords } from "../../src/features/pos/pos-document-utils";

describe("POS document amount wording", () => {
  it("formats official whole-naira amounts", () => {
    expect(nairaAmountInWords(82_800_000)).toBe("Eighty-Two Million Eight Hundred Thousand Naira Only");
    expect(nairaAmountInWords(5_860_000)).toBe("Five Million Eight Hundred and Sixty Thousand Naira Only");
  });

  it("includes kobo when present", () => {
    expect(nairaAmountInWords(1_250.5)).toBe("One Thousand Two Hundred and Fifty Naira and Fifty Kobo Only");
  });
});
