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
  | "deals.create"
  | "deals.read"
  | "deals.update"
  | "properties.create"
  | "properties.read"
  | "properties.update"
  | "properties.approve"
  | "units.create"
  | "units.read"
  | "units.update"
  | "rentals.create"
  | "rentals.read"
  | "rentals.update"
  | "development.create"
  | "development.read"
  | "development.update"
  | "installations.create"
  | "installations.read"
  | "installations.update"
  | "marketing.create"
  | "marketing.read"
  | "marketing.update"
  | "offerings.create"
  | "offerings.read"
  | "offerings.update"
  | "inventory.read"
  | "inventory.manageCatalog"
  | "inventory.receive"
  | "inventory.issue"
  | "inventory.adjust"
  | "inventory.transfer"
  | "inventory.viewReports"
  | "inventory.comment"
  | "inventory.procure"
  | "inventory.approve"
  | "inventory.count"
  | "inventory.reserve"
  | "pos.read"
  | "pos.sell"
  | "tasks.create"
  | "tasks.read"
  | "tasks.update"
  | "activities.create"
  | "activities.read"
  | "finance.create"
  | "finance.update"
  | "finance.approve"
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
  | "auditor"
  | "inventoryManager"
  | "brandPartner";

export type MembershipStatus = "active" | "invited" | "disabled";
export type BranchAccess = "own" | "all";

export interface EntityMetadata {
  organizationId: string;
  branchId: string;
  createdAt?: Date;
  createdBy: string;
  createdByEmail?: string;
  createdByName?: string;
  updatedAt?: Date;
  updatedBy: string;
  updatedByEmail?: string;
  updatedByName?: string;
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
  branchAccess?: BranchAccess;
  displayName: string;
  email: string;
  phoneNumber?: string;
  role: RoleName;
  roles?: RoleName[];
  permissions: Permission[];
  partnerBrandIds?: string[];
  partnerBranchIds?: string[];
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
  geoAddress?: string;
  geoLatitude?: number;
  geoLongitude?: number;
  geoAccuracy?: number;
  geoCapturedAt?: string;
  propertyType?: string;
  preferredPropertyCategory?: string;
  preferredBedrooms?: number;
  budgetMinimum?: number;
  budgetMaximum?: number;
  preferredBudgetCurrency?: string;
  interestCategory?: BusinessVertical;
  transactionInterest: "buy" | "rent" | "lease" | "invest";
  propertyId?: string;
  propertyName?: string;
  propertyReferenceNumber?: string;
  unitId?: string;
  unitName?: string;
  offeringId?: string;
  offeringName?: string;
  offeringReferenceNumber?: string;
  offeringType?: OfferingType;
  offeringVertical?: BusinessVertical;
  intendedUse?: string;
  paymentPreference?: string;
  preferredInspectionDate?: Date | null;
  source: string;
  sourcePlatform?: string;
  campaignName?: string;
  sourceReference?: string;
  referralName?: string;
  referralPhone?: string;
  assignedToEmail?: string;
  assignedToName?: string;
  assignedAgentId?: string;
  score: number;
  leadTemperature?: "cold" | "warm" | "hot";
  status: LeadStatus;
  tags: string[];
  notes?: string;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
  lostReason?: string;
  clientId?: string;
  convertedAt?: Date | null;
  convertedBy?: string;
  stageHistory?: Array<{
    at: string;
    from: string;
    note: string;
    reason?: string;
    to: string;
    userId: string;
  }>;
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
  sourceLeadId?: string;
}

export type DealStatus =
  | "new"
  | "qualified"
  | "propertyRecommended"
  | "inspectionScheduled"
  | "inspectionCompleted"
  | "negotiation"
  | "offerMade"
  | "paymentPending"
  | "won"
  | "lost"
  | "dormant";

export type DealType =
  | "sale"
  | "rent"
  | "lease"
  | "reservation"
  | "investment"
  | "other";
export type DealFinanceStatus =
  | "notInvoiced"
  | "paymentPending"
  | "partPaid"
  | "paid"
  | "overdue";
export type DealLegalStatus =
  | "notStarted"
  | "drafting"
  | "inReview"
  | "signed"
  | "completed"
  | "blocked";
export type DealProposalStatus =
  | "notStarted"
  | "drafting"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";
export type DealFulfillmentStatus =
  | "notStarted"
  | "awaitingPayment"
  | "procurement"
  | "scheduled"
  | "inProgress"
  | "delivered"
  | "completed"
  | "onHold"
  | "cancelled";

export interface Deal extends EntityMetadata {
  id: string;
  referenceNumber: string;
  title: string;
  dealType: DealType;
  dealCategory?: BusinessVertical;
  leadId?: string;
  leadName?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  propertyId?: string;
  propertyName?: string;
  propertyReferenceNumber?: string;
  unitId?: string;
  unitName?: string;
  offeringId?: string;
  offeringName?: string;
  offeringReferenceNumber?: string;
  offeringType?: OfferingType;
  offeringVertical?: BusinessVertical;
  offeringQuantity?: number;
  offeringUnitPrice?: number;
  quoteSubtotal?: number;
  proposalStatus?: DealProposalStatus;
  fulfillmentStatus?: DealFulfillmentStatus;
  fulfillmentDueDate?: Date | string | null;
  scopeOfWork?: string;
  deliveryNotes?: string;
  dealOwnerId?: string;
  dealOwnerName?: string;
  dealOwnerEmail?: string;
  offerAmount?: number;
  agreedAmount?: number;
  reservationAmount?: number;
  depositAmount?: number;
  expectedCloseDate?: Date | string | null;
  closeProbability?: number;
  paymentPlan?: string;
  financeStatus?: DealFinanceStatus;
  paidAmount?: number;
  pendingPaymentAmount?: number;
  balanceAmount?: number;
  lastPaymentAmount?: number;
  lastPaymentAt?: Date | string | null;
  lastReceiptNumber?: string;
  legalStatus?: DealLegalStatus;
  commissionType?: string;
  commissionValue?: number;
  commissionAmount?: number;
  stageHistory?: Array<{
    at: string;
    from: string;
    note: string;
    reason?: string;
    to: string;
    userId: string;
  }>;
  status: DealStatus;
  lostReason?: string;
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

export type BusinessVertical =
  | "realEstate"
  | "solar"
  | "buildingMaterials"
  | "generalServices"
  | "custom";
export type OfferingType =
  | "property"
  | "unit"
  | "material"
  | "solarEquipment"
  | "solarService"
  | "installationProject"
  | "consultancy"
  | "maintenance"
  | "service"
  | "other";
export type OfferingStatus = "active" | "draft" | "inactive" | "archived";

export interface Offering extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  vertical: BusinessVertical;
  type: OfferingType;
  category: string;
  description?: string;
  sku?: string;
  barcode?: string;
  trackingMode?: "none" | "batch" | "serial";
  unitOfMeasure?: string;
  sellingPrice?: number;
  costPrice?: number;
  stockQuantity?: number;
  brandId?: string;
  brandName?: string;
  reorderLevel?: number;
  supplierName?: string;
  serviceDurationDays?: number;
  tags: string[];
  notes?: string;
  status: OfferingStatus;
}

export interface InventoryBrand extends EntityMetadata {
  id: string;
  name: string;
  code: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  status: "active" | "inactive";
}

export interface InventoryLocation extends EntityMetadata {
  id: string;
  isLegacy?: boolean;
  name: string;
  code: string;
  address?: string;
  locationType: "warehouse" | "store" | "site" | "vehicle" | "other";
  status: "active" | "inactive";
}

export interface InventoryBalance {
  id: string;
  organizationId: string;
  branchId: string;
  brandId: string;
  brandName: string;
  offeringId: string;
  offeringName: string;
  sku?: string;
  locationId: string;
  locationName: string;
  quantityOnHand: number;
  quantityReserved?: number;
  updatedAt?: Date;
  updatedBy: string;
}

export interface InventorySupplier extends EntityMetadata {
  id: string;
  name: string;
  code: string;
  contactName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  brandIds: string[];
  status: "active" | "inactive";
}

export interface InventoryPurchaseOrderLine {
  offeringId: string;
  offeringName: string;
  brandId: string;
  brandName: string;
  sku?: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
}

export type InventoryApprovalStatus =
  | "draft"
  | "pendingApproval"
  | "approved"
  | "rejected"
  | "cancelled";
export type InventoryProcurementPaymentArrangement =
  | "paid"
  | "credit"
  | "partPaid";
export type InventoryProcurementPaymentStatus = "unpaid" | "partPaid" | "paid";
export type InventoryPaymentMethod =
  | "cash"
  | "bankTransfer"
  | "card"
  | "cheque"
  | "other";

export interface InventoryPurchaseOrder extends EntityMetadata {
  id: string;
  referenceNumber: string;
  supplierId: string;
  supplierName: string;
  installationProjectId?: string;
  installationProjectName?: string;
  lines: InventoryPurchaseOrderLine[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentArrangement?: InventoryProcurementPaymentArrangement;
  paymentStatus?: InventoryProcurementPaymentStatus;
  amountPaid?: number;
  balanceDue?: number;
  paymentMethod?: InventoryPaymentMethod;
  paymentReference?: string;
  paymentDueAt?: Date | string;
  lastPaymentAt?: Date | string;
  expectedAt?: Date | string;
  approvalStatus: InventoryApprovalStatus;
  receivingStatus: "notReceived" | "partReceived" | "received";
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface InventoryLot {
  id: string;
  organizationId: string;
  branchId: string;
  brandId: string;
  offeringId: string;
  offeringName: string;
  locationId: string;
  locationName: string;
  batchNumber: string;
  expiryDate?: Date | string;
  quantityOnHand: number;
  quantityReserved?: number;
  updatedAt?: Date;
}

export interface InventorySerial {
  id: string;
  organizationId: string;
  branchId: string;
  brandId: string;
  offeringId: string;
  offeringName: string;
  locationId: string;
  locationName: string;
  serialNumber: string;
  status: "available" | "reserved" | "issued" | "returned";
  reservationId?: string;
  updatedAt?: Date;
}

export interface InventoryStockCountLine {
  offeringId: string;
  offeringName: string;
  brandId: string;
  locationId: string;
  locationName: string;
  systemQuantity: number;
  actualQuantity: number;
  variance: number;
  reason?: string;
}

export interface InventoryStockCount extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  lines: InventoryStockCountLine[];
  approvalStatus: InventoryApprovalStatus;
  countStatus: "draft" | "submitted" | "posted" | "cancelled";
  countedAt: Date | string;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
}

export interface InventoryReservation extends EntityMetadata {
  id: string;
  referenceNumber: string;
  brandId: string;
  brandName: string;
  offeringId: string;
  offeringName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  batchNumber?: string;
  serialNumbers?: string[];
  relatedEntityType?: "deal" | "project" | "workOrder" | "other";
  relatedEntityId?: string;
  relatedEntityName?: string;
  expiresAt?: Date | string;
  reservationStatus: "active" | "released" | "fulfilled" | "expired";
  fulfilledAt?: Date;
  releasedAt?: Date;
  notes?: string;
}

export type InventoryMovementType =
  | "receipt"
  | "issue"
  | "adjustmentIn"
  | "adjustmentOut"
  | "transfer"
  | "returnIn"
  | "returnOut";
export type InventoryMovementPurpose =
  | "sale"
  | "project"
  | "internalUse"
  | "other";

export interface InventoryMovement {
  id: string;
  organizationId: string;
  branchId: string;
  brandId: string;
  brandName: string;
  offeringId: string;
  offeringName: string;
  sku?: string;
  movementType: InventoryMovementType;
  movementPurpose?: InventoryMovementPurpose;
  quantity: number;
  fromBranchId?: string;
  fromLocationId?: string;
  fromLocationName?: string;
  toBranchId?: string;
  toLocationId?: string;
  toLocationName?: string;
  referenceNumber: string;
  externalReference?: string;
  notes?: string;
  batchNumber?: string;
  expiryDate?: Date | string;
  serialNumbers?: string[];
  purchaseOrderId?: string;
  reservationId?: string;
  occurredAt: Date | string;
  createdAt?: Date;
  createdBy: string;
  createdByEmail?: string;
  createdByName?: string;
  isDeleted: false;
}

export interface InventoryComment {
  id: string;
  organizationId: string;
  branchId: string;
  brandId: string;
  message: string;
  reportPeriod?: string;
  createdAt?: Date;
  createdBy: string;
  createdByEmail?: string;
  createdByName?: string;
  isDeleted: false;
}

export type PosPaymentStatus = "unpaid" | "partPaid" | "paid";
export type PosSaleStatus = "completed" | "void";

export interface PosSaleLine {
  offeringId: string;
  offeringName: string;
  brandId: string;
  brandName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  unitCost?: number;
}

export interface PosPaymentEntry {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  at: Date | string;
  method: RentalPaymentMethod;
  paymentReference?: string;
  recordedBy: string;
}

export interface PosSale extends EntityMetadata {
  id: string;
  branchCode?: string;
  referenceNumber: string;
  invoiceNumber: string;
  receiptNumber?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  lines: PosSaleLine[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PosPaymentStatus;
  paymentMethod?: RentalPaymentMethod;
  paymentReference?: string;
  paymentHistory?: PosPaymentEntry[];
  saleStatus: PosSaleStatus;
  soldAt: Date | string;
  notes?: string;
  voidedAt?: Date | string;
  voidedBy?: string;
  voidReason?: string;
}

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
  landmark?: string;
  latitude?: number;
  longitude?: number;
  size?: number;
  sizeUnit?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  parkingSpaces?: number;
  floors?: number;
  unitsCount?: number;
  furnishingStatus?: string;
  propertyOwnerId?: string;
  developerId?: string;
  managementCompanyId?: string;
  developerName?: string;
  assignedManager?: string;
  listingStatus: string;
  propertyStatus: PropertyStatus;
  marketingStatus: string;
  dateListed?: Date | null;
  availabilityDate?: Date | null;
  askingPrice?: number;
  minimumAcceptablePrice?: number;
  rentAmount?: number;
  serviceCharge?: number;
  cautionFee?: number;
  legalFee?: number;
  agencyFeeType?: string;
  agencyFeeValue?: number;
  agencyFee?: number;
  commissionType?: string;
  commissionValue?: number;
  commissionAmount?: number;
  features: string[];
  titleType?: string;
  titleStatus?: string;
  surveyPlanNumber?: string;
  registrationNumber?: string;
  legalNotes?: string;
  virtualTourUrl?: string;
  brochureUrl?: string;
  mediaFolderUrl?: string;
  inspectionNotes?: string;
}

export interface PropertyStakeholder extends EntityMetadata {
  id: string;
  referenceNumber: string;
  email?: string;
  name: string;
  notes?: string;
  phoneNumber?: string;
  status: "active" | "inactive";
  type: "developer" | "management" | "owner";
}

export interface PropertyUnit extends EntityMetadata {
  id: string;
  referenceNumber: string;
  propertyId: string;
  propertyName?: string;
  propertyReferenceNumber?: string;
  phase?: string;
  block?: string;
  floor?: string;
  plotNumber?: string;
  unitNumber: string;
  unitType?: string;
  size?: number;
  sizeUnit?: string;
  bedrooms?: number;
  bathrooms?: number;
  toilets?: number;
  parkingSpaces?: number;
  furnishingStatus?: string;
  features?: string[];
  askingPrice?: number;
  rentAmount?: number;
  serviceCharge?: number;
  cautionFee?: number;
  legalFee?: number;
  availabilityDate?: Date | null;
  notes?: string;
  status: PropertyStatus;
  reservationExpiresAt?: Date | null;
}

export type RentalTenancyStatus =
  | "draft"
  | "active"
  | "expiringSoon"
  | "renewalDue"
  | "renewed"
  | "terminated"
  | "defaulting"
  | "movedOut";
export type RentalPaymentStatus =
  | "notInvoiced"
  | "invoiced"
  | "partPaid"
  | "paid"
  | "overdue";
export type RentalPaymentMethod =
  | "bankTransfer"
  | "cash"
  | "pos"
  | "cheque"
  | "onlinePayment"
  | "other";

export interface RentalPaymentRecord {
  amount: number;
  at: string;
  method: RentalPaymentMethod;
  note?: string;
  paymentId?: string;
  reference?: string;
  receiptNumber?: string;
  userId: string;
  verificationStatus?: PaymentVerificationStatus;
}

export interface RentalStatusHistoryEntry {
  at: string;
  fromPaymentStatus?: string;
  fromStatus?: string;
  note: string;
  toPaymentStatus: string;
  toStatus: string;
  userId: string;
}

export interface RentalTenancy extends EntityMetadata {
  id: string;
  referenceNumber: string;
  tenantClientId: string;
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  propertyId: string;
  propertyName?: string;
  unitId?: string;
  unitName?: string;
  landlordOwnerId?: string;
  landlordOwnerName?: string;
  leaseStartDate: Date | null;
  leaseEndDate: Date | null;
  moveInDate?: Date | null;
  moveOutDate?: Date | null;
  rentAmount: number;
  paymentCycle: "monthly" | "quarterly" | "biannual" | "annual" | "oneOff";
  rentDueDay?: number;
  gracePeriodDays?: number;
  serviceCharge?: number;
  cautionFee?: number;
  agencyFee?: number;
  legalFee?: number;
  totalInitialPayment?: number;
  lastPaymentAmount?: number;
  lastPaymentAt?: Date | string | null;
  paymentHistory?: RentalPaymentRecord[];
  paymentStatus?: RentalPaymentStatus;
  statusHistory?: RentalStatusHistoryEntry[];
  renewalNoticeDate?: Date | null;
  nextRentDueDate?: Date | null;
  agreementStatus?: "notStarted" | "drafting" | "sent" | "signed" | "expired";
  status: RentalTenancyStatus;
  notes?: string;
}

export type PaymentVerificationStatus = "pending" | "verified" | "rejected";
export type FinanceApprovalStatus =
  | "pendingApproval"
  | "approved"
  | "rejected"
  | "paid"
  | "void";
export type FinancePaymentSourceType =
  | "deal"
  | "lead"
  | "rental"
  | "property"
  | "unit"
  | "posSale"
  | "installationProject"
  | "other";
export type FinanceRevenueCategory =
  | BusinessVertical
  | "propertySale"
  | "rental"
  | "unitSale"
  | "other";

export interface FinancePayment extends EntityMetadata {
  id: string;
  referenceNumber: string;
  receiptNumber: string;
  sourceType: FinancePaymentSourceType;
  sourceId: string;
  sourceReference?: string;
  tenancyId?: string;
  tenancyReference?: string;
  tenantName?: string;
  payerName: string;
  propertyName?: string;
  revenueCategory?: FinanceRevenueCategory;
  revenueOwnerId?: string;
  revenueOwnerName?: string;
  amount: number;
  at: string;
  method: RentalPaymentMethod;
  paymentReference?: string;
  note?: string;
  verificationStatus: PaymentVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface FinanceExpense extends EntityMetadata {
  id: string;
  referenceNumber: string;
  date: string;
  category: string;
  vendor?: string;
  amount: number;
  method?: RentalPaymentMethod;
  paymentReference?: string;
  description?: string;
  relatedEntityType?:
    | "deal"
    | "property"
    | "unit"
    | "tenancy"
    | "development"
    | "installationProject"
    | "marketing"
    | "offering"
    | "office"
    | "other";
  relatedEntityId?: string;
  approvalStatus: FinanceApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  paidAt?: string;
  paidBy?: string;
}

export interface FinanceCommission extends EntityMetadata {
  id: string;
  referenceNumber: string;
  sourceType: "deal" | "property" | "unit" | "rental";
  sourceId: string;
  sourceReference?: string;
  beneficiaryName: string;
  basis?: string;
  amount: number;
  dueAt?: string;
  approvalStatus: FinanceApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  paidAt?: string;
  paidBy?: string;
}

export type InstallationProjectStatus =
  | "draft"
  | "planning"
  | "awaitingApproval"
  | "approved"
  | "procurement"
  | "scheduled"
  | "inProgress"
  | "commissioning"
  | "completed"
  | "onHold"
  | "cancelled";

export type InstallationCostCategory =
  | "externalMaterial"
  | "labour"
  | "transport"
  | "subcontractor"
  | "permit"
  | "equipmentHire"
  | "other";

export interface InstallationMaterialLine {
  id: string;
  offeringId: string;
  offeringName: string;
  sku?: string;
  brandId?: string;
  brandName?: string;
  quantityRequired: number;
  estimatedUnitCost: number;
  notes?: string;
}

export interface InstallationCostLine {
  id: string;
  category: InstallationCostCategory;
  description: string;
  vendor?: string;
  quantity: number;
  estimatedUnitCost: number;
  actualAmount?: number;
  paymentStatus?: "notPaid" | "partPaid" | "paid" | "credit";
  notes?: string;
}

export interface InstallationProject extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  dealId?: string;
  dealReference?: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  siteAddress: string;
  projectManagerId?: string;
  projectManagerName?: string;
  startDate?: string;
  expectedCompletionDate?: string;
  contractValue: number;
  contingencyAmount?: number;
  amountReceived?: number;
  progressPercent?: number;
  scopeOfWork?: string;
  materials: InstallationMaterialLine[];
  costLines: InstallationCostLine[];
  status: InstallationProjectStatus;
  notes?: string;
}

export interface InstallationInvoice extends EntityMetadata {
  id: string;
  referenceNumber: string;
  invoiceNumber: string;
  installationProjectId: string;
  installationProjectName: string;
  projectReference: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  siteAddress: string;
  description: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt: string;
  dueAt?: string;
  paymentStatus: "unpaid" | "partPaid" | "paid";
  notes?: string;
}

export type NotificationKind =
  | "task"
  | "lead"
  | "rent"
  | "renewal"
  | "activity"
  | "deal"
  | "finance"
  | "system";
export type NotificationTone =
  | "danger"
  | "warning"
  | "info"
  | "success"
  | "muted";

export interface AppNotification extends EntityMetadata {
  id: string;
  referenceNumber: string;
  body: string;
  dedupeKey: string;
  href: string;
  kind: NotificationKind;
  recipientId: string;
  readAt?: Date | string | null;
  readBy?: string;
  sourceCollection?: OrgCollectionName;
  sourceId?: string;
  title: string;
  tone: NotificationTone;
  triggerAt?: Date | string | null;
  status: "active" | "archived";
}

export type OrgCollectionName =
  | "activities"
  | "clients"
  | "deals"
  | "financePayments"
  | "leads"
  | "properties"
  | "propertyUnits"
  | "rentalTenancies"
  | "tasks";

export type DevelopmentProjectStatus =
  | "concept"
  | "planning"
  | "approval"
  | "procurement"
  | "construction"
  | "inspection"
  | "handover"
  | "completed"
  | "onHold"
  | "cancelled";

export type DevelopmentRiskLevel = "low" | "medium" | "high" | "critical";

export interface DevelopmentProject extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  projectType: string;
  propertyId?: string;
  propertyName?: string;
  propertyReferenceNumber?: string;
  location?: string;
  state?: string;
  city?: string;
  projectManagerId?: string;
  projectManagerName?: string;
  projectManagerEmail?: string;
  contractorName?: string;
  contractorPhone?: string;
  contractorEmail?: string;
  currentPhase?: string;
  permitStatus?: string;
  startDate?: Date | null;
  expectedCompletionDate?: Date | null;
  actualCompletionDate?: Date | null;
  budget?: number;
  amountSpent?: number;
  progressPercent?: number;
  riskLevel?: DevelopmentRiskLevel;
  priority?: "low" | "medium" | "high" | "urgent";
  status: DevelopmentProjectStatus;
  notes?: string;
}

export type MarketingCampaignStatus =
  | "draft"
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";
export type MarketingCampaignChannel =
  | "Facebook"
  | "Instagram"
  | "Google Ads"
  | "WhatsApp"
  | "Email"
  | "SMS"
  | "Property portal"
  | "Referral"
  | "Event"
  | "Outdoor"
  | "Other";

export interface MarketingCampaign extends EntityMetadata {
  id: string;
  referenceNumber: string;
  name: string;
  campaignType: string;
  channel: MarketingCampaignChannel;
  objective?: string;
  propertyId?: string;
  propertyName?: string;
  propertyReferenceNumber?: string;
  campaignManagerId?: string;
  campaignManagerName?: string;
  campaignManagerEmail?: string;
  targetAudience?: string;
  targetLocation?: string;
  sourceTag?: string;
  landingPageUrl?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  budget?: number;
  amountSpent?: number;
  expectedLeads?: number;
  actualLeads?: number;
  qualifiedLeads?: number;
  convertedLeads?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  status: MarketingCampaignStatus;
  notes?: string;
}

export type TaskStatus =
  | "notStarted"
  | "inProgress"
  | "waiting"
  | "completed"
  | "cancelled"
  | "overdue";

export interface Task extends EntityMetadata {
  id: string;
  title: string;
  description?: string;
  dueAt?: Date | null;
  estimatedDurationMinutes?: number;
  expectedOutcome?: string;
  location?: string;
  priority: "low" | "medium" | "high" | "urgent";
  reminderMinutesBefore?: number;
  assignedTo?: string;
  assignedToEmail?: string;
  assignedToName?: string;
  relatedEntityType?:
    | "deal"
    | "lead"
    | "client"
    | "property"
    | "unit"
    | "tenancy"
    | "development"
    | "installationProject"
    | "marketing"
    | "offering";
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
  status: string;
  relatedEntityType?:
    | "deal"
    | "lead"
    | "client"
    | "property"
    | "unit"
    | "task"
    | "tenancy"
    | "development"
    | "installationProject"
    | "marketing"
    | "offering";
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
