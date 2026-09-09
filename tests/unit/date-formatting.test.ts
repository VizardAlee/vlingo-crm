import { describe, expect, it } from "vitest";
import { formatDate } from "../../src/lib/utils";

describe("formatDate", () => {
  it("formats JavaScript dates, strings, and Firestore-like timestamps", () => {
    expect(formatDate(new Date("2026-09-08T12:00:00Z"))).toBe("Sep 8, 2026");
    expect(formatDate("2026-09-08")).toBe("Sep 8, 2026");
    expect(
      formatDate({ toDate: () => new Date("2026-09-08T12:00:00Z") }),
    ).toBe("Sep 8, 2026");
    expect(formatDate({ seconds: 1788868800, nanoseconds: 0 })).toBe(
      "Sep 8, 2026",
    );
  });

  it("does not crash on empty or malformed legacy dates", () => {
    expect(formatDate(undefined)).toBe("Not set");
    expect(formatDate("not-a-date")).toBe("Not set");
    expect(formatDate({ seconds: "invalid" })).toBe("Not set");
  });
});
