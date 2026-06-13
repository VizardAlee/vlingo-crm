import { describe, expect, it } from "vitest";
import { activitySchema, rentalTenancySchema, taskSchema } from "../../src/lib/validation/schemas";

describe("CRM validation schemas", () => {
  it("treats untouched optional dropdowns as unset values", () => {
    const task = taskSchema.parse({
      assignedTo: "",
      dueAt: "",
      priority: "medium",
      relatedEntityId: "",
      relatedEntityType: "",
      status: "notStarted",
      title: "Call back client",
    });
    expect(task.relatedEntityType).toBeUndefined();

    const activity = activitySchema.parse({
      relatedEntityId: "",
      relatedEntityType: "",
      subject: "Introductory call",
      type: "phoneCall",
    });
    expect(activity.relatedEntityType).toBeUndefined();

    const rental = rentalTenancySchema.parse({
      agreementStatus: "",
      paymentCycle: "annual",
      paymentStatus: "",
      propertyId: "property-1",
      rentAmount: "750000",
      status: "draft",
      tenantClientId: "client-1",
    });
    expect(rental.agreementStatus).toBeUndefined();
    expect(rental.paymentStatus).toBeUndefined();
  });
});
