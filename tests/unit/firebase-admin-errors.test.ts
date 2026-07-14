import { describe, expect, it } from "vitest";
import { firebaseAdminRecovery } from "../../src/lib/firebase/admin-errors";

describe("Firebase Admin recovery guidance", () => {
  it("translates expired reauthentication credentials", () => {
    const recovery = firebaseAdminRecovery(new Error("invalid_grant: invalid_rapt"), "Personal reports");

    expect(recovery?.error).toContain("credentials have expired");
    expect(recovery?.requiredAction).toContain("gcloud auth application-default login");
  });

  it("recognizes gRPC Error-like credential objects", () => {
    const recovery = firebaseAdminRecovery({
      code: 2,
      details: "Getting metadata failed: invalid_grant (invalid_rapt)",
    }, "Personal reports");

    expect(recovery?.error).toContain("credentials have expired");
  });

  it("does not expose unrelated backend failures", () => {
    expect(firebaseAdminRecovery(new Error("unexpected database failure"), "Personal reports")).toBeNull();
  });
});
