import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPhone, statusTone, titleCase } from "@/lib/utils";
import type { Activity, Client, Lead, Property, PropertyUnit, RentalTenancy, Task } from "@/types/crm";

export type ModuleKey = "leads" | "clients" | "properties" | "propertyUnits" | "rentalTenancies" | "tasks" | "activities";

export interface FormField {
  colSpan?: "full";
  helpText?: string;
  name: string;
  label: string;
  options?: string[];
  optionSource?: "clients" | "internalManagers" | "managementCompanies" | "properties" | "propertyDevelopers" | "propertyOwners" | "propertyUnits";
  readOnly?: boolean;
  placeholder?: string;
  required?: boolean;
  section?: string;
  type: "date" | "email" | "number" | "select" | "textarea" | "text" | "url";
}

export interface ModuleConfig {
  collection: ModuleKey;
  createPermission: string;
  editPermission: string;
  emptyTitle: string;
  fields: FormField[];
  listPermission: string;
  prefix: string;
  route: string;
  title: string;
}

const leadStatuses = ["new", "contacted", "qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "converted", "lost", "dormant"];
const leadSources = ["Website", "Facebook", "Instagram", "Google Ads", "WhatsApp", "Referral", "Agent", "Walk-in", "Phone call", "Property portal", "Event", "Other"];
const propertyCategories = ["Residential", "Commercial", "Land", "Estate", "Apartment", "Detached house", "Semi-detached house", "Terrace", "Office", "Shop", "Warehouse", "Mixed-use", "Short-let", "Other"];
const listingStatuses = ["listed", "draft", "private", "offMarket"];
const marketingStatuses = ["active", "paused", "needsMedia", "comingSoon", "archived"];
const propertyStatuses = ["draft", "available", "reserved", "underNegotiation", "sold", "rented", "leased", "occupied", "vacant", "underMaintenance", "unavailable", "withdrawn"];
const titleTypes = ["C of O", "Governor's consent", "Deed of assignment", "Excision", "Gazette", "Registered survey", "Receipt and allocation", "Family receipt", "None", "Other"];
const titleStatuses = ["verified", "pendingVerification", "available", "inProcess", "notAvailable", "disputed"];
const unitTypes = ["Apartment", "Flat", "Duplex", "Terrace", "Semi-detached", "Detached", "Bungalow", "Penthouse", "Shop", "Office", "Warehouse", "Land plot", "Other"];
const furnishingStatuses = ["unfurnished", "semiFurnished", "furnished", "serviced"];
const sizeUnits = ["sqm", "sqft", "plots", "acres", "hectares"];
const rentalStatuses = ["draft", "active", "expiringSoon", "renewalDue", "renewed", "terminated", "defaulting", "movedOut"];
const paymentCycles = ["monthly", "quarterly", "biannual", "annual", "oneOff"];
const agreementStatuses = ["notStarted", "drafting", "sent", "signed", "expired"];
const rentalPaymentStatuses = ["notInvoiced", "invoiced", "partPaid", "paid", "overdue"];

export const moduleConfigs: Record<string, ModuleConfig> = {
  leads: {
    collection: "leads",
    createPermission: "leads.create",
    editPermission: "leads.updateAssigned",
    emptyTitle: "No leads have been captured yet.",
    listPermission: "leads.readAssigned",
    prefix: "LEAD",
    route: "/leads",
    title: "Leads",
    fields: [
      { name: "fullName", label: "Full name", required: true, type: "text" },
      { name: "phoneNumber", label: "Phone number", required: true, type: "text" },
      { name: "whatsappNumber", label: "WhatsApp number", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "contactPreference", label: "Contact preference", options: ["phone", "whatsapp", "email", "sms"], type: "select" },
      { name: "preferredLocation", label: "Preferred location", type: "text" },
      { name: "preferredState", label: "Preferred state", type: "text" },
      { name: "preferredCity", label: "Preferred city", type: "text" },
      { name: "propertyType", label: "Property type", type: "text" },
      { name: "preferredPropertyCategory", label: "Preferred property category", type: "text" },
      { name: "preferredBedrooms", label: "Preferred bedrooms", type: "number" },
      { name: "budgetMinimum", label: "Budget minimum", type: "number" },
      { name: "budgetMaximum", label: "Budget maximum", type: "number" },
      { name: "preferredBudgetCurrency", label: "Budget currency", type: "text" },
      { name: "transactionInterest", label: "Transaction interest", options: ["buy", "rent", "lease", "invest"], required: true, type: "select" },
      { name: "source", label: "Source", options: leadSources, required: true, type: "select" },
      { name: "sourcePlatform", label: "Source platform", type: "text" },
      { name: "campaignName", label: "Campaign name", type: "text" },
      { name: "sourceReference", label: "External source reference", type: "text" },
      { name: "assignedTo", label: "Assigned to user ID", type: "text" },
      { name: "score", label: "Lead score", type: "number" },
      { name: "leadTemperature", label: "Lead temperature", options: ["cold", "warm", "hot"], type: "select" },
      { name: "status", label: "Status", options: leadStatuses, required: true, type: "select" },
      { name: "nextFollowUpAt", label: "Next follow-up date", type: "text" },
      { name: "preferredInspectionDate", label: "Preferred inspection date", type: "text" },
      { name: "referralName", label: "Referral name", type: "text" },
      { name: "referralPhone", label: "Referral phone", type: "text" },
      { name: "tags", label: "Tags", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "lostReason", label: "Lost reason", type: "textarea" },
    ],
  },
  clients: {
    collection: "clients",
    createPermission: "clients.create",
    editPermission: "clients.update",
    emptyTitle: "No clients have been created yet.",
    listPermission: "clients.read",
    prefix: "CLIENT",
    route: "/clients",
    title: "Clients",
    fields: [
      { name: "clientType", label: "Client type", options: ["individual", "corporate"], required: true, type: "select" },
      { name: "category", label: "Category", required: true, type: "text" },
      { name: "fullName", label: "Full name", required: true, type: "text" },
      { name: "companyName", label: "Company name", type: "text" },
      { name: "phoneNumber", label: "Phone number", required: true, type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "assignedRelationshipManager", label: "Relationship manager", type: "text" },
      { name: "status", label: "Status", type: "text" },
      { name: "tags", label: "Tags", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  properties: {
    collection: "properties",
    createPermission: "properties.create",
    editPermission: "properties.update",
    emptyTitle: "No properties have been listed yet.",
    listPermission: "properties.read",
    prefix: "PROP",
    route: "/properties",
    title: "Properties",
    fields: [
      { name: "name", label: "Property name", placeholder: "Example: Beacon Court Phase 2", required: true, section: "Property basics", type: "text" },
      { name: "category", label: "Category", options: propertyCategories, required: true, section: "Property basics", type: "select" },
      { helpText: "Use commas for multiple options.", name: "transactionTypes", label: "Transaction types", placeholder: "sale, rent, lease", required: true, section: "Property basics", type: "text" },
      { name: "propertyStatus", label: "Property status", options: propertyStatuses, required: true, section: "Property basics", type: "select" },
      { name: "listingStatus", label: "Listing status", options: listingStatuses, required: true, section: "Property basics", type: "select" },
      { name: "marketingStatus", label: "Marketing status", options: marketingStatuses, required: true, section: "Property basics", type: "select" },
      { colSpan: "full", name: "description", label: "Description", placeholder: "Short public-facing property description.", section: "Property basics", type: "textarea" },

      { colSpan: "full", name: "address", label: "Address", required: true, section: "Location", type: "textarea" },
      { name: "state", label: "State", required: true, section: "Location", type: "text" },
      { name: "city", label: "City", required: true, section: "Location", type: "text" },
      { name: "localGovernmentArea", label: "Local government area", section: "Location", type: "text" },
      { name: "estateOrNeighborhood", label: "Estate or neighbourhood", section: "Location", type: "text" },
      { name: "landmark", label: "Nearest landmark", section: "Location", type: "text" },
      { name: "latitude", label: "Latitude", section: "Location", type: "number" },
      { name: "longitude", label: "Longitude", section: "Location", type: "number" },

      { name: "size", label: "Total size", section: "Specification", type: "number" },
      { name: "sizeUnit", label: "Size unit", options: ["sqm", "sqft", "acres", "hectares", "plots"], section: "Specification", type: "select" },
      { name: "bedrooms", label: "Bedrooms", section: "Specification", type: "number" },
      { name: "bathrooms", label: "Bathrooms", section: "Specification", type: "number" },
      { name: "toilets", label: "Toilets", section: "Specification", type: "number" },
      { name: "parkingSpaces", label: "Parking spaces", section: "Specification", type: "number" },
      { name: "floors", label: "Floors", section: "Specification", type: "number" },
      { name: "unitsCount", label: "Number of units", section: "Specification", type: "number" },
      { name: "furnishingStatus", label: "Furnishing status", options: ["unfurnished", "semiFurnished", "fullyFurnished", "notApplicable"], section: "Specification", type: "select" },
      { colSpan: "full", helpText: "Use commas to add more than one feature.", name: "features", label: "Features", placeholder: "24/7 power, water, security, drainage", section: "Specification", type: "text" },

      { name: "askingPrice", label: "Sale asking price", section: "Pricing and fees", type: "number" },
      { name: "minimumAcceptablePrice", label: "Minimum acceptable price", section: "Pricing and fees", type: "number" },
      { name: "rentAmount", label: "Rent amount", section: "Pricing and fees", type: "number" },
      { name: "serviceCharge", label: "Service charge", section: "Pricing and fees", type: "number" },
      { name: "cautionFee", label: "Caution fee", section: "Pricing and fees", type: "number" },
      { name: "legalFee", label: "Legal fee", section: "Pricing and fees", type: "number" },
      { name: "agencyFeeType", label: "Agency fee type", options: ["percentage", "fixed", "none"], section: "Pricing and fees", type: "select" },
      { name: "agencyFeeValue", label: "Agency fee value", section: "Pricing and fees", type: "number" },
      { helpText: "Calculated from sale asking price first, then rent amount if no sale price is set.", name: "agencyFee", label: "Calculated agency fee", readOnly: true, section: "Pricing and fees", type: "number" },
      { name: "commissionType", label: "Commission type", options: ["percentage", "fixed", "none"], section: "Pricing and fees", type: "select" },
      { name: "commissionValue", label: "Commission value", section: "Pricing and fees", type: "number" },
      { helpText: "Calculated from sale asking price first, then rent amount if no sale price is set.", name: "commissionAmount", label: "Calculated commission amount", readOnly: true, section: "Pricing and fees", type: "number" },

      { helpText: "Create owners below if they are not already listed.", name: "propertyOwnerId", label: "Owner", optionSource: "propertyOwners", section: "Ownership and management", type: "select" },
      { helpText: "Create developers below if they are not already listed.", name: "developerId", label: "Developer", optionSource: "propertyDevelopers", section: "Ownership and management", type: "select" },
      { helpText: "External company or person managing the property.", name: "managementCompanyId", label: "Management record", optionSource: "managementCompanies", section: "Ownership and management", type: "select" },
      { helpText: "Internal CRM user responsible for this property.", name: "assignedManager", label: "Assigned internal manager", optionSource: "internalManagers", section: "Ownership and management", type: "select" },
      { name: "dateListed", label: "Date listed", section: "Ownership and management", type: "date" },
      { name: "availabilityDate", label: "Availability date", section: "Ownership and management", type: "date" },

      { name: "titleType", label: "Title type", options: titleTypes, section: "Title and legal", type: "select" },
      { name: "titleStatus", label: "Title status", options: titleStatuses, section: "Title and legal", type: "select" },
      { name: "surveyPlanNumber", label: "Survey plan number", section: "Title and legal", type: "text" },
      { name: "registrationNumber", label: "Registration number", section: "Title and legal", type: "text" },
      { colSpan: "full", name: "legalNotes", label: "Legal notes", section: "Title and legal", type: "textarea" },

      { name: "virtualTourUrl", label: "Virtual tour URL", section: "Media and inspection", type: "url" },
      { name: "brochureUrl", label: "Brochure URL", section: "Media and inspection", type: "url" },
      { name: "mediaFolderUrl", label: "Media folder URL", section: "Media and inspection", type: "url" },
      { colSpan: "full", name: "inspectionNotes", label: "Inspection notes", section: "Media and inspection", type: "textarea" },
    ],
  },
  propertyUnits: {
    collection: "propertyUnits",
    createPermission: "units.create",
    editPermission: "units.update",
    emptyTitle: "No property units have been created yet.",
    listPermission: "units.read",
    prefix: "UNIT",
    route: "/units",
    title: "Property Units",
    fields: [
      { helpText: "Pick the parent property. The saved unit will stay linked to this property record.", name: "propertyId", label: "Property", optionSource: "properties", required: true, section: "Linked property", type: "select" },
      { name: "unitNumber", label: "Unit number/name", required: true, section: "Unit basics", type: "text" },
      { name: "unitType", label: "Unit type", options: unitTypes, section: "Unit basics", type: "select" },
      { name: "status", label: "Status", options: propertyStatuses, required: true, section: "Unit basics", type: "select" },
      { name: "phase", label: "Phase", section: "Location inside property", type: "text" },
      { name: "block", label: "Block", section: "Location inside property", type: "text" },
      { name: "floor", label: "Floor", section: "Location inside property", type: "text" },
      { name: "plotNumber", label: "Plot number", section: "Location inside property", type: "text" },
      { name: "size", label: "Size", section: "Specifications", type: "number" },
      { name: "sizeUnit", label: "Size unit", options: sizeUnits, section: "Specifications", type: "select" },
      { name: "bedrooms", label: "Bedrooms", section: "Specifications", type: "number" },
      { name: "bathrooms", label: "Bathrooms", section: "Specifications", type: "number" },
      { name: "toilets", label: "Toilets", section: "Specifications", type: "number" },
      { name: "parkingSpaces", label: "Parking spaces", section: "Specifications", type: "number" },
      { name: "furnishingStatus", label: "Furnishing status", options: furnishingStatuses, section: "Specifications", type: "select" },
      { colSpan: "full", helpText: "Separate multiple features with commas.", name: "features", label: "Features", section: "Specifications", type: "text" },
      { name: "askingPrice", label: "Sale asking price", section: "Pricing and availability", type: "number" },
      { name: "rentAmount", label: "Rent amount", section: "Pricing and availability", type: "number" },
      { name: "serviceCharge", label: "Service charge", section: "Pricing and availability", type: "number" },
      { name: "cautionFee", label: "Caution fee", section: "Pricing and availability", type: "number" },
      { name: "legalFee", label: "Legal fee", section: "Pricing and availability", type: "number" },
      { name: "availabilityDate", label: "Availability date", section: "Pricing and availability", type: "date" },
      { name: "reservationExpiresAt", label: "Reservation expires", section: "Pricing and availability", type: "date" },
      { colSpan: "full", name: "notes", label: "Unit notes", section: "Notes", type: "textarea" },
    ],
  },
  tasks: {
    collection: "tasks",
    createPermission: "tasks.create",
    editPermission: "tasks.update",
    emptyTitle: "No tasks have been assigned yet.",
    listPermission: "tasks.read",
    prefix: "TASK",
    route: "/tasks",
    title: "Tasks",
    fields: [
      { name: "title", label: "Title", required: true, type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "priority", label: "Priority", options: ["low", "medium", "high", "urgent"], required: true, type: "select" },
      { name: "status", label: "Status", options: ["notStarted", "inProgress", "waiting", "completed", "cancelled", "overdue"], required: true, type: "select" },
      { name: "dueAt", label: "Due date", type: "date" },
      { helpText: "The saved task keeps the selected user's ID for secure assignment.", name: "assignedTo", label: "Assigned to", optionSource: "internalManagers", type: "select" },
      { name: "relatedEntityType", label: "Related entity type", options: ["lead", "client", "property", "unit", "tenancy"], type: "select" },
      { name: "relatedEntityId", label: "Related entity ID", type: "text" },
    ],
  },
  rentalTenancies: {
    collection: "rentalTenancies",
    createPermission: "rentals.create",
    editPermission: "rentals.update",
    emptyTitle: "No tenancies have been created yet.",
    listPermission: "rentals.read",
    prefix: "RENT",
    route: "/rentals",
    title: "Rentals",
    fields: [
      { helpText: "Choose the tenant from existing clients.", name: "tenantClientId", label: "Tenant/client", optionSource: "clients", required: true, section: "Tenant and property", type: "select" },
      { name: "propertyId", label: "Property", optionSource: "properties", required: true, section: "Tenant and property", type: "select" },
      { helpText: "Optional if the whole property is being rented.", name: "unitId", label: "Unit", optionSource: "propertyUnits", section: "Tenant and property", type: "select" },
      { helpText: "Owner/landlord record for this rental.", name: "landlordOwnerId", label: "Landlord/owner", optionSource: "propertyOwners", section: "Tenant and property", type: "select" },

      { name: "leaseStartDate", label: "Lease start date", required: true, section: "Lease dates", type: "date" },
      { name: "leaseEndDate", label: "Lease end date", required: true, section: "Lease dates", type: "date" },
      { name: "moveInDate", label: "Move-in date", section: "Lease dates", type: "date" },
      { name: "moveOutDate", label: "Move-out date", section: "Lease dates", type: "date" },
      { name: "renewalNoticeDate", label: "Renewal notice date", section: "Lease dates", type: "date" },
      { name: "nextRentDueDate", label: "Next rent due date", section: "Lease dates", type: "date" },

      { name: "rentAmount", label: "Rent amount", required: true, section: "Financial terms", type: "number" },
      { name: "paymentCycle", label: "Payment cycle", options: paymentCycles, required: true, section: "Financial terms", type: "select" },
      { helpText: "Day of the month rent is normally due, e.g. 1 or 15.", name: "rentDueDay", label: "Rent due day", section: "Financial terms", type: "number" },
      { name: "gracePeriodDays", label: "Grace period days", section: "Financial terms", type: "number" },
      { name: "serviceCharge", label: "Service charge", section: "Financial terms", type: "number" },
      { name: "cautionFee", label: "Caution fee", section: "Financial terms", type: "number" },
      { name: "agencyFee", label: "Agency fee", section: "Financial terms", type: "number" },
      { name: "legalFee", label: "Legal fee", section: "Financial terms", type: "number" },
      { helpText: "Rent plus service charge, caution fee, agency fee, and legal fee.", name: "totalInitialPayment", label: "Total initial payment", readOnly: true, section: "Financial terms", type: "number" },

      { name: "status", label: "Tenancy status", options: rentalStatuses, required: true, section: "Status and notes", type: "select" },
      { name: "paymentStatus", label: "Payment status", options: rentalPaymentStatuses, section: "Status and notes", type: "select" },
      { name: "agreementStatus", label: "Agreement status", options: agreementStatuses, section: "Status and notes", type: "select" },
      { colSpan: "full", name: "notes", label: "Tenancy notes", section: "Status and notes", type: "textarea" },
    ],
  },
  activities: {
    collection: "activities",
    createPermission: "activities.create",
    editPermission: "activities.create",
    emptyTitle: "No activities have been recorded yet.",
    listPermission: "activities.read",
    prefix: "ACT",
    route: "/activities",
    title: "Activities",
    fields: [
      { name: "type", label: "Type", options: ["phoneCall", "whatsappMessage", "email", "sms", "meeting", "inspection", "followUp", "documentRequest", "paymentReminder", "complaint", "internalNote"], required: true, type: "select" },
      { name: "subject", label: "Subject", required: true, type: "text" },
      { name: "body", label: "Details", type: "textarea" },
      { name: "status", label: "Status", type: "text" },
      { name: "relatedEntityType", label: "Related entity type", options: ["lead", "client", "property", "unit", "task", "tenancy"], type: "select" },
      { name: "relatedEntityId", label: "Related entity ID", type: "text" },
    ],
  },
};

export function columnsFor(moduleKey: ModuleKey): ColumnDef<Record<string, unknown>>[] {
  const statusColumn = {
    header: "Status",
    cell: ({ row }) => {
      const status = String(row.original.status ?? row.original.propertyStatus ?? "active");
      return <Badge tone={statusTone(status)}>{titleCase(status)}</Badge>;
    },
  } satisfies ColumnDef<Record<string, unknown>>;

  if (moduleKey === "leads") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/leads/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Lead", accessorKey: "fullName" },
      { header: "Phone", cell: ({ row }) => formatPhone(String(row.original.phoneNumber ?? "")) },
      { header: "Source", cell: ({ row }) => String(row.original.source ?? "") },
      { header: "Interest", cell: ({ row }) => titleCase(String(row.original.transactionInterest ?? "")) },
      statusColumn,
    ];
  }

  if (moduleKey === "clients") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/clients/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Client", accessorKey: "fullName" },
      { header: "Type", cell: ({ row }) => titleCase(String(row.original.clientType ?? "")) },
      { header: "Phone", cell: ({ row }) => formatPhone(String(row.original.phoneNumber ?? "")) },
      statusColumn,
    ];
  }

  if (moduleKey === "properties") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/properties/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Property", accessorKey: "name" },
      { header: "City", accessorKey: "city" },
      { header: "Price", cell: ({ row }) => formatCurrency(Number(row.original.askingPrice ?? row.original.rentAmount ?? 0)) },
      statusColumn,
    ];
  }

  if (moduleKey === "propertyUnits") {
    return [
      {
        header: "Unit",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/units/${row.original.id}`}>
            <span>{String(row.original.unitNumber ?? "Unit")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      {
        header: "Property",
        cell: ({ row }) => {
          const label = String(row.original.propertyName ?? row.original.propertyReferenceNumber ?? row.original.propertyId ?? "");
          return row.original.propertyId ? <Link className="font-medium text-primary" href={`/properties/${row.original.propertyId}`}>{label}</Link> : label;
        },
      },
      {
        header: "Specs",
        cell: ({ row }) => {
          const specs = [
            row.original.unitType ? titleCase(String(row.original.unitType)) : null,
            row.original.bedrooms ? `${String(row.original.bedrooms)} bed` : null,
            row.original.bathrooms ? `${String(row.original.bathrooms)} bath` : null,
            row.original.size && row.original.sizeUnit ? `${String(row.original.size)} ${String(row.original.sizeUnit)}` : null,
          ].filter(Boolean);
          return specs.length ? specs.join(" · ") : "Not set";
        },
      },
      {
        header: "Pricing",
        cell: ({ row }) => {
          const salePrice = Number(row.original.askingPrice ?? 0);
          const rentPrice = Number(row.original.rentAmount ?? 0);
          if (salePrice && rentPrice) {
            return `${formatCurrency(salePrice)} sale · ${formatCurrency(rentPrice)} rent`;
          }

          if (salePrice) {
            return `${formatCurrency(salePrice)} sale`;
          }

          if (rentPrice) {
            return `${formatCurrency(rentPrice)} rent`;
          }

          return "Not priced";
        },
      },
      statusColumn,
    ];
  }

  if (moduleKey === "tasks") {
    return [
      { header: "Task", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/tasks/${row.original.id}`}>{String(row.original.title ?? "Task")}</Link> },
      { header: "Priority", cell: ({ row }) => titleCase(String(row.original.priority ?? "")) },
      { header: "Assigned", cell: ({ row }) => String(row.original.assignedToName ?? row.original.assignedToEmail ?? row.original.assignedTo ?? "Unassigned") },
      statusColumn,
    ];
  }

  if (moduleKey === "rentalTenancies") {
    return [
      {
        header: "Tenancy",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/rentals/${row.original.id}`}>
            <span>{String(row.original.tenantName ?? "Tenant")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      { header: "Property", cell: ({ row }) => String(row.original.unitName ?? row.original.propertyName ?? row.original.propertyId ?? "") },
      { header: "Lease", cell: ({ row }) => `${String(row.original.leaseStartDate ?? "Not set")} to ${String(row.original.leaseEndDate ?? "Not set")}` },
      { header: "Rent", cell: ({ row }) => `${formatCurrency(Number(row.original.rentAmount ?? 0))} · ${titleCase(String(row.original.paymentCycle ?? ""))}` },
      statusColumn,
    ];
  }

  return [
    { header: "Activity", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/activities/${row.original.id}`}>{String(row.original.subject ?? "Activity")}</Link> },
    { header: "Type", cell: ({ row }) => titleCase(String(row.original.type ?? "")) },
    { header: "Related", accessorKey: "relatedEntityId" },
    statusColumn,
  ];
}

export type ModuleEntity = Activity | Client | Lead | Property | PropertyUnit | RentalTenancy | Task;
