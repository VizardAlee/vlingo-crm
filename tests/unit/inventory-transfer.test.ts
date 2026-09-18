import { describe, expect, it } from "vitest";
import { canUseInventoryDestination } from "../../functions/src/inventory-transfer";

describe("inventory transfer destination access", () => {
  it("allows an active organization branch as a transfer destination without branch access", () => {
    expect(
      canUseInventoryDestination({
        activeBranchId: "kano",
        actorCanAccessDestination: false,
        destinationBranchId: "kaduna",
        destinationExists: true,
        destinationIsCanonicalBranch: true,
        movementType: "transfer",
      }),
    ).toBe(true);
  });

  it("rejects legacy or missing locations as cross-branch transfer destinations", () => {
    const input = {
      activeBranchId: "kano",
      actorCanAccessDestination: false,
      destinationBranchId: "kaduna",
      destinationExists: true,
      destinationIsCanonicalBranch: false,
      movementType: "transfer",
    };
    expect(canUseInventoryDestination(input)).toBe(false);
    expect(
      canUseInventoryDestination({ ...input, destinationExists: false }),
    ).toBe(false);
  });

  it("keeps non-transfer destinations inside an accessible active branch", () => {
    const input = {
      activeBranchId: "kano",
      actorCanAccessDestination: true,
      destinationBranchId: "kano",
      destinationExists: true,
      destinationIsCanonicalBranch: true,
      movementType: "receipt",
    };
    expect(canUseInventoryDestination(input)).toBe(true);
    expect(
      canUseInventoryDestination({
        ...input,
        actorCanAccessDestination: false,
        destinationBranchId: "kaduna",
      }),
    ).toBe(false);
  });
});
