import { describe, expect, it } from "vitest";
import { formTourSteps } from "../../src/features/modules/form-tour";

describe("form tour steps", () => {
  it("starts the deal guide on the category selector because the rest of the form is dynamic", () => {
    const steps = formTourSteps({
      collection: "deals",
      createPermission: "deals.create",
      editPermission: "deals.update",
      emptyTitle: "No deals have been opened yet.",
      fields: [],
      listPermission: "deals.read",
      prefix: "DEAL",
      route: "/deals",
      title: "Deals",
    });

    expect(steps[0]?.target).toBe("module-deals-dealCategory");
  });

  it("keeps development guide targets unique", () => {
    const steps = formTourSteps({
      collection: "developmentProjects",
      createPermission: "development.create",
      editPermission: "development.update",
      emptyTitle: "No development projects have been created yet.",
      fields: [
        { name: "name", label: "Project name", required: true, type: "text" },
        { name: "projectType", label: "Project type", required: true, type: "select" },
        { name: "status", label: "Project status", required: true, type: "select" },
      ],
      listPermission: "development.read",
      prefix: "DEV",
      route: "/development",
      title: "Development Projects",
    });
    const targets = steps.map((step) => step.target);

    expect(new Set(targets).size).toBe(targets.length);
    expect(targets.filter((target) => target === "module-developmentProjects-status")).toHaveLength(1);
  });
});
