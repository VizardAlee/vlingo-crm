export type OrgCollection =
  | "activities"
  | "auditLogs"
  | "branches"
  | "clients"
  | "developmentProjects"
  | "documents"
  | "leads"
  | "marketingCampaigns"
  | "members"
  | "properties"
  | "propertyStakeholders"
  | "propertyUnits"
  | "rentalTenancies"
  | "roles"
  | "tasks";

export function orgPath(organizationId: string) {
  return `organizations/${organizationId}`;
}

export function orgCollectionPath(organizationId: string, collectionName: OrgCollection) {
  return `${orgPath(organizationId)}/${collectionName}`;
}
