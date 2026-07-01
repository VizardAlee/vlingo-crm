import type { BusinessVertical, DealType } from "@/types/crm";

export function dealCategoryFromFormValue(value: unknown): BusinessVertical | "" {
  return ["realEstate", "solar", "buildingMaterials", "generalServices", "custom"].includes(String(value))
    ? String(value) as BusinessVertical
    : "";
}

export function dealTypeFromFormValue(value: unknown): DealType | "" {
  return ["sale", "rent", "lease", "reservation", "investment", "other"].includes(String(value))
    ? String(value) as DealType
    : "";
}

export function dealVisibleFieldNames(category: BusinessVertical | "", dealType: DealType | "") {
  const initialFields = new Set(["dealCategory", "leadId"]);
  if (!category) {
    return initialFields;
  }

  const commonFields = new Set(["title", "dealCategory", "dealType", "status", "dealOwnerId", "expectedCloseDate", "closeProbability", "leadId", "clientId", "financeStatus", "lostReason", "notes"]);
  const closingFields = new Set(["commissionType", "commissionValue", "commissionAmount"]);
  const realEstateLinkFields = new Set(["propertyId", "unitId"]);
  const catalogLinkFields = new Set(["offeringId"]);
  const catalogQuoteFields = new Set(["offeringQuantity", "offeringUnitPrice", "quoteSubtotal"]);
  const proposalFields = new Set(["proposalStatus", "fulfillmentStatus", "fulfillmentDueDate", "scopeOfWork", "deliveryNotes"]);
  const fields = new Set(commonFields);

  function add(names: Iterable<string>) {
    for (const name of names) {
      fields.add(name);
    }
  }

  if (category === "realEstate") {
    add(realEstateLinkFields);
    if (dealType === "reservation") {
      add(["reservationAmount", "depositAmount", "paymentPlan"]);
      return fields;
    }

    if (dealType === "rent" || dealType === "lease") {
      add(["agreedAmount", "depositAmount", "paymentPlan", "legalStatus"]);
      add(closingFields);
      return fields;
    }

    if (dealType === "sale" || dealType === "investment") {
      add(["offerAmount", "agreedAmount", "depositAmount", "paymentPlan", "legalStatus"]);
      add(closingFields);
      return fields;
    }

    add(["agreedAmount", "depositAmount", "paymentPlan"]);
    add(closingFields);
    return fields;
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
    return ["sale", "rent", "lease", "reservation", "investment", "other"];
  }

  if (category === "solar" || category === "buildingMaterials") {
    return ["sale", "reservation", "other"];
  }

  if (category === "generalServices" || category === "custom") {
    return ["sale", "lease", "reservation", "other"];
  }

  return ["sale", "rent", "lease", "reservation", "investment", "other"];
}
