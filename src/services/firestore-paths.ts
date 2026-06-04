export type OrgCollection =
  | "activities"
  | "auditLogs"
  | "branches"
  | "clients"
  | "documents"
  | "leads"
  | "members"
  | "properties"
  | "propertyUnits"
  | "roles"
  | "tasks";

export function orgPath(organizationId: string) {
  return `organizations/${organizationId}`;
}

export function orgCollectionPath(organizationId: string, collectionName: OrgCollection) {
  return `${orgPath(organizationId)}/${collectionName}`;
}
