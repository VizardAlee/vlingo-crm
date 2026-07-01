import { describe, expect, it } from "vitest";
import { formTourSteps } from "../../src/features/modules/form-tour";
import type { ModuleConfig } from "../../src/features/modules/module-config";

describe("form tour steps", () => {
  it("covers every visible deal field plus save", () => {
    const config: ModuleConfig = {
      collection: "deals",
      createPermission: "deals.create",
      editPermission: "deals.update",
      emptyTitle: "No deals have been opened yet.",
      fields: [
        { name: "title", label: "Deal title", type: "text" },
        { name: "dealCategory", label: "Deal category", type: "select" },
        { name: "dealType", label: "Deal type", type: "select" },
        { name: "status", label: "Deal stage", type: "select" },
        { name: "leadId", label: "Linked lead", type: "select" },
      ],
      listPermission: "deals.read",
      prefix: "DEAL",
      route: "/deals",
      title: "Deals",
    };
    const steps = formTourSteps(config, config.fields);
    const targets = steps.map((step) => step.target);

    expect(targets).toEqual([
      "module-deals-title",
      "module-deals-dealCategory",
      "module-deals-dealType",
      "module-deals-status",
      "module-deals-leadId",
      "module-deals-save",
    ]);
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
