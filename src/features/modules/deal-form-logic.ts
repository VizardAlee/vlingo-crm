import type { BusinessVertical, DealType } from "@/types/crm";

export function dealCategoryFromFormValue(value: unknown): BusinessVertical | "" {
  return ["solar", "buildingMaterials", "generalServices", "custom"].includes(String(value))
    ? String(value) as BusinessVertical
    : "";
}

export function dealTypeFromFormValue(value: unknown): DealType | "" {
  return ["sale", "lease", "reservation", "other"].includes(String(value))
    ? String(value) as DealType
    : "";
}

export function dealVisibleFieldNames(category: BusinessVertical | "", dealType: DealType | "") {
  const initialFields = new Set(["dealCategory", "leadId"]);
  if (!category || category === "realEstate") {
    return initialFields;
  }

  const commonFields = new Set(["title", "dealCategory", "dealType", "status", "dealOwnerId", "expectedCloseDate", "closeProbability", "leadId", "clientId", "financeStatus", "lostReason", "notes"]);
  const closingFields = new Set(["commissionType", "commissionValue", "commissionAmount"]);
  const catalogLinkFields = new Set(["offeringId"]);
  const catalogQuoteFields = new Set(["offeringQuantity", "offeringUnitPrice", "quoteSubtotal"]);
  const proposalFields = new Set(["proposalStatus", "fulfillmentStatus", "fulfillmentDueDate", "scopeOfWork", "deliveryNotes"]);
  const fields = new Set(commonFields);

  function add(names: Iterable<string>) {
    for (const name of names) {
      fields.add(name);
    }
  }

  add(catalogLinkFields);
  if (dealType === "reservation") {
    add(["reservationAmount", "depositAmount", "paymentPlan"]);
    return fields;
  }

  if (dealType === "sale") {
    add(catalogQuoteFields);
    add(["agreedAmount", "depositAmount"]);
    add(proposalFields);
    add(closingFields);
    return fields;
  }

  if (dealType === "lease") {
    add(["agreedAmount", "depositAmount", "paymentPlan"]);
    add(proposalFields);
    add(closingFields);
    return fields;
  }

  add(["agreedAmount", "depositAmount", "paymentPlan", "scopeOfWork", "deliveryNotes"]);
  add(closingFields);
  return fields;
}

export function dealTypesForCategory(category: BusinessVertical | "") {
  if (category === "realEstate") {
    return [];
  }

  if (category === "solar" || category === "buildingMaterials") {
    return ["sale", "reservation", "other"];
  }

  if (category === "generalServices" || category === "custom") {
    return ["sale", "lease", "reservation", "other"];
  }

  return ["sale", "lease", "reservation", "other"];
}
