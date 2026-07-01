import type { GuidedTourStep } from "@/components/tour/guided-tour";
import type { ModuleConfig } from "@/features/modules/module-config";

export function fieldTourTarget(collection: string, fieldName: string) {
  return `module-${collection}-${fieldName}`;
}

export function uniqueTourSteps(steps: GuidedTourStep[]) {
  const seenTargets = new Set<string>();
  return steps.filter((step) => {
    if (seenTargets.has(step.target)) {
      return false;
    }

    seenTargets.add(step.target);
    return true;
  });
}

export function formTourSteps(config: ModuleConfig): GuidedTourStep[] {
  if (config.collection === "deals") {
    return [
      {
        body: "Choose the business line first. The form then shows only the fields that fit that deal category and type.",
        target: fieldTourTarget(config.collection, "dealCategory"),
        title: "Choose the category",
      },
      {
        body: "Link the original lead when this deal started from an enquiry. The deal keeps that source history without duplicating the lead.",
        target: fieldTourTarget(config.collection, "leadId"),
        title: "Connect the lead",
      },
      {
        body: "Give the opportunity a clear name. This becomes the label sales, finance, and management will recognize in lists and receipts.",
        target: fieldTourTarget(config.collection, "title"),
        title: "Name the deal",
      },
      {
        body: "Attach the relevant record: property/unit for real estate, or catalog offering for products and services.",
        target: fieldTourTarget(config.collection, "clientId"),
        title: "Link the context",
      },
      {
        body: "Record the active commercial value. Depending on the deal type, this may be agreed amount, reservation amount, or the calculated quote subtotal.",
        target: fieldTourTarget(config.collection, "agreedAmount"),
        title: "Set the value",
      },
      {
        body: "Track whether the deal has been invoiced, partly paid, fully paid, or overdue. This keeps sales and finance looking at the same status.",
        target: fieldTourTarget(config.collection, "financeStatus"),
        title: "Sync finance status",
      },
      {
        body: "Save writes the linked IDs and readable names together, so detail pages, receipts, documents, and reports do not break if users navigate later.",
        target: fieldTourTarget(config.collection, "save"),
        title: "Save the workflow",
      },
    ];
  }

  const requiredSteps = config.fields
    .filter((field) => field.required)
    .slice(0, 3)
    .map((field) => ({
      body: field.helpText ?? `${field.label} is required before this ${config.title.slice(0, -1).toLowerCase()} can be saved.`,
      target: fieldTourTarget(config.collection, field.name),
      title: field.label,
    }));
  const statusField = config.fields.find((field) => field.name === "status" || field.name.endsWith("Status"));

  return uniqueTourSteps([
    ...requiredSteps,
    ...(statusField ? [{
      body: "Use status to keep lists, reports, and follow-up workflows aligned.",
      target: fieldTourTarget(config.collection, statusField.name),
      title: statusField.label,
    }] : []),
    {
      body: "Review the record, then save. You can return later to edit permitted fields.",
      target: fieldTourTarget(config.collection, "save"),
      title: "Save record",
    },
  ]);
}
