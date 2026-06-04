export type Permission =
  | "dashboard.viewExecutive"
  | "leads.create"
  | "leads.readAssigned"
  | "leads.readAll"
  | "leads.updateAssigned"
  | "leads.assign"
  | "clients.create"
  | "clients.read"
  | "clients.update"
  | "properties.create"
  | "properties.read"
  | "properties.update"
  | "properties.approve"
  | "units.create"
  | "units.read"
  | "units.update"
  | "tasks.create"
  | "tasks.read"
  | "tasks.update"
  | "activities.create"
  | "activities.read"
  | "reports.viewFinancial"
  | "users.manage"
  | "roles.manage"
  | "auditLogs.read";

export type RoleName =
  | "superAdmin"
  | "managingDirector"
  | "operationsManager"
  | "salesManager"
  | "salesExecutive"
  | "propertyManager"
  | "financeManager"
  | "accountant"
  | "legalOfficer"
  | "projectManager"
  | "marketingOfficer"
  | "customerServiceOfficer"
  | "frontDeskOfficer"
  | "agent"
  | "auditor";

export type MembershipStatus = "active" | "invited" | "disabled";

export interface EntityMetadata {
  organizationId: string;
  branchId: string;
  createdAt?: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy: string;
  status: string;
  assignedTo?: string;
  teamId?: string;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  legalName: string;
  primaryColor: string;
  logoUrl: string;
  status: "active" | "disabled";
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string;
  status: "active" | "closed";
}

export interface Member {
  id: string;
  organizationId: string;
  branchId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  role: RoleName;
  permissions: Permission[];
  status: MembershipStatus;
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "propertyRecommended"
  | "inspectionScheduled"
  | "inspectionCompleted"
  | "negotiation"
  | "offerMade"
  | "paymentPending"
  | "converted"
  | "lost"
  | "dormant";

export interface Lead extends EntityMetadata {
  id: string;
  referenceNumber: string;
  fullName: string;
  phoneNumber: string;
  whatsappNumber?: string;
  email?: string;
  contactPreference?: string;
  preferredLocation?: string;
  preferredState?: string;
  preferredCity?: string;
  propertyType?: string;
  preferredPropertyCategory?: string;
  preferredBedrooms?: number;
  budgetMinimum?: number;
  budgetMaximum?: number;
  preferredBudgetCurrency?: string;
  transactionInterest: "buy" | "rent" | "lease" | "invest";
  intendedUse?: string;
  paymentPreference?: string;
  preferredInspectionDate?: Date | null;
  source: string;
  sourcePlatform?: string;
  campaignName?: string;
  sourceReference?: string;
  referralName?: string;
  referralPhone?: string;
  assignedAgentId?: string;
  score: number;
  leadTemperature?: "cold" | "warm" | "hot";
  status: LeadStatus;
  tags: string[];
  notes?: string;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
  lostReason?: string;
}

export interface Client extends EntityMetadata {
  id: string;
  referenceNumber: string;
  clientType: "individual" | "corporate";
  category: string;
  fullName: string;
  companyName?: string;
  phoneNumber: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  occupation?: string;
  employer?: string;
  identificationType?: string;
  identificationNumber?: string;
  taxIdentificationNumber?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  preferredCommunicationMethod?: string;
  assignedRelationshipManager?: string;
  tags: string[];
  notes?: string;
}

export type PropertyStatus =
  | "draft"
  | "available"
  | "reserved"
  | "underNegotiation"
  | "sold"
  | "rented"
  | "leased"
  | "occupied"
  | "vacant"
  | "underMaintenance"
  | "unavailable"
  | "withdrawn";

export interface Property extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  category: string;
  transactionTypes: string[];
  description?: string;
  address: string;
  state: string;
  localGovernmentArea?: string;
  city: string;
  estateOrNeighborhood?: string;
  latitude?: number;
  longitude?: number;
  propertyOwnerId?: string;
  developerName?: string;
  assignedManager?: string;
  listingStatus: string;
  propertyStatus: PropertyStatus;
  marketingStatus: string;
  dateListed?: Date | null;
  askingPrice?: number;
  minimumAcceptablePrice?: number;
  rentAmount?: number;
  serviceCharge?: number;
  cautionFee?: number;
  legalFee?: number;
  agencyFee?: number;
  commissionType?: string;
  commissionValue?: number;
  features: string[];
  titleType?: string;
  titleStatus?: string;
}

export interface PropertyUnit extends EntityMetadata {
  id: string;
  referenceNumber: string;
  propertyId: string;
  phase?: string;
  block?: string;
  floor?: string;
  plotNumber?: string;
  unitNumber: string;
  size?: number;
  sizeUnit?: string;
  bedrooms?: number;
  bathrooms?: number;
  askingPrice?: number;
  rentAmount?: number;
  status: PropertyStatus;
  reservationExpiresAt?: Date | null;
}

export type TaskStatus = "notStarted" | "inProgress" | "waiting" | "completed" | "cancelled" | "overdue";

export interface Task extends EntityMetadata {
  id: string;
  title: string;
  description?: string;
  dueAt?: Date | null;
  priority: "low" | "medium" | "high" | "urgent";
  relatedEntityType?: "lead" | "client" | "property" | "unit";
  relatedEntityId?: string;
  status: TaskStatus;
}

export type ActivityType =
  | "phoneCall"
  | "whatsappMessage"
  | "email"
  | "sms"
  | "meeting"
  | "inspection"
  | "followUp"
  | "documentRequest"
  | "paymentReminder"
  | "complaint"
  | "internalNote";

export interface Activity extends EntityMetadata {
  id: string;
  type: ActivityType;
  subject: string;
  body?: string;
  relatedEntityType?: "lead" | "client" | "property" | "unit" | "task";
  relatedEntityId?: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  branchId: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt?: Date;
}
