export type OrgCollection =
  | "activities"
  | "auditLogs"
  | "branches"
  | "clients"
  | "deals"
  | "developmentProjects"
  | "documents"
  | "financeCommissions"
  | "financeExpenses"
  | "financePayments"
  | "internalAiGuideUsage"
  | "inventoryBalances"
  | "inventoryBrands"
  | "inventoryComments"
  | "inventoryLocations"
  | "inventoryLots"
  | "inventoryMovements"
  | "inventoryPurchaseOrders"
  | "inventoryReservations"
  | "inventorySerials"
  | "inventoryStockCounts"
  | "inventorySuppliers"
  | "installationProjects"
  | "installationInvoices"
  | "leads"
  | "marketingCampaigns"
  | "members"
  | "notifications"
  | "offerings"
  | "posSales"
  | "properties"
  | "propertyStakeholders"
  | "propertyUnits"
  | "pushSubscriptions"
  | "rentalTenancies"
  | "roles"
  | "tasks";

export function orgPath(organizationId: string) {
  return `organizations/${organizationId}`;
}

export function orgCollectionPath(organizationId: string, collectionName: OrgCollection) {
  return `${orgPath(organizationId)}/${collectionName}`;
}
