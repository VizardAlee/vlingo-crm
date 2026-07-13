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
  | "leads"
  | "marketingCampaigns"
  | "members"
  | "notifications"
  | "offerings"
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
