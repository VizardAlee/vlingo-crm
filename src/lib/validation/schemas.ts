import { z } from "zod";

const optionalEmail = z.union([z.email(), z.literal("")]).optional();
const optionalNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().nonnegative().optional(),
);
const optionalDateString = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.string().optional(),
);
const tagString = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== "string") {
      return [];
    }

    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  },
  z.array(z.string()),
);

export const leadSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phoneNumber: z.string().min(7, "A valid phone number is required."),
  whatsappNumber: z.string().optional(),
  email: optionalEmail,
  contactPreference: z.string().optional(),
  preferredLocation: z.string().optional(),
  preferredState: z.string().optional(),
  preferredCity: z.string().optional(),
  propertyType: z.string().optional(),
  preferredPropertyCategory: z.string().optional(),
  preferredBedrooms: optionalNumber,
  budgetMinimum: optionalNumber,
  budgetMaximum: optionalNumber,
  preferredBudgetCurrency: z.string().optional(),
  transactionInterest: z.enum(["buy", "rent", "lease", "invest"]),
  intendedUse: z.string().optional(),
  paymentPreference: z.string().optional(),
  preferredInspectionDate: optionalDateString,
  source: z.string().min(2, "Lead source is required."),
  sourcePlatform: z.string().optional(),
  campaignName: z.string().optional(),
  sourceReference: z.string().optional(),
  referralName: z.string().optional(),
  referralPhone: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedAgentId: z.string().optional(),
  score: z.coerce.number().min(0).max(100).default(25),
  leadTemperature: z.enum(["cold", "warm", "hot"]).optional(),
  status: z.enum([
    "new",
    "contacted",
    "qualified",
    "propertyRecommended",
    "inspectionScheduled",
    "inspectionCompleted",
    "negotiation",
    "offerMade",
    "paymentPending",
    "converted",
    "lost",
    "dormant",
  ]),
  tags: tagString.default([]),
  notes: z.string().optional(),
  nextFollowUpAt: optionalDateString,
  lostReason: z.string().optional(),
});

export const clientSchema = z.object({
  clientType: z.enum(["individual", "corporate"]),
  category: z.string().min(2, "Client category is required."),
  fullName: z.string().min(2, "Client name is required."),
  companyName: z.string().optional(),
  phoneNumber: z.string().min(7, "A valid phone number is required."),
  whatsappNumber: z.string().optional(),
  email: optionalEmail,
  address: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  identificationType: z.string().optional(),
  identificationNumber: z.string().optional(),
  taxIdentificationNumber: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  preferredCommunicationMethod: z.string().optional(),
  assignedRelationshipManager: z.string().optional(),
  status: z.string().default("active"),
  tags: tagString.default([]),
  notes: z.string().optional(),
});

export const propertySchema = z.object({
  name: z.string().min(2, "Property name is required."),
  category: z.string().min(2, "Category is required."),
  transactionTypes: tagString,
  description: z.string().optional(),
  address: z.string().min(5, "Address is required."),
  state: z.string().min(2, "State is required."),
  localGovernmentArea: z.string().optional(),
  city: z.string().min(2, "City is required."),
  estateOrNeighborhood: z.string().optional(),
  propertyOwnerId: z.string().optional(),
  developerName: z.string().optional(),
  assignedManager: z.string().optional(),
  listingStatus: z.string().default("listed"),
  propertyStatus: z.enum(["draft", "available", "reserved", "underNegotiation", "sold", "rented", "leased", "occupied", "vacant", "underMaintenance", "unavailable", "withdrawn"]),
  marketingStatus: z.string().default("active"),
  askingPrice: z.coerce.number().nonnegative().optional(),
  minimumAcceptablePrice: z.coerce.number().nonnegative().optional(),
  rentAmount: z.coerce.number().nonnegative().optional(),
  serviceCharge: z.coerce.number().nonnegative().optional(),
  cautionFee: z.coerce.number().nonnegative().optional(),
  legalFee: z.coerce.number().nonnegative().optional(),
  agencyFee: z.coerce.number().nonnegative().optional(),
  commissionType: z.string().optional(),
  commissionValue: z.coerce.number().nonnegative().optional(),
  features: tagString.default([]),
  titleType: z.string().optional(),
  titleStatus: z.string().optional(),
});

export const unitSchema = z.object({
  propertyId: z.string().min(2, "Property is required."),
  phase: z.string().optional(),
  block: z.string().optional(),
  floor: z.string().optional(),
  plotNumber: z.string().optional(),
  unitNumber: z.string().min(1, "Unit number is required."),
  size: z.coerce.number().nonnegative().optional(),
  sizeUnit: z.string().optional(),
  bedrooms: z.coerce.number().nonnegative().optional(),
  bathrooms: z.coerce.number().nonnegative().optional(),
  askingPrice: z.coerce.number().nonnegative().optional(),
  rentAmount: z.coerce.number().nonnegative().optional(),
  status: z.enum(["draft", "available", "reserved", "underNegotiation", "sold", "rented", "leased", "occupied", "vacant", "underMaintenance", "unavailable", "withdrawn"]),
});

export const taskSchema = z.object({
  title: z.string().min(2, "Task title is required."),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["notStarted", "inProgress", "waiting", "completed", "cancelled", "overdue"]),
  assignedTo: z.string().optional(),
  relatedEntityType: z.enum(["lead", "client", "property", "unit"]).optional(),
  relatedEntityId: z.string().optional(),
});

export const activitySchema = z.object({
  type: z.enum(["phoneCall", "whatsappMessage", "email", "sms", "meeting", "inspection", "followUp", "documentRequest", "paymentReminder", "complaint", "internalNote"]),
  subject: z.string().min(2, "Subject is required."),
  body: z.string().optional(),
  relatedEntityType: z.enum(["lead", "client", "property", "unit", "task"]).optional(),
  relatedEntityId: z.string().optional(),
});
