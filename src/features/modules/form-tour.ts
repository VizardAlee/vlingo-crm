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

const dealFieldGuideText: Record<string, string> = {
  agreedAmount: "Enter the amount both sides have accepted. Finance uses this value when tracking payments, balances, commissions, and receipts.",
  clientId: "Link the client when a customer profile already exists. Leave it empty until the lead is converted or a client record is created.",
  closeProbability: "Estimate how likely this deal is to close. This helps managers read the pipeline without opening every record.",
  commissionAmount: "This is calculated from the commission type and value. It helps finance understand the expected payout from the deal.",
  commissionType: "Choose whether commission is a percentage, fixed amount, or not applicable for this deal.",
  commissionValue: "Enter the commission percentage or fixed value. The calculated commission amount updates from this input.",
  dealCategory: "Choose the business line first. The form then shows only fields relevant to that category.",
  dealOwnerId: "Assign the internal person responsible for moving this deal forward. The owner controls follow-up and accountability.",
  dealType: "Choose the commercial shape of the deal. The selected type changes which pricing, proposal, reservation, and fulfillment fields are needed.",
  deliveryNotes: "Record delivery, installation, handover, or fulfillment details that the operations team will need.",
  depositAmount: "Capture the upfront deposit or initial commitment amount when the deal requires one.",
  expectedCloseDate: "Set the date the team expects this deal to close. This supports planning, reporting, and follow-up priority.",
  financeStatus: "Track whether the deal is not invoiced, pending payment, partly paid, paid, or overdue.",
  fulfillmentDueDate: "Set the expected delivery, installation, service, or handover date for non-property and service deals.",
  fulfillmentStatus: "Track the operational stage after the commercial terms are agreed, such as procurement, scheduled, delivered, or completed.",
  leadId: "Link the original lead when this deal started from an enquiry. This preserves source history and avoids duplicate entry.",
  legalStatus: "Track legal document progress where contracts, leases, sale documents, or agreements are required.",
  lostReason: "If the deal is lost or dormant, record the reason so reporting and sales learning stay useful.",
  notes: "Add internal deal notes, context, risks, next steps, or decisions that do not fit a structured field.",
  offerAmount: "Record the proposed amount before final agreement. This is useful during negotiation.",
  offeringId: "Link the catalog offering for solar, building materials, consultancy, installation, or other product/service deals.",
  offeringQuantity: "Enter the number of units, packages, services, or project items being quoted.",
  offeringUnitPrice: "Enter the price per unit or service item. The quote subtotal is calculated from quantity and unit price.",
  paymentPlan: "Describe installment terms, payment milestones, or any agreed schedule for collection.",
  proposalStatus: "Track whether a proposal or quotation is being drafted, sent, accepted, rejected, or expired.",
  propertyId: "Link the property involved in a real-estate deal so finance, documents, inspections, and activities share context.",
  quoteSubtotal: "This is calculated from quantity and unit price. It gives the commercial subtotal for catalog-based deals.",
  reservationAmount: "Capture the reservation amount for deals where the customer is holding a property, unit, product, or service slot.",
  scopeOfWork: "Describe the service, installation, project, order, or fulfillment scope agreed with the customer.",
  status: "Set the deal stage so the pipeline, dashboards, and follow-up workflows stay accurate.",
  title: "Give the opportunity a clear name that sales, finance, and management can recognize in lists and receipts.",
  unitId: "Link the exact unit when the deal is for a specific apartment, shop, land plot, or other inventory unit.",
};

export function formTourSteps(config: ModuleConfig, visibleFields: ModuleConfig["fields"] = config.fields): GuidedTourStep[] {
  if (config.collection === "deals") {
    return uniqueTourSteps([
      ...visibleFields.map((field) => ({
        body: field.helpText ?? dealFieldGuideText[field.name] ?? `${field.label} captures important deal information used by sales, operations, finance, and reporting.`,
        target: fieldTourTarget(config.collection, field.name),
        title: field.label,
      })),
      {
        body: "Save writes the linked IDs and readable names together, so detail pages, receipts, documents, and reports do not break if users navigate later.",
        target: fieldTourTarget(config.collection, "save"),
        title: "Save the workflow",
      },
    ]);
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
