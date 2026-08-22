import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { WhatsAppPhoneLink } from "@/components/ui/whatsapp-link";
import { formatCurrency, statusTone, titleCase } from "@/lib/utils";
import type { Activity, Client, Deal, DevelopmentProject, Lead, MarketingCampaign, Offering, Property, PropertyUnit, RentalTenancy, Task } from "@/types/crm";

export type ModuleKey = "leads" | "clients" | "deals" | "properties" | "propertyUnits" | "offerings" | "rentalTenancies" | "developmentProjects" | "marketingCampaigns" | "tasks" | "activities";

export interface FormField {
  colSpan?: "full";
  helpText?: string;
  name: string;
  label: string;
  options?: string[];
  optionSource?: "clients" | "internalManagers" | "inventoryBrands" | "leads" | "managementCompanies" | "offerings" | "properties" | "propertyDevelopers" | "propertyOwners" | "propertyUnits";
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
  singularTitle?: string;
  title: string;
}

const leadStatuses = ["new", "contacted", "qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "converted", "lost", "dormant"];
const leadSources = ["Website", "Facebook", "Instagram", "Google Ads", "WhatsApp", "Referral", "Agent", "Walk-in", "Phone call", "Property portal", "Event", "Other"];
const dealStatuses = ["new", "qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "won", "lost", "dormant"];
const dealTypes = ["sale", "rent", "lease", "reservation", "investment", "other"];
const dealFinanceStatuses = ["notInvoiced", "paymentPending", "partPaid", "paid", "overdue"];
const dealLegalStatuses = ["notStarted", "drafting", "inReview", "signed", "completed", "blocked"];
const dealProposalStatuses = ["notStarted", "drafting", "sent", "accepted", "rejected", "expired"];
const dealFulfillmentStatuses = ["notStarted", "awaitingPayment", "procurement", "scheduled", "inProgress", "delivered", "completed", "onHold", "cancelled"];
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
const developmentStatuses = ["concept", "planning", "approval", "procurement", "construction", "inspection", "handover", "completed", "onHold", "cancelled"];
const developmentTypes = ["Estate development", "Building construction", "Renovation", "Infrastructure", "Land development", "Fit-out", "Maintenance", "Other"];
const permitStatuses = ["notStarted", "inReview", "approved", "rejected", "notRequired"];
const riskLevels = ["low", "medium", "high", "critical"];
const priorities = ["low", "medium", "high", "urgent"];
const marketingCampaignStatuses = ["draft", "planned", "active", "paused", "completed", "cancelled"];
const marketingCampaignTypes = ["Property launch", "Open house", "Lead generation", "Retargeting", "Brand awareness", "Referral drive", "Agent campaign", "Event", "Other"];
const marketingChannels = ["Facebook", "Instagram", "Google Ads", "WhatsApp", "Email", "SMS", "Property portal", "Referral", "Event", "Outdoor", "Other"];
const businessVerticals = ["realEstate", "solar", "buildingMaterials", "generalServices", "custom"];
const offeringTypes = ["property", "unit", "material", "solarEquipment", "solarService", "installationProject", "consultancy", "maintenance", "service", "other"];
const offeringStatuses = ["active", "draft", "inactive", "archived"];
const unitOfMeasureOptions = ["unit", "piece", "pack", "bag", "ton", "kg", "sqm", "meter", "kW", "kVA", "panel", "battery", "inverter", "service", "project", "other"];

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
      { colSpan: "full", helpText: "Address, site label, landmark, or preferred area shown on the lead location map.", name: "geoAddress", label: "Map location label / address", section: "Map location", type: "text" },
      { helpText: "Latitude for the lead's site or preferred location.", name: "geoLatitude", label: "Latitude", section: "Map location", type: "number" },
      { helpText: "Longitude for the lead's site or preferred location.", name: "geoLongitude", label: "Longitude", section: "Map location", type: "number" },
      { helpText: "GPS accuracy in meters when captured from the browser.", name: "geoAccuracy", label: "Accuracy (meters)", section: "Map location", type: "number" },
      { helpText: "ISO timestamp from the last browser GPS capture.", name: "geoCapturedAt", label: "Location captured at", readOnly: true, section: "Map location", type: "text" },
      { name: "propertyType", label: "Property type", type: "text" },
      { name: "preferredPropertyCategory", label: "Preferred property category", type: "text" },
      { name: "preferredBedrooms", label: "Preferred bedrooms", type: "number" },
      { name: "budgetMinimum", label: "Budget minimum", type: "number" },
      { name: "budgetMaximum", label: "Budget maximum", type: "number" },
      { name: "preferredBudgetCurrency", label: "Budget currency", type: "text" },
      { name: "interestCategory", label: "Interest category", options: businessVerticals, type: "select" },
      { name: "transactionInterest", label: "Transaction interest", options: ["buy", "rent", "lease", "invest"], required: true, type: "select" },
      { helpText: "Optional: link the primary property this lead is asking about.", name: "propertyId", label: "Linked property", optionSource: "properties", section: "Linked product/service", type: "select" },
      { helpText: "Optional if the interest is for a specific unit.", name: "unitId", label: "Linked unit", optionSource: "propertyUnits", section: "Linked product/service", type: "select" },
      { helpText: "Use this for solar, building materials, consultancy, installation packages, or any non-property product/service.", name: "offeringId", label: "Linked product/service", optionSource: "offerings", section: "Linked product/service", type: "select" },
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
  deals: {
    collection: "deals",
    createPermission: "deals.create",
    editPermission: "deals.update",
    emptyTitle: "No deals have been opened yet.",
    listPermission: "deals.read",
    prefix: "DEAL",
    route: "/deals",
    title: "Deals",
    fields: [
      { name: "title", label: "Deal title", placeholder: "Example: Lekki Phase 1 Duplex Sale", required: true, section: "Deal basics", type: "text" },
      { helpText: "Choose the business line so only relevant deal fields are shown.", name: "dealCategory", label: "Deal category", options: businessVerticals, section: "Deal basics", type: "select" },
      { name: "dealType", label: "Deal type", options: dealTypes, required: true, section: "Deal basics", type: "select" },
      { name: "status", label: "Deal stage", options: dealStatuses, required: true, section: "Deal basics", type: "select" },
      { helpText: "Internal owner responsible for moving this deal forward.", name: "dealOwnerId", label: "Deal owner", optionSource: "internalManagers", section: "Deal basics", type: "select" },
      { name: "expectedCloseDate", label: "Expected close date", section: "Deal basics", type: "date" },
      { name: "closeProbability", label: "Close probability %", section: "Deal basics", type: "number" },

      { helpText: "Optional: link the original lead so history and source context are preserved.", name: "leadId", label: "Linked lead", optionSource: "leads", section: "Linked records", type: "select" },
      { helpText: "Optional until the buyer, tenant, or investor has a client record.", name: "clientId", label: "Client", optionSource: "clients", section: "Linked records", type: "select" },
      { name: "propertyId", label: "Property", optionSource: "properties", section: "Linked records", type: "select" },
      { helpText: "Optional if the deal is for the full property.", name: "unitId", label: "Unit", optionSource: "propertyUnits", section: "Linked records", type: "select" },
      { helpText: "Use this for non-real-estate products/services or to connect a deal to the broader catalog.", name: "offeringId", label: "Product/service", optionSource: "offerings", section: "Linked records", type: "select" },

      { name: "offerAmount", label: "Offer amount", section: "Commercial terms", type: "number" },
      { name: "agreedAmount", label: "Agreed amount", section: "Commercial terms", type: "number" },
      { helpText: "For product/service deals, multiply quantity by unit price.", name: "offeringQuantity", label: "Quantity", section: "Commercial terms", type: "number" },
      { name: "offeringUnitPrice", label: "Unit price", section: "Commercial terms", type: "number" },
      { helpText: "Calculated from quantity and unit price.", name: "quoteSubtotal", label: "Quote subtotal", readOnly: true, section: "Commercial terms", type: "number" },
      { name: "reservationAmount", label: "Reservation amount", section: "Commercial terms", type: "number" },
      { name: "depositAmount", label: "Deposit amount", section: "Commercial terms", type: "number" },
      { name: "financeStatus", label: "Finance status", options: dealFinanceStatuses, section: "Commercial terms", type: "select" },
      { colSpan: "full", name: "paymentPlan", label: "Payment plan", section: "Commercial terms", type: "textarea" },

      { name: "proposalStatus", label: "Proposal status", options: dealProposalStatuses, section: "Proposal and fulfillment", type: "select" },
      { name: "fulfillmentStatus", label: "Fulfillment status", options: dealFulfillmentStatuses, section: "Proposal and fulfillment", type: "select" },
      { name: "fulfillmentDueDate", label: "Fulfillment due date", section: "Proposal and fulfillment", type: "date" },
      { colSpan: "full", name: "scopeOfWork", label: "Scope of work / order details", section: "Proposal and fulfillment", type: "textarea" },
      { colSpan: "full", name: "deliveryNotes", label: "Delivery / installation notes", section: "Proposal and fulfillment", type: "textarea" },

      { name: "legalStatus", label: "Legal status", options: dealLegalStatuses, section: "Legal and closing", type: "select" },
      { name: "commissionType", label: "Commission type", options: ["percentage", "fixed", "none"], section: "Legal and closing", type: "select" },
      { name: "commissionValue", label: "Commission value", section: "Legal and closing", type: "number" },
      { helpText: "Calculated from agreed amount first, then quote subtotal or offer amount.", name: "commissionAmount", label: "Calculated commission amount", readOnly: true, section: "Legal and closing", type: "number" },
      { name: "lostReason", label: "Lost reason", section: "Legal and closing", type: "text" },
      { colSpan: "full", name: "notes", label: "Deal notes", section: "Legal and closing", type: "textarea" },
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
      { name: "name", label: "Property name", placeholder: "Example: Vlingo Court Phase 2", required: true, section: "Property basics", type: "text" },
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
  offerings: {
    collection: "offerings",
    createPermission: "offerings.create",
    editPermission: "offerings.update",
    emptyTitle: "No products/services have been added yet.",
    listPermission: "offerings.read",
    prefix: "OFR",
    route: "/offerings",
    singularTitle: "Product/Service",
    title: "Products/Services",
    fields: [
      { name: "name", label: "Product/service name", placeholder: "Example: 5kVA Solar Installation Package", required: true, section: "Product/service basics", type: "text" },
      { name: "vertical", label: "Business vertical", options: businessVerticals, required: true, section: "Product/service basics", type: "select" },
      { name: "type", label: "Product/service type", options: offeringTypes, required: true, section: "Product/service basics", type: "select" },
      { name: "category", label: "Category", placeholder: "Solar package, cement, land, consulting...", required: true, section: "Product/service basics", type: "text" },
      { helpText: "Required for stock tracking and partner-scoped inventory reports.", name: "brandId", label: "Brand", optionSource: "inventoryBrands", section: "Product/service basics", type: "select" },
      { name: "status", label: "Status", options: offeringStatuses, required: true, section: "Product/service basics", type: "select" },
      { colSpan: "full", name: "description", label: "Description", section: "Product/service basics", type: "textarea" },

      { helpText: "Generated automatically when the product/service is saved.", name: "sku", label: "SKU / item code", placeholder: "Generated automatically", readOnly: true, section: "Commercials and inventory settings", type: "text" },
      { name: "barcode", label: "Barcode / GTIN", section: "Commercials and inventory settings", type: "text" },
      { name: "trackingMode", label: "Traceability", options: ["none", "batch", "serial"], section: "Commercials and inventory settings", type: "select" },
      { name: "unitOfMeasure", label: "Unit of measure", options: unitOfMeasureOptions, section: "Commercials and inventory settings", type: "select" },
      { name: "sellingPrice", label: "Selling price", section: "Commercials and inventory settings", type: "number" },
      { name: "costPrice", label: "Cost price", section: "Commercials and inventory settings", type: "number" },
      { name: "reorderLevel", label: "Reorder level", section: "Commercials and inventory settings", type: "number" },
      { name: "supplierName", label: "Supplier / partner", section: "Commercials and inventory settings", type: "text" },
      { name: "serviceDurationDays", label: "Service duration days", section: "Commercials and inventory settings", type: "number" },

      { colSpan: "full", helpText: "Separate tags with commas.", name: "tags", label: "Tags", section: "Notes", type: "text" },
      { colSpan: "full", name: "notes", label: "Internal notes", section: "Notes", type: "textarea" },
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
      { name: "title", label: "Title", required: true, section: "Task details", type: "text" },
      { name: "priority", label: "Priority", options: ["low", "medium", "high", "urgent"], required: true, section: "Task details", type: "select" },
      { name: "status", label: "Status", options: ["notStarted", "inProgress", "waiting", "completed", "cancelled", "overdue"], required: true, section: "Task details", type: "select" },
      { colSpan: "full", name: "description", label: "Description", section: "Task details", type: "textarea" },
      { colSpan: "full", helpText: "What should be achieved when this task is completed.", name: "expectedOutcome", label: "Expected outcome", section: "Task details", type: "textarea" },

      { name: "dueAt", label: "Due date", section: "Schedule", type: "date" },
      { name: "estimatedDurationMinutes", label: "Estimated duration (minutes)", section: "Schedule", type: "number" },
      { name: "reminderMinutesBefore", label: "Reminder before due date (minutes)", section: "Schedule", type: "number" },
      { colSpan: "full", name: "location", label: "Location / meeting point", section: "Schedule", type: "text" },

      { helpText: "The saved task keeps the selected user's ID for secure assignment.", name: "assignedTo", label: "Assigned to", optionSource: "internalManagers", section: "Ownership and link", type: "select" },
      { name: "relatedEntityType", label: "Related entity type", options: ["deal", "lead", "client", "property", "unit", "tenancy", "development", "marketing", "offering"], section: "Ownership and link", type: "select" },
      { name: "relatedEntityId", label: "Related entity ID", section: "Ownership and link", type: "text" },
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
  developmentProjects: {
    collection: "developmentProjects",
    createPermission: "development.create",
    editPermission: "development.update",
    emptyTitle: "No development projects have been created yet.",
    listPermission: "development.read",
    prefix: "DEV",
    route: "/development",
    title: "Development Projects",
    fields: [
      { name: "name", label: "Project name", placeholder: "Example: Vlingo Court Phase 2 Construction", required: true, section: "Project basics", type: "text" },
      { name: "projectType", label: "Project type", options: developmentTypes, required: true, section: "Project basics", type: "select" },
      { helpText: "Optional: link this project to an existing property record.", name: "propertyId", label: "Linked property", optionSource: "properties", section: "Project basics", type: "select" },
      { name: "status", label: "Project status", options: developmentStatuses, required: true, section: "Project basics", type: "select" },
      { name: "priority", label: "Priority", options: priorities, section: "Project basics", type: "select" },
      { name: "riskLevel", label: "Risk level", options: riskLevels, section: "Project basics", type: "select" },

      { colSpan: "full", name: "location", label: "Site/location", section: "Location", type: "textarea" },
      { name: "state", label: "State", section: "Location", type: "text" },
      { name: "city", label: "City", section: "Location", type: "text" },

      { helpText: "Internal CRM user responsible for delivery.", name: "projectManagerId", label: "Project manager", optionSource: "internalManagers", section: "Team and contractor", type: "select" },
      { name: "contractorName", label: "Main contractor", section: "Team and contractor", type: "text" },
      { name: "contractorPhone", label: "Contractor phone", section: "Team and contractor", type: "text" },
      { name: "contractorEmail", label: "Contractor email", section: "Team and contractor", type: "email" },

      { name: "currentPhase", label: "Current phase", placeholder: "Foundation, blockwork, roofing, finishing...", section: "Delivery", type: "text" },
      { name: "permitStatus", label: "Permit status", options: permitStatuses, section: "Delivery", type: "select" },
      { name: "progressPercent", label: "Progress %", section: "Delivery", type: "number" },
      { name: "startDate", label: "Start date", section: "Delivery", type: "date" },
      { name: "expectedCompletionDate", label: "Expected completion", section: "Delivery", type: "date" },
      { name: "actualCompletionDate", label: "Actual completion", section: "Delivery", type: "date" },

      { name: "budget", label: "Approved budget", section: "Budget", type: "number" },
      { name: "amountSpent", label: "Amount spent", section: "Budget", type: "number" },
      { colSpan: "full", name: "notes", label: "Development notes", section: "Notes", type: "textarea" },
    ],
  },
  marketingCampaigns: {
    collection: "marketingCampaigns",
    createPermission: "marketing.create",
    editPermission: "marketing.update",
    emptyTitle: "No marketing campaigns have been created yet.",
    listPermission: "marketing.read",
    prefix: "MKT",
    route: "/marketing",
    title: "Marketing Campaigns",
    fields: [
      { name: "name", label: "Campaign name", placeholder: "Example: Lekki Phase 1 Open House", required: true, section: "Campaign basics", type: "text" },
      { name: "campaignType", label: "Campaign type", options: marketingCampaignTypes, required: true, section: "Campaign basics", type: "select" },
      { name: "channel", label: "Primary channel", options: marketingChannels, required: true, section: "Campaign basics", type: "select" },
      { name: "status", label: "Campaign status", options: marketingCampaignStatuses, required: true, section: "Campaign basics", type: "select" },
      { name: "priority", label: "Priority", options: priorities, section: "Campaign basics", type: "select" },
      { colSpan: "full", name: "objective", label: "Objective", placeholder: "What this campaign is meant to achieve.", section: "Campaign basics", type: "textarea" },

      { helpText: "Optional: link campaign performance to a property/listing.", name: "propertyId", label: "Linked property/listing", optionSource: "properties", section: "Targeting", type: "select" },
      { name: "campaignManagerId", label: "Campaign manager", optionSource: "internalManagers", section: "Targeting", type: "select" },
      { name: "targetAudience", label: "Target audience", placeholder: "Investors, tenants, first-time buyers...", section: "Targeting", type: "text" },
      { name: "targetLocation", label: "Target location", placeholder: "Lekki, Ajah, Abuja...", section: "Targeting", type: "text" },
      { helpText: "Use this same value on imported leads as campaign name/source tag.", name: "sourceTag", label: "Lead source tag", section: "Targeting", type: "text" },
      { name: "landingPageUrl", label: "Landing page URL", section: "Targeting", type: "url" },

      { name: "startDate", label: "Start date", section: "Schedule and budget", type: "date" },
      { name: "endDate", label: "End date", section: "Schedule and budget", type: "date" },
      { name: "budget", label: "Budget", section: "Schedule and budget", type: "number" },
      { name: "amountSpent", label: "Amount spent", section: "Schedule and budget", type: "number" },

      { name: "expectedLeads", label: "Expected leads", section: "Performance", type: "number" },
      { name: "actualLeads", label: "Actual leads", section: "Performance", type: "number" },
      { name: "qualifiedLeads", label: "Qualified leads", section: "Performance", type: "number" },
      { name: "convertedLeads", label: "Converted leads", section: "Performance", type: "number" },
      { colSpan: "full", name: "notes", label: "Marketing notes", section: "Notes", type: "textarea" },
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
      { name: "relatedEntityType", label: "Related entity type", options: ["deal", "lead", "client", "property", "unit", "task", "tenancy", "development", "marketing", "offering"], type: "select" },
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
  const inputByColumn = {
    header: "Input by",
    cell: ({ row }) => String(row.original.createdByName ?? row.original.createdByEmail ?? row.original.createdBy ?? "Not recorded"),
  } satisfies ColumnDef<Record<string, unknown>>;

  if (moduleKey === "leads") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/leads/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Lead", accessorKey: "fullName" },
      { header: "Phone", cell: ({ row }) => <WhatsAppPhoneLink displayNumber={String(row.original.phoneNumber ?? "")} phoneNumber={String(row.original.whatsappNumber ?? row.original.phoneNumber ?? "")} /> },
      { header: "Source", cell: ({ row }) => String(row.original.source ?? "") },
      { header: "Product/service", cell: ({ row }) => String(row.original.offeringName ?? row.original.unitName ?? row.original.propertyName ?? "Not linked") },
      { header: "Interest", cell: ({ row }) => titleCase(String(row.original.transactionInterest ?? "")) },
      inputByColumn,
      statusColumn,
    ];
  }

  if (moduleKey === "clients") {
    return [
      { header: "Reference", cell: ({ row }) => <Link className="font-semibold text-primary" href={`/clients/${row.original.id}`}>{String(row.original.referenceNumber ?? "Draft")}</Link> },
      { header: "Client", accessorKey: "fullName" },
      { header: "Type", cell: ({ row }) => titleCase(String(row.original.clientType ?? "")) },
      { header: "Phone", cell: ({ row }) => <WhatsAppPhoneLink displayNumber={String(row.original.phoneNumber ?? "")} phoneNumber={String(row.original.phoneNumber ?? "")} /> },
      inputByColumn,
      statusColumn,
    ];
  }

  if (moduleKey === "deals") {
    return [
      {
        header: "Deal",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/deals/${row.original.id}`}>
            <span>{String(row.original.title ?? "Deal")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      { header: "Client/lead", cell: ({ row }) => String(row.original.clientName ?? row.original.leadName ?? "Not linked") },
      { header: "Product/service", cell: ({ row }) => String(row.original.offeringName ?? row.original.unitName ?? row.original.propertyName ?? "Not linked") },
      { header: "Value", cell: ({ row }) => formatCurrency(Number(row.original.agreedAmount ?? row.original.offerAmount ?? row.original.depositAmount ?? row.original.reservationAmount ?? 0)) },
      { header: "Owner", cell: ({ row }) => String(row.original.dealOwnerName ?? row.original.dealOwnerEmail ?? "Unassigned") },
      inputByColumn,
      { header: "Fulfillment", cell: ({ row }) => titleCase(String(row.original.fulfillmentStatus ?? row.original.proposalStatus ?? "notStarted")) },
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

  if (moduleKey === "offerings") {
    return [
      {
        header: "Product/service",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/offerings/${row.original.id}`}>
            <span>{String(row.original.name ?? "Product/service")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      { header: "Vertical", cell: ({ row }) => titleCase(String(row.original.vertical ?? "")) },
      { header: "Type", cell: ({ row }) => titleCase(String(row.original.type ?? "")) },
      { header: "Category", cell: ({ row }) => String(row.original.category ?? "Not set") },
      { header: "Price", cell: ({ row }) => formatCurrency(Number(row.original.sellingPrice ?? 0)) },
      { header: "Stock", cell: ({ row }) => row.original.stockQuantity === undefined || row.original.stockQuantity === "" ? "Not tracked" : String(row.original.stockQuantity) },
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

  if (moduleKey === "developmentProjects") {
    return [
      {
        header: "Project",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/development/${row.original.id}`}>
            <span>{String(row.original.name ?? "Development project")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      { header: "Linked property", cell: ({ row }) => String(row.original.propertyName ?? row.original.city ?? row.original.location ?? "Not linked") },
      { header: "Manager", cell: ({ row }) => String(row.original.projectManagerName ?? row.original.projectManagerEmail ?? "Unassigned") },
      {
        header: "Budget",
        cell: ({ row }) => {
          const budget = Number(row.original.budget ?? 0);
          const spent = Number(row.original.amountSpent ?? 0);
          return budget || spent ? `${formatCurrency(spent)} / ${formatCurrency(budget)}` : "Not set";
        },
      },
      { header: "Progress", cell: ({ row }) => `${Number(row.original.progressPercent ?? 0)}%` },
      statusColumn,
    ];
  }

  if (moduleKey === "marketingCampaigns") {
    return [
      {
        header: "Campaign",
        cell: ({ row }) => (
          <Link className="grid gap-0.5 font-semibold text-primary" href={`/marketing/${row.original.id}`}>
            <span>{String(row.original.name ?? "Marketing campaign")}</span>
            <span className="text-xs font-medium text-muted-foreground">{String(row.original.referenceNumber ?? "Draft")}</span>
          </Link>
        ),
      },
      { header: "Channel", cell: ({ row }) => String(row.original.channel ?? "Not set") },
      { header: "Linked property", cell: ({ row }) => String(row.original.propertyName ?? row.original.targetLocation ?? "Not linked") },
      {
        header: "Spend",
        cell: ({ row }) => {
          const budget = Number(row.original.budget ?? 0);
          const spent = Number(row.original.amountSpent ?? 0);
          return budget || spent ? `${formatCurrency(spent)} / ${formatCurrency(budget)}` : "Not set";
        },
      },
      { header: "Leads", cell: ({ row }) => `${Number(row.original.actualLeads ?? 0)} / ${Number(row.original.expectedLeads ?? 0)}` },
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

export type ModuleEntity = Activity | Client | Deal | DevelopmentProject | Lead | MarketingCampaign | Offering | Property | PropertyUnit | RentalTenancy | Task;
