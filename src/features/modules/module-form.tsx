"use client";

import { Crosshair, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { where, type QueryConstraint } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { type ZodType } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour } from "@/components/tour/guided-tour";
import { useAuth } from "@/features/auth/auth-provider";
import { AiGuideLink } from "@/features/ai-guide/ai-guide-link";
import { dealCategoryFromFormValue, dealTypeFromFormValue, dealTypesForCategory, dealVisibleFieldNames } from "@/features/modules/deal-form-logic";
import { type FormField, type ModuleConfig } from "@/features/modules/module-config";
import { fieldTourTarget, formTourSteps } from "@/features/modules/form-tour";
import { activitySchema, clientSchema, dealSchema, developmentProjectSchema, leadSchema, marketingCampaignSchema, offeringSchema, propertySchema, rentalTenancySchema, taskSchema, unitSchema } from "@/lib/validation/schemas";
import { canAccessAllBranches, canAccessBranch, effectiveBranchId, hasPermission, isAssignedOnlySalesUser } from "@/lib/permissions";
import { cn, createReference, titleCase } from "@/lib/utils";
import { createOrgRecord, listOrgRecords, updateOrgRecord, writeAuditLog } from "@/services/repository";
import { createInventoryBrand, listInventoryBrands } from "@/services/inventory";
import { listBranches, listMembers } from "@/services/users";
import type { Branch, BusinessVertical, Client, DealType, InventoryBrand, Lead, Member, Offering, Property, PropertyStakeholder, PropertyUnit } from "@/types/crm";

const schemaByCollection: Record<string, ZodType> = {
  activities: activitySchema,
  clients: clientSchema,
  deals: dealSchema,
  developmentProjects: developmentProjectSchema,
  leads: leadSchema,
  marketingCampaigns: marketingCampaignSchema,
  offerings: offeringSchema,
  properties: propertySchema,
  propertyUnits: unitSchema,
  rentalTenancies: rentalTenancySchema,
  tasks: taskSchema,
};

function moduleSingularTitle(config: ModuleConfig) {
  return config.singularTitle ?? config.title.slice(0, -1);
}

type FormValues = Record<string, string | number | string[] | undefined>;
type SelectOption = { label: string; value: string };
type StakeholderKind = "developer" | "management" | "owner";
type FormValue = FormValues[string];

function calculateFeeAmount(type: string, value: number, baseAmount: number) {
  if (!value || type === "none") {
    return 0;
  }

  if (type === "percentage") {
    return Math.round((baseAmount * value) / 100);
  }

  return value;
}

function toStakeholderOption(stakeholder: PropertyStakeholder): SelectOption {
  const detail = [stakeholder.phoneNumber, stakeholder.email].filter(Boolean).join(" · ");
  return {
    label: detail ? `${stakeholder.name} (${detail})` : stakeholder.name,
    value: stakeholder.id,
  };
}

function groupFields(fields: FormField[]) {
  return fields.reduce<Array<{ fields: FormField[]; title: string }>>((sections, field) => {
    const title = field.section ?? "Details";
    const existing = sections.find((section) => section.title === title);
    if (existing) {
      existing.fields.push(field);
      return sections;
    }

    return [...sections, { fields: [field], title }];
  }, []);
}

function isBlankFormValue(value: FormValue) {
  return value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function shouldShowDealField(field: FormField, category: BusinessVertical | "", dealType: DealType | "") {
  return dealVisibleFieldNames(category, dealType).has(field.name);
}

function clearHiddenDealFields(parsedData: Record<string, unknown>, fields: FormField[], category: BusinessVertical | "", dealType: DealType | "") {
  const visibleFieldNames = dealVisibleFieldNames(category, dealType);
  for (const field of fields) {
    if (visibleFieldNames.has(field.name)) {
      continue;
    }

    parsedData[field.name] = field.type === "textarea" || field.type === "text" || field.type === "select" ? "" : undefined;
  }
}

function offeringTypesForVertical(vertical: BusinessVertical | "") {
  if (vertical === "realEstate") {
    return ["property", "unit", "service", "other"];
  }

  if (vertical === "solar") {
    return ["solarEquipment", "solarService", "installationProject", "maintenance", "consultancy", "other"];
  }

  if (vertical === "buildingMaterials") {
    return ["material", "service", "other"];
  }

  if (vertical === "generalServices") {
    return ["consultancy", "maintenance", "service", "installationProject", "other"];
  }

  return ["property", "unit", "material", "solarEquipment", "solarService", "installationProject", "consultancy", "maintenance", "service", "other"];
}

function shouldShowOfferingField(field: FormField, type: string) {
  const stockFields = new Set(["stockQuantity", "reorderLevel"]);
  const supplierFields = new Set(["supplierName"]);
  const serviceFields = new Set(["serviceDurationDays"]);
  const inventoryTypes = new Set(["material", "solarEquipment"]);
  const serviceTypes = new Set(["solarService", "installationProject", "consultancy", "maintenance", "service"]);

  if (stockFields.has(field.name)) {
    return inventoryTypes.has(type);
  }

  if (supplierFields.has(field.name)) {
    return inventoryTypes.has(type) || type === "other";
  }

  if (serviceFields.has(field.name)) {
    return serviceTypes.has(type);
  }

  return true;
}

function dateInputValue(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString().slice(0, 10);
  }

  return "";
}

function addMonthsToDateInput(value: unknown, months: number) {
  const date = typeof value === "string" && value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function subtractDaysFromDateInput(value: unknown, days: number) {
  const date = typeof value === "string" && value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function monthsForPaymentCycle(value: unknown) {
  if (value === "monthly") {
    return 1;
  }

  if (value === "quarterly") {
    return 3;
  }

  if (value === "biannual") {
    return 6;
  }

  if (value === "annual") {
    return 12;
  }

  return 0;
}

function dealStatusFromLeadStatus(status: unknown) {
  const value = String(status ?? "");
  if (value === "converted") {
    return "won";
  }

  if (["qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "lost", "dormant"].includes(value)) {
    return value;
  }

  return "qualified";
}

function dealTypeFromLeadInterest(interest: unknown) {
  const value = String(interest ?? "");
  if (value === "buy") {
    return "sale";
  }

  if (value === "invest") {
    return "investment";
  }

  if (["rent", "lease"].includes(value)) {
    return value;
  }

  return "other";
}

export function ModuleForm({ config, existing, id, initialValues }: { config: ModuleConfig; existing?: FormValues; id?: string; initialValues?: FormValues }) {
  const router = useRouter();
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [inventoryBrands, setInventoryBrands] = useState<InventoryBrand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [offeringBranchId, setOfferingBranchId] = useState(
    String(existing?.branchId ?? member?.branchId ?? activeBranchId),
  );
  const [brandCreatorOpen, setBrandCreatorOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: "", code: "", contactName: "", contactEmail: "", description: "" });
  const [brandSaving, setBrandSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyUnits, setPropertyUnits] = useState<PropertyUnit[]>([]);
  const [stakeholderForm, setStakeholderForm] = useState({ email: "", name: "", notes: "", phoneNumber: "", type: "owner" as StakeholderKind });
  const [stakeholders, setStakeholders] = useState<PropertyStakeholder[]>([]);
  const [stakeholderSaving, setStakeholderSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const schema = schemaByCollection[config.collection];
  const {
    control,
    formState: { isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<FormValues>({
    defaultValues: existing ?? {
      ...Object.fromEntries(config.fields.map((field) => [field.name, field.required ? field.options?.[0] ?? "" : ""])),
      ...initialValues,
    },
  });

  const sections = groupFields(config.fields);
  const [
    askingPrice,
    rentAmount,
    agencyFeeType,
    agencyFeeValue,
    directAgencyFee,
    commissionType,
    commissionValue,
    agreedAmount,
    offerAmount,
    offeringQuantity,
    offeringUnitPrice,
    serviceCharge,
    cautionFee,
    legalFee,
    leaseStartDate,
    leaseEndDate,
    paymentCycle,
  ] = useWatch({
    control,
    name: ["askingPrice", "rentAmount", "agencyFeeType", "agencyFeeValue", "agencyFee", "commissionType", "commissionValue", "agreedAmount", "offerAmount", "offeringQuantity", "offeringUnitPrice", "serviceCharge", "cautionFee", "legalFee", "leaseStartDate", "leaseEndDate", "paymentCycle"],
  });
  const offeringSubtotal = Number(offeringQuantity || 0) * Number(offeringUnitPrice || 0);
  const basePropertyAmount = Number(askingPrice || rentAmount || 0);
  const calculatedAgencyFee = calculateFeeAmount(String(agencyFeeType ?? ""), Number(agencyFeeValue || 0), basePropertyAmount);
  const baseCommissionAmount = config.collection === "deals" ? Number(agreedAmount || offeringSubtotal || offerAmount || 0) : basePropertyAmount;
  const commissionAmount = calculateFeeAmount(String(commissionType ?? ""), Number(commissionValue || 0), baseCommissionAmount);
  const totalInitialPayment = Number(rentAmount || 0) + Number(serviceCharge || 0) + Number(cautionFee || 0) + Number(directAgencyFee || 0) + Number(legalFee || 0);
  const selectedPropertyId = useWatch({ control, name: "propertyId" });
  const selectedOfferingId = useWatch({ control, name: "offeringId" });
  const selectedLeadId = useWatch({ control, name: "leadId" });
  const selectedUnitId = useWatch({ control, name: "unitId" });
  const selectedDealCategory = useWatch({ control, name: "dealCategory" });
  const selectedDealType = useWatch({ control, name: "dealType" });
  const selectedInterestCategory = useWatch({ control, name: "interestCategory" });
  const selectedOfferingVertical = useWatch({ control, name: "vertical" });
  const selectedOfferingType = useWatch({ control, name: "type" });
  const effectiveDealCategory = config.collection === "deals"
    ? dealCategoryFromFormValue(selectedDealCategory)
      || dealCategoryFromFormValue(existing?.dealCategory)
      || dealCategoryFromFormValue(existing?.offeringVertical)
      || (existing?.propertyId || existing?.unitId ? "realEstate" : "")
    : "";
  const effectiveDealType = config.collection === "deals"
    ? dealTypeFromFormValue(selectedDealType) || dealTypeFromFormValue(existing?.dealType) || "sale"
    : "";
  const branchConstraints = useMemo<QueryConstraint[]>(() => (
    effectiveBranchId(member, activeBranchId) ? [where("branchId", "==", effectiveBranchId(member, activeBranchId))] : []
  ), [activeBranchId, member]);
  const clientConstraints = useMemo<QueryConstraint[]>(() => (
    user && isAssignedOnlySalesUser(member)
      ? [...branchConstraints, where("assignedRelationshipManager", "==", user.uid)]
      : branchConstraints
  ), [branchConstraints, member, user]);
  const leadConstraints = useMemo<QueryConstraint[]>(() => (
    user && (isAssignedOnlySalesUser(member) || !hasPermission(member, "leads.readAll"))
      ? [...branchConstraints, where("assignedTo", "==", user.uid)]
      : branchConstraints
  ), [branchConstraints, member, user]);

  const ownerOptions = useMemo(() => stakeholders.filter((item) => item.type === "owner").map(toStakeholderOption), [stakeholders]);
  const developerOptions = useMemo(() => stakeholders.filter((item) => item.type === "developer").map(toStakeholderOption), [stakeholders]);
  const managementOptions = useMemo(() => stakeholders.filter((item) => item.type === "management").map(toStakeholderOption), [stakeholders]);
  const managerOptions = useMemo(
    () => members
      .filter((item) => item.status === "active")
      .filter((item) => item.branchId === effectiveBranchId(member, activeBranchId))
      .map((item) => {
        const name = item.displayName || item.email || item.id;
        const detail = [item.role, item.email].filter(Boolean).join(" · ");
        return { label: `${name} (${detail})`, value: item.id };
      }),
    [activeBranchId, member, members],
  );
  const propertyOptions = useMemo(
    () => properties.map((item) => {
      const detail = [item.city, item.referenceNumber].filter(Boolean).join(" · ");
      return { label: detail ? `${item.name} (${detail})` : item.name, value: item.id };
    }),
    [properties],
  );
  const clientOptions = useMemo(
    () => clients.map((item) => {
      const detail = [item.phoneNumber, item.email, item.referenceNumber].filter(Boolean).join(" · ");
      return { label: detail ? `${item.fullName} (${detail})` : item.fullName, value: item.id };
    }),
    [clients],
  );
  const leadOptions = useMemo(
    () => leads.map((item) => {
      const detail = [item.phoneNumber, item.email, item.referenceNumber].filter(Boolean).join(" · ");
      return { label: detail ? `${item.fullName} (${detail})` : item.fullName, value: item.id };
    }),
    [leads],
  );
  const unitOptions = useMemo(
    () => propertyUnits
      .filter((item) => !selectedPropertyId || item.propertyId === selectedPropertyId)
      .map((item) => {
        const detail = [item.propertyName, item.referenceNumber].filter(Boolean).join(" · ");
        return { label: detail ? `${item.unitNumber} (${detail})` : item.unitNumber, value: item.id };
      }),
    [propertyUnits, selectedPropertyId],
  );
  const offeringOptions = useMemo(
    () => offerings
      .filter((item) => String(item.status ?? "active") === "active")
      .filter((item) => {
        const category = config.collection === "deals"
          ? effectiveDealCategory
          : config.collection === "leads"
            ? dealCategoryFromFormValue(selectedInterestCategory)
            : "";
        return !category || category === "realEstate" || item.vertical === category;
      })
      .map((item) => {
        const detail = [titleCase(item.vertical), titleCase(item.type), item.referenceNumber].filter(Boolean).join(" · ");
        return { label: detail ? `${item.name} (${detail})` : item.name, value: item.id };
      }),
    [config.collection, effectiveDealCategory, offerings, selectedInterestCategory],
  );
  const inventoryBrandOptions = useMemo(() => inventoryBrands.map((brand) => ({ label: brand.name, value: brand.id })), [inventoryBrands]);

  useEffect(() => {
    if (config.collection !== "offerings") return;
    let mounted = true;
    Promise.all([
      listInventoryBrands(activeOrganizationId, member),
      listBranches(activeOrganizationId),
    ]).then(([brandItems, branchItems]) => {
      if (!mounted) return;
      setInventoryBrands(
        brandItems.filter((item) => item.status === "active"),
      );
      const activeBranches = branchItems.filter(
        (branch) => branch.status !== "closed",
      );
      const accessibleBranches = canAccessAllBranches(member)
        ? activeBranches
        : activeBranches.filter((branch) => branch.id === member?.branchId);
      setBranches(accessibleBranches);
      const preferredBranchId = String(
        existing?.branchId ?? member?.branchId ?? activeBranchId,
      );
      setOfferingBranchId(
        accessibleBranches.some((branch) => branch.id === preferredBranchId)
          ? preferredBranchId
          : (accessibleBranches[0]?.id ?? preferredBranchId),
      );
    }).catch(() => {
      if (mounted) {
        setInventoryBrands([]);
        setBranches([]);
      }
    });
    return () => { mounted = false; };
  }, [activeBranchId, activeOrganizationId, config.collection, existing?.branchId, member]);

  useEffect(() => {
    if (config.collection !== "deals" && config.collection !== "leads" && config.collection !== "properties" && config.collection !== "propertyUnits" && config.collection !== "rentalTenancies" && config.collection !== "developmentProjects" && config.collection !== "marketingCampaigns" && config.collection !== "tasks") {
      return;
    }

    let mounted = true;
    const loadMembers = () => listMembers(activeOrganizationId).catch(() => member ? [member] : []);
    const loadOptions = (() => {
      if (config.collection === "propertyUnits") {
        return Promise.all([
          Promise.resolve<Client[]>([]),
          Promise.resolve<Lead[]>([]),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          Promise.resolve<PropertyUnit[]>([]),
          Promise.resolve<Offering[]>([]),
        ]);
      }

      if (config.collection === "tasks") {
        return Promise.all([
          Promise.resolve<Client[]>([]),
          Promise.resolve<Lead[]>([]),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          Promise.resolve<Property[]>([]),
          Promise.resolve<PropertyUnit[]>([]),
          listOrgRecords<Offering>(activeOrganizationId, "offerings", branchConstraints).catch(() => []),
        ]);
      }

      if (config.collection === "developmentProjects") {
        return Promise.all([
          Promise.resolve<Client[]>([]),
          Promise.resolve<Lead[]>([]),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          Promise.resolve<PropertyUnit[]>([]),
          Promise.resolve<Offering[]>([]),
        ]);
      }

      if (config.collection === "marketingCampaigns") {
        return Promise.all([
          Promise.resolve<Client[]>([]),
          Promise.resolve<Lead[]>([]),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          Promise.resolve<PropertyUnit[]>([]),
          Promise.resolve<Offering[]>([]),
        ]);
      }

      if (config.collection === "rentalTenancies") {
        return Promise.all([
          listOrgRecords<Client>(activeOrganizationId, "clients", clientConstraints).catch(() => []),
          Promise.resolve<Lead[]>([]),
          listOrgRecords<PropertyStakeholder>(activeOrganizationId, "propertyStakeholders", branchConstraints).catch(() => []),
          Promise.resolve<Member[]>([]),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          listOrgRecords<PropertyUnit>(activeOrganizationId, "propertyUnits", branchConstraints).catch(() => []),
          Promise.resolve<Offering[]>([]),
        ]);
      }

      if (config.collection === "deals") {
        return Promise.all([
          listOrgRecords<Client>(activeOrganizationId, "clients", clientConstraints).catch(() => []),
          listOrgRecords<Lead>(activeOrganizationId, "leads", leadConstraints).catch(() => []),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          listOrgRecords<PropertyUnit>(activeOrganizationId, "propertyUnits", branchConstraints).catch(() => []),
          listOrgRecords<Offering>(activeOrganizationId, "offerings", branchConstraints).catch(() => []),
        ]);
      }

      if (config.collection === "leads") {
        return Promise.all([
          Promise.resolve<Client[]>([]),
          Promise.resolve<Lead[]>([]),
          Promise.resolve<PropertyStakeholder[]>([]),
          loadMembers(),
          listOrgRecords<Property>(activeOrganizationId, "properties", branchConstraints).catch(() => []),
          listOrgRecords<PropertyUnit>(activeOrganizationId, "propertyUnits", branchConstraints).catch(() => []),
          listOrgRecords<Offering>(activeOrganizationId, "offerings", branchConstraints).catch(() => []),
        ]);
      }

      return Promise.all([
        Promise.resolve<Client[]>([]),
        Promise.resolve<Lead[]>([]),
        listOrgRecords<PropertyStakeholder>(activeOrganizationId, "propertyStakeholders", branchConstraints).catch(() => []),
        loadMembers(),
        Promise.resolve<Property[]>([]),
        Promise.resolve<PropertyUnit[]>([]),
        Promise.resolve<Offering[]>([]),
      ]);
    })();

    loadOptions
      .then(([nextClients, nextLeads, nextStakeholders, nextMembers, nextProperties, nextPropertyUnits, nextOfferings]) => {
        if (!mounted) {
          return;
        }

        setClients(nextClients);
        setLeads(nextLeads);
        setStakeholders(nextStakeholders);
        setMembers(nextMembers);
        setProperties(nextProperties);
        setPropertyUnits(nextPropertyUnits);
        setOfferings(nextOfferings);
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, branchConstraints, clientConstraints, config.collection, leadConstraints, member]);

  useEffect(() => {
    if (config.collection !== "offerings") {
      return;
    }

    const vertical = dealCategoryFromFormValue(selectedOfferingVertical);
    const allowedTypes = offeringTypesForVertical(vertical);
    const currentType = String(selectedOfferingType ?? "");
    if (vertical && (!currentType || !allowedTypes.includes(currentType))) {
      setValue("type", allowedTypes[0], { shouldDirty: true, shouldValidate: false });
    }
  }, [config.collection, selectedOfferingType, selectedOfferingVertical, setValue]);

  useEffect(() => {
    if (config.collection !== "deals" && config.collection !== "leads") {
      return;
    }

    const category = config.collection === "deals" ? effectiveDealCategory : dealCategoryFromFormValue(selectedInterestCategory);
    if (!category || category === "realEstate" || !selectedOfferingId) {
      return;
    }

    const selectedOffering = offerings.find((offering) => offering.id === selectedOfferingId);
    if (selectedOffering && selectedOffering.vertical !== category) {
      setValue("offeringId", "", { shouldDirty: true, shouldValidate: false });
    }
  }, [config.collection, effectiveDealCategory, offerings, selectedInterestCategory, selectedOfferingId, setValue]);

  useEffect(() => {
    if (config.collection !== "deals" || !effectiveDealCategory) {
      return;
    }

    const allowedDealTypes = dealTypesForCategory(effectiveDealCategory);
    const currentDealType = String(getValues("dealType") ?? "");
    if (currentDealType && !allowedDealTypes.includes(currentDealType)) {
      setValue("dealType", allowedDealTypes[0], { shouldDirty: true, shouldValidate: false });
    }

    if (effectiveDealCategory === "realEstate") {
      if (!isBlankFormValue(getValues("offeringId"))) {
        setValue("offeringId", "", { shouldDirty: true, shouldValidate: false });
      }
      return;
    }

    if (!isBlankFormValue(getValues("propertyId"))) {
      setValue("propertyId", "", { shouldDirty: true, shouldValidate: false });
    }
    if (!isBlankFormValue(getValues("unitId"))) {
      setValue("unitId", "", { shouldDirty: true, shouldValidate: false });
    }
  }, [config.collection, effectiveDealCategory, getValues, setValue]);

  useEffect(() => {
    if ((config.collection !== "rentalTenancies" && config.collection !== "deals" && config.collection !== "leads") || !selectedUnitId) {
      return;
    }

    const selectedUnit = propertyUnits.find((unit) => unit.id === selectedUnitId);
    if (!selectedUnit?.propertyId) {
      return;
    }

    const currentPropertyId = getValues("propertyId");
    if (isBlankFormValue(currentPropertyId) || currentPropertyId !== selectedUnit.propertyId) {
      setValue("propertyId", selectedUnit.propertyId, { shouldDirty: true, shouldValidate: false });
    }

    function setLinkedDefault(fieldName: string, nextValue: FormValue) {
      if (isBlankFormValue(nextValue)) {
        return;
      }

      if (isBlankFormValue(getValues(fieldName))) {
        setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: false });
      }
    }

    if (config.collection === "rentalTenancies") {
      setLinkedDefault("rentAmount", selectedUnit.rentAmount);
      setLinkedDefault("serviceCharge", selectedUnit.serviceCharge);
      setLinkedDefault("cautionFee", selectedUnit.cautionFee);
      setLinkedDefault("legalFee", selectedUnit.legalFee);
    } else if (config.collection === "deals" && (effectiveDealType === "sale" || effectiveDealType === "investment")) {
      setLinkedDefault("offerAmount", selectedUnit.askingPrice ?? selectedUnit.rentAmount);
    }
  }, [config.collection, effectiveDealType, getValues, propertyUnits, selectedUnitId, setValue]);

  useEffect(() => {
    if ((config.collection !== "rentalTenancies" && config.collection !== "deals" && config.collection !== "leads") || !selectedPropertyId) {
      return;
    }

    const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
    if (!selectedProperty) {
      return;
    }

    const selectedUnit = propertyUnits.find((unit) => unit.id === selectedUnitId);
    if (selectedUnit && selectedUnit.propertyId !== selectedPropertyId) {
      setValue("unitId", "", { shouldDirty: true, shouldValidate: false });
    }

    function setLinkedDefault(fieldName: string, nextValue: FormValue) {
      if (isBlankFormValue(nextValue)) {
        return;
      }

      if (isBlankFormValue(getValues(fieldName))) {
        setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: false });
      }
    }

    if (config.collection === "rentalTenancies") {
      setLinkedDefault("landlordOwnerId", selectedProperty.propertyOwnerId);
      if (!selectedUnitId) {
        setLinkedDefault("rentAmount", selectedProperty.rentAmount);
        setLinkedDefault("serviceCharge", selectedProperty.serviceCharge);
        setLinkedDefault("cautionFee", selectedProperty.cautionFee);
        setLinkedDefault("agencyFee", selectedProperty.agencyFee);
        setLinkedDefault("legalFee", selectedProperty.legalFee);
      }
    } else if (config.collection === "deals" && !selectedUnitId && (effectiveDealType === "sale" || effectiveDealType === "investment")) {
      setLinkedDefault("offerAmount", selectedProperty.askingPrice ?? selectedProperty.rentAmount);
    }
  }, [config.collection, effectiveDealType, getValues, properties, propertyUnits, selectedPropertyId, selectedUnitId, setValue]);

  useEffect(() => {
    if (config.collection !== "deals" || !selectedOfferingId) {
      return;
    }

    const selectedOffering = offerings.find((offering) => offering.id === selectedOfferingId);
    if (!selectedOffering) {
      return;
    }

    if (isBlankFormValue(getValues("dealCategory"))) {
      setValue("dealCategory", selectedOffering.vertical, { shouldDirty: true, shouldValidate: false });
    }

    if (isBlankFormValue(getValues("offeringQuantity"))) {
      setValue("offeringQuantity", 1, { shouldDirty: true, shouldValidate: false });
    }

    if (isBlankFormValue(getValues("offeringUnitPrice"))) {
      setValue("offeringUnitPrice", selectedOffering.sellingPrice, { shouldDirty: true, shouldValidate: false });
    }

  }, [config.collection, getValues, offerings, selectedOfferingId, setValue]);

  useEffect(() => {
    if (config.collection !== "deals" || !selectedLeadId) {
      return;
    }

    const selectedLead = leads.find((lead) => lead.id === selectedLeadId);
    if (!selectedLead) {
      return;
    }

    function setDealDefault(fieldName: string, nextValue: FormValue, replaceInitialDefault = false) {
      if (isBlankFormValue(nextValue)) {
        return;
      }

      const currentValue = getValues(fieldName);
      const canReplaceInitialDefault = replaceInitialDefault && !id && (
        (fieldName === "dealType" && currentValue === "sale") ||
        (fieldName === "status" && currentValue === "new")
      );
      if (!isBlankFormValue(currentValue) && !canReplaceInitialDefault) {
        return;
      }

      setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: false });
    }

    setDealDefault("title", `${selectedLead.fullName} ${titleCase(selectedLead.transactionInterest)} deal`);
    setDealDefault("dealType", dealTypeFromLeadInterest(selectedLead.transactionInterest), true);
    setDealDefault("dealCategory", selectedLead.interestCategory ?? selectedLead.offeringVertical ?? (selectedLead.propertyId || selectedLead.unitId ? "realEstate" : ""));
    setDealDefault("status", dealStatusFromLeadStatus(selectedLead.status), true);
    setDealDefault("financeStatus", "notInvoiced");
    setDealDefault("dealOwnerId", selectedLead.assignedTo);
    setDealDefault("propertyId", selectedLead.propertyId);
    setDealDefault("unitId", selectedLead.unitId);
    setDealDefault("offeringId", selectedLead.offeringId);
    const inheritedBudget = selectedLead.budgetMaximum ?? selectedLead.budgetMinimum;
    const inheritedDealType = dealTypeFromLeadInterest(selectedLead.transactionInterest);
    if (inheritedDealType === "sale" || inheritedDealType === "investment") {
      setDealDefault("offerAmount", inheritedBudget);
    } else if (inheritedDealType === "reservation") {
      setDealDefault("reservationAmount", inheritedBudget);
    } else {
      setDealDefault("agreedAmount", inheritedBudget);
    }
    setDealDefault("closeProbability", selectedLead.score);
  }, [config.collection, getValues, id, leads, selectedLeadId, setValue]);

  useEffect(() => {
    if (config.collection !== "rentalTenancies" || id) {
      return;
    }

    if (leaseStartDate && isBlankFormValue(getValues("moveInDate"))) {
      setValue("moveInDate", String(leaseStartDate), { shouldDirty: true, shouldValidate: false });
    }

    if (leaseStartDate && paymentCycle && isBlankFormValue(getValues("nextRentDueDate"))) {
      const cycleMonths = monthsForPaymentCycle(paymentCycle);
      const nextDueDate = cycleMonths ? addMonthsToDateInput(leaseStartDate, cycleMonths) : String(leaseEndDate || leaseStartDate);
      if (nextDueDate) {
        setValue("nextRentDueDate", nextDueDate, { shouldDirty: true, shouldValidate: false });
      }
    }

    if (leaseEndDate && isBlankFormValue(getValues("renewalNoticeDate"))) {
      const renewalDate = subtractDaysFromDateInput(leaseEndDate, 30);
      if (renewalDate) {
        setValue("renewalNoticeDate", renewalDate, { shouldDirty: true, shouldValidate: false });
      }
    }
  }, [config.collection, getValues, id, leaseEndDate, leaseStartDate, paymentCycle, setValue]);

  useEffect(() => {
    if (config.collection !== "propertyUnits" || !selectedPropertyId) {
      return;
    }

    const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
    if (!selectedProperty) {
      return;
    }

    function setUnitDefault(fieldName: string, nextValue: FormValue) {
      if (isBlankFormValue(nextValue)) {
        return;
      }

      const currentValue = getValues(fieldName);
      const canReplaceDefaultStatus = fieldName === "status" && !id && currentValue === "draft";
      if (isBlankFormValue(currentValue) || canReplaceDefaultStatus) {
        setValue(fieldName, nextValue, { shouldDirty: true, shouldValidate: false });
      }
    }

    setUnitDefault("status", selectedProperty.propertyStatus);
    setUnitDefault("size", selectedProperty.size);
    setUnitDefault("sizeUnit", selectedProperty.sizeUnit);
    setUnitDefault("bedrooms", selectedProperty.bedrooms);
    setUnitDefault("bathrooms", selectedProperty.bathrooms);
    setUnitDefault("toilets", selectedProperty.toilets);
    setUnitDefault("parkingSpaces", selectedProperty.parkingSpaces);
    setUnitDefault("furnishingStatus", selectedProperty.furnishingStatus);
    setUnitDefault("features", selectedProperty.features?.join(", "));
    setUnitDefault("askingPrice", selectedProperty.askingPrice);
    setUnitDefault("rentAmount", selectedProperty.rentAmount);
    setUnitDefault("serviceCharge", selectedProperty.serviceCharge);
    setUnitDefault("cautionFee", selectedProperty.cautionFee);
    setUnitDefault("legalFee", selectedProperty.legalFee);
    setUnitDefault("availabilityDate", dateInputValue(selectedProperty.availabilityDate));
  }, [config.collection, getValues, id, properties, selectedPropertyId, setValue]);

  function setLeadLocationField(fieldName: string, value: string) {
    setValue(fieldName, value, { shouldDirty: true, shouldValidate: false });
  }

  function captureLeadLocation() {
    setError(null);

    if (!("geolocation" in navigator)) {
      const message = "This browser does not support location capture.";
      setError(message);
      toast({ title: "Unable to capture location", description: message, variant: "error" });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLeadLocationField("geoLatitude", position.coords.latitude.toFixed(6));
        setLeadLocationField("geoLongitude", position.coords.longitude.toFixed(6));
        setLeadLocationField("geoAccuracy", Math.round(position.coords.accuracy || 0).toString());
        setLeadLocationField("geoCapturedAt", new Date().toISOString());
        setLocating(false);
        toast({ title: "Lead location captured", description: "Save the lead to keep the updated map location.", variant: "success" });
      },
      (locationError) => {
        setLocating(false);
        const message = locationError.message || "Unable to capture location. Check browser location permissions.";
        setError(message);
        toast({ title: "Unable to capture location", description: message, variant: "error" });
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 },
    );
  }

  function clearLeadLocation() {
    setLeadLocationField("geoAccuracy", "");
    setLeadLocationField("geoAddress", "");
    setLeadLocationField("geoCapturedAt", "");
    setLeadLocationField("geoLatitude", "");
    setLeadLocationField("geoLongitude", "");
  }

  async function onSubmit(values: FormValues) {
    if (!user) {
      const message = "You must be signed in to save records.";
      setError(message);
      toast({ title: "Unable to save record", description: message, variant: "error" });
      return;
    }

    setError(null);
    setValidationErrors({});
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const nextValidationErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
      setValidationErrors(nextValidationErrors);
      toast({ title: "Check required fields", description: Object.values(nextValidationErrors)[0] ?? "Some fields need attention.", variant: "error" });
      return;
    }

    const parsedData = parsed.data as Record<string, unknown>;
    const recordBranchId =
      config.collection === "offerings"
        ? offeringBranchId || member?.branchId || activeBranchId
        : activeBranchId;
    if (
      config.collection === "offerings" &&
      (!recordBranchId || !canAccessBranch(member, recordBranchId))
    ) {
      const message = "Select a branch you are authorized to access.";
      setError(message);
      toast({
        title: "Branch access required",
        description: message,
        variant: "error",
      });
      return;
    }
    if (config.collection === "properties") {
      parsedData.agencyFee = calculatedAgencyFee;
      parsedData.commissionAmount = commissionAmount;
    }

    if (config.collection === "offerings") {
      const brand = inventoryBrands.find((item) => item.id === parsedData.brandId);
      parsedData.brandName = brand?.name ?? "";
      if (!String(parsedData.sku ?? "").trim()) {
        parsedData.sku = createReference("SKU");
      }
      const offeringType = String(parsedData.type ?? "");
      const isInventoryOffering = ["material", "solarEquipment"].includes(offeringType);
      const isServiceOffering = ["solarService", "installationProject", "consultancy", "maintenance", "service"].includes(offeringType);
      if (!isInventoryOffering) {
        parsedData.stockQuantity = undefined;
        parsedData.reorderLevel = undefined;
      }

      if (!isInventoryOffering && offeringType !== "other") {
        parsedData.supplierName = "";
      }

      if (!isServiceOffering) {
        parsedData.serviceDurationDays = undefined;
      }
    }

    if (config.collection === "deals" && !parsedData.dealOwnerId) {
      parsedData.dealOwnerId = user.uid;
    }

    if (config.collection === "deals") {
      const linkedLead = leads.find((item) => item.id === parsedData.leadId);
      const linkedClient = clients.find((item) => item.id === parsedData.clientId);
      const linkedProperty = properties.find((item) => item.id === parsedData.propertyId);
      const linkedUnit = propertyUnits.find((item) => item.id === parsedData.unitId);
      const linkedOffering = offerings.find((item) => item.id === parsedData.offeringId);
      const dealOwner = members.find((item) => item.id === parsedData.dealOwnerId);
      const resolvedDealCategory = dealCategoryFromFormValue(parsedData.dealCategory)
        || dealCategoryFromFormValue(linkedOffering?.vertical)
        || dealCategoryFromFormValue(linkedLead?.interestCategory)
        || dealCategoryFromFormValue(linkedLead?.offeringVertical)
        || (linkedProperty || linkedUnit ? "realEstate" : "");
      const resolvedDealType = dealTypeFromFormValue(parsedData.dealType) || "sale";
      parsedData.dealCategory = resolvedDealCategory || undefined;
      parsedData.leadName = linkedLead?.fullName ?? "";
      parsedData.clientName = linkedClient?.fullName ?? "";
      parsedData.clientPhone = linkedClient?.phoneNumber ?? linkedLead?.phoneNumber ?? "";
      parsedData.clientEmail = linkedClient?.email ?? linkedLead?.email ?? "";
      parsedData.propertyName = linkedProperty?.name ?? linkedUnit?.propertyName ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? linkedUnit?.propertyReferenceNumber ?? "";
      parsedData.unitName = linkedUnit?.unitNumber ?? "";
      parsedData.offeringName = linkedOffering?.name ?? "";
      parsedData.offeringReferenceNumber = linkedOffering?.referenceNumber ?? "";
      parsedData.offeringType = linkedOffering?.type ?? undefined;
      parsedData.offeringVertical = linkedOffering?.vertical ?? undefined;
      parsedData.quoteSubtotal = offeringSubtotal || undefined;
      clearHiddenDealFields(parsedData, config.fields, resolvedDealCategory, resolvedDealType);
      if (resolvedDealCategory === "realEstate") {
        parsedData.offeringId = "";
        parsedData.offeringName = "";
        parsedData.offeringReferenceNumber = "";
        parsedData.offeringType = undefined;
        parsedData.offeringVertical = undefined;
        parsedData.offeringQuantity = undefined;
        parsedData.offeringUnitPrice = undefined;
        parsedData.quoteSubtotal = undefined;
        parsedData.proposalStatus = undefined;
        parsedData.fulfillmentStatus = undefined;
        parsedData.fulfillmentDueDate = undefined;
        parsedData.scopeOfWork = "";
        parsedData.deliveryNotes = "";
      } else if (resolvedDealCategory) {
        parsedData.offerAmount = undefined;
        parsedData.propertyId = "";
        parsedData.propertyName = "";
        parsedData.propertyReferenceNumber = "";
        parsedData.unitId = "";
        parsedData.unitName = "";
        parsedData.legalStatus = undefined;
      }
      parsedData.dealOwnerName = dealOwner?.displayName ?? "";
      parsedData.dealOwnerEmail = dealOwner?.email ?? "";
      parsedData.commissionAmount = commissionAmount;
    }

    if (config.collection === "leads") {
      const linkedProperty = properties.find((item) => item.id === parsedData.propertyId);
      const linkedUnit = propertyUnits.find((item) => item.id === parsedData.unitId);
      const linkedOffering = offerings.find((item) => item.id === parsedData.offeringId);
      parsedData.propertyName = linkedProperty?.name ?? linkedUnit?.propertyName ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? linkedUnit?.propertyReferenceNumber ?? "";
      parsedData.unitName = linkedUnit?.unitNumber ?? "";
      parsedData.offeringName = linkedOffering?.name ?? "";
      parsedData.offeringReferenceNumber = linkedOffering?.referenceNumber ?? "";
      parsedData.offeringType = linkedOffering?.type ?? undefined;
      parsedData.offeringVertical = linkedOffering?.vertical ?? undefined;
    }

    if (config.collection === "propertyUnits") {
      const linkedProperty = properties.find((property) => property.id === parsedData.propertyId);
      parsedData.propertyName = linkedProperty?.name ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? "";
    }

    if (config.collection === "leads" && !parsedData.assignedTo) {
      parsedData.assignedTo = user.uid;
    }

    if (config.collection === "leads") {
      const assignedMember = members.find((item) => item.id === parsedData.assignedTo);
      parsedData.assignedToName = assignedMember?.displayName ?? member?.displayName ?? user.displayName ?? "";
      parsedData.assignedToEmail = assignedMember?.email ?? member?.email ?? user.email ?? "";
    }

    if (config.collection === "clients" && !parsedData.assignedRelationshipManager) {
      parsedData.assignedRelationshipManager = user.uid;
    }

    if (config.collection === "tasks" && !parsedData.assignedTo) {
      parsedData.assignedTo = user.uid;
    }

    if (config.collection === "tasks") {
      const assignedMember = members.find((item) => item.id === parsedData.assignedTo);
      parsedData.assignedToName = assignedMember?.displayName ?? "";
      parsedData.assignedToEmail = assignedMember?.email ?? "";
    }

    if (config.collection === "rentalTenancies") {
      const tenant = clients.find((item) => item.id === parsedData.tenantClientId);
      const linkedProperty = properties.find((item) => item.id === parsedData.propertyId);
      const linkedUnit = propertyUnits.find((item) => item.id === parsedData.unitId);
      const landlord = stakeholders.find((item) => item.id === parsedData.landlordOwnerId);
      parsedData.tenantName = tenant?.fullName ?? "";
      parsedData.tenantEmail = tenant?.email ?? "";
      parsedData.tenantPhone = tenant?.phoneNumber ?? "";
      parsedData.propertyName = linkedProperty?.name ?? linkedUnit?.propertyName ?? "";
      parsedData.unitName = linkedUnit?.unitNumber ?? "";
      parsedData.landlordOwnerName = landlord?.name ?? "";
      parsedData.totalInitialPayment = totalInitialPayment;
    }

    if (config.collection === "developmentProjects") {
      const linkedProperty = properties.find((item) => item.id === parsedData.propertyId);
      const projectManager = members.find((item) => item.id === parsedData.projectManagerId);
      parsedData.propertyName = linkedProperty?.name ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? "";
      parsedData.projectManagerName = projectManager?.displayName ?? "";
      parsedData.projectManagerEmail = projectManager?.email ?? "";
    }

    if (config.collection === "marketingCampaigns") {
      const linkedProperty = properties.find((item) => item.id === parsedData.propertyId);
      const campaignManager = members.find((item) => item.id === parsedData.campaignManagerId);
      parsedData.propertyName = linkedProperty?.name ?? "";
      parsedData.propertyReferenceNumber = linkedProperty?.referenceNumber ?? "";
      parsedData.campaignManagerName = campaignManager?.displayName ?? "";
      parsedData.campaignManagerEmail = campaignManager?.email ?? "";
    }

    const context = {
      branchId: recordBranchId,
      organizationId: activeOrganizationId,
      userEmail: member?.email || user.email || "",
      userId: user.uid,
      userName: member?.displayName || user.displayName || user.email || "",
    };
    try {
      if (id) {
        await updateOrgRecord(config.collection, id, parsedData, context);
        await writeAuditLog(context, "record.update", config.collection, id, parsedData);
      } else {
        const createdId = await createOrgRecord(config.collection, parsedData, context, config.prefix);
        await writeAuditLog(context, "record.create", config.collection, createdId, parsedData);
      }

      toast({
        title: id ? "Record updated" : "Record created",
        description: `${moduleSingularTitle(config)} ${id ? "updated" : "created"} successfully.`,
        variant: "success",
      });
      router.push(config.route);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to save record.";
      setError(message);
      toast({ title: "Unable to save record", description: message, variant: "error" });
    }
  }

  function optionsForField(field: FormField): SelectOption[] {
    if (field.optionSource === "propertyOwners") {
      return ownerOptions;
    }

    if (field.optionSource === "propertyDevelopers") {
      return developerOptions;
    }

    if (field.optionSource === "managementCompanies") {
      return managementOptions;
    }

    if (field.optionSource === "clients") {
      return clientOptions;
    }

    if (field.optionSource === "leads") {
      return leadOptions;
    }

    if (field.optionSource === "properties") {
      return propertyOptions;
    }

    if (field.optionSource === "propertyUnits") {
      return unitOptions;
    }

    if (field.optionSource === "offerings") {
      return offeringOptions;
    }

    if (field.optionSource === "inventoryBrands") {
      return inventoryBrandOptions;
    }

    if (config.collection === "deals" && field.name === "dealType") {
      return dealTypesForCategory(effectiveDealCategory).map((value) => ({ label: titleCase(value), value }));
    }

    if (config.collection === "offerings" && field.name === "type") {
      return offeringTypesForVertical(dealCategoryFromFormValue(selectedOfferingVertical)).map((value) => ({ label: titleCase(value), value }));
    }

    if (field.optionSource === "internalManagers") {
      return managerOptions;
    }

    return field.options?.map((option) => ({ label: option === "offering" ? "Product/service" : option, value: option })) ?? [];
  }

  async function createStakeholder() {
    if (!user) {
      const message = "You must be signed in to create ownership records.";
      setError(message);
      toast({ title: "Unable to create ownership record", description: message, variant: "error" });
      return;
    }

    if (!stakeholderForm.name.trim()) {
      const message = "Enter a name before creating the ownership record.";
      setError(message);
      toast({ title: "Name required", description: message, variant: "error" });
      return;
    }

    const context = {
      branchId: offeringBranchId || member?.branchId || activeBranchId,
      organizationId: activeOrganizationId,
      userEmail: member?.email || user.email || "",
      userId: user.uid,
      userName: member?.displayName || user.displayName || user.email || "",
    };
    setStakeholderSaving(true);
    setError(null);
    try {
      const stakeholderId = await createOrgRecord("propertyStakeholders", {
        email: stakeholderForm.email.trim(),
        name: stakeholderForm.name.trim(),
        notes: stakeholderForm.notes.trim(),
        phoneNumber: stakeholderForm.phoneNumber.trim(),
        status: "active",
        type: stakeholderForm.type,
      }, context, "PTY");
      await writeAuditLog(context, "propertyStakeholder.create", "propertyStakeholders", stakeholderId, stakeholderForm);
      const nextStakeholders = await listOrgRecords<PropertyStakeholder>(activeOrganizationId, "propertyStakeholders", branchConstraints);
      setStakeholders(nextStakeholders);

      if (stakeholderForm.type === "owner") {
        setValue("propertyOwnerId", stakeholderId);
      } else if (stakeholderForm.type === "developer") {
        setValue("developerId", stakeholderId);
      } else {
        setValue("managementCompanyId", stakeholderId);
      }

      setStakeholderForm({ email: "", name: "", notes: "", phoneNumber: "", type: stakeholderForm.type });
      toast({ title: "Ownership record created", description: `${stakeholderForm.name.trim()} is now available for selection.`, variant: "success" });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to create ownership record.";
      setError(message);
      toast({ title: "Unable to create ownership record", description: message, variant: "error" });
    } finally {
      setStakeholderSaving(false);
    }
  }

  async function createBrand() {
    if (!user) {
      const message = "You must be signed in to create a brand.";
      setError(message);
      toast({ title: "Unable to create brand", description: message, variant: "error" });
      return;
    }

    const name = brandForm.name.trim();
    const code = brandForm.code.trim().toUpperCase();
    if (!name) {
      const message = "Enter a brand name.";
      setError(message);
      toast({ title: "Brand details required", description: message, variant: "error" });
      return;
    }

    const existingBrand = inventoryBrands.find((brand) => brand.name.trim().toLowerCase() === name.toLowerCase());
    if (existingBrand) {
      setValue("brandId", existingBrand.id, { shouldDirty: true, shouldValidate: true });
      setBrandCreatorOpen(false);
      setBrandForm({ name: "", code: "", contactName: "", contactEmail: "", description: "" });
      toast({ title: "Existing brand selected", description: `${existingBrand.name} is now selected for this product.`, variant: "success" });
      return;
    }

    const duplicateCode = code
      ? inventoryBrands.find((brand) => brand.code?.trim().toLowerCase() === code.toLowerCase())
      : undefined;
    if (duplicateCode) {
      const message = `Brand code ${code} is already used by ${duplicateCode.name}.`;
      setError(message);
      toast({ title: "Brand code already exists", description: message, variant: "error" });
      return;
    }

    const context = {
      branchId: activeBranchId,
      organizationId: activeOrganizationId,
      userEmail: member?.email || user.email || "",
      userId: user.uid,
      userName: member?.displayName || user.displayName || user.email || "",
    };
    setBrandSaving(true);
    setError(null);
    try {
      const brandId = await createInventoryBrand({
        code,
        contactEmail: brandForm.contactEmail.trim(),
        contactName: brandForm.contactName.trim(),
        description: brandForm.description.trim(),
        name,
        status: "active",
      }, context);
      const nextBrands = (await listInventoryBrands(activeOrganizationId, member)).filter((brand) => brand.status === "active");
      setInventoryBrands(nextBrands);
      setValue("brandId", brandId, { shouldDirty: true, shouldValidate: true });
      setBrandCreatorOpen(false);
      setBrandForm({ name: "", code: "", contactName: "", contactEmail: "", description: "" });
      toast({ title: "Brand created", description: `${name} was created and selected for this product.`, variant: "success" });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to create brand.";
      setError(message);
      toast({ title: "Unable to create brand", description: message, variant: "error" });
    } finally {
      setBrandSaving(false);
    }
  }

  function isFieldVisible(field: FormField) {
    if (config.collection !== "deals") {
      return config.collection === "offerings" ? shouldShowOfferingField(field, String(selectedOfferingType ?? "")) : true;
    }

    return shouldShowDealField(field, effectiveDealCategory, effectiveDealType);
  }
  const tourSteps = formTourSteps(config, config.fields.filter(isFieldVisible));

  return (
    <Card>
      <CardContent>
        {tourSteps.length ? (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <AiGuideLink question={`How do I fill the ${config.title} form in Vlingo Systems CRM? Explain the important fields, required permissions, and common mistakes.`} size="sm" />
            <GuidedTour autoStart={!id && config.collection === "deals"} storageKey={`beacon-tour:${config.collection}:form`} steps={tourSteps} />
          </div>
        ) : null}
        <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
          {error ? <ErrorState message={error} /> : null}
          {config.collection === "offerings" ? (
            <section className="grid gap-3 rounded-md border bg-muted/30 p-4">
              <div>
                <h2 className="text-base font-semibold">Inventory branch</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  New products default to your assigned branch. Users with
                  all-branch access can choose another branch before saving.
                </p>
              </div>
              <Field label="Product branch">
                <Select
                  disabled={Boolean(id) || !canAccessAllBranches(member)}
                  required
                  value={offeringBranchId}
                  onChange={(event) => setOfferingBranchId(event.target.value)}
                >
                  {!branches.length && offeringBranchId ? (
                    <option value={offeringBranchId}>{offeringBranchId}</option>
                  ) : null}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </section>
          ) : null}
          <div className="grid gap-6">
            {sections.map((section) => {
              const visibleFields = section.fields.filter(isFieldVisible);
              if (!visibleFields.length) {
                return null;
              }

              return (
              <section className="grid gap-4 border-t pt-5 first:border-t-0 first:pt-0" key={section.title}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-base font-semibold">{section.title}</h2>
                  {config.collection === "leads" && section.title === "Map location" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={locating} onClick={captureLeadLocation} type="button" variant="outline">
                        <Crosshair className="h-4 w-4" />
                        {locating ? "Capturing" : "Use current location"}
                      </Button>
                      <Button onClick={clearLeadLocation} type="button" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  ) : null}
                </div>
                {config.collection === "leads" && section.title === "Map location" ? (
                  <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>Capture or edit the coordinates used by the Lead Locations map. Browser location requires HTTPS or localhost.</span>
                  </div>
                ) : null}
                {config.collection === "properties" && section.title === "Ownership and management" ? (
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
                    <div className="grid gap-3 lg:grid-cols-4">
                      <Field label="Record type">
                        <Select value={stakeholderForm.type} onChange={(event) => setStakeholderForm((current) => ({ ...current, type: event.target.value as StakeholderKind }))}>
                          <option value="owner">Owner</option>
                          <option value="developer">Developer</option>
                          <option value="management">Management</option>
                        </Select>
                      </Field>
                      <Field label="Name">
                        <Input value={stakeholderForm.name} onChange={(event) => setStakeholderForm((current) => ({ ...current, name: event.target.value }))} />
                      </Field>
                      <Field label="Phone">
                        <Input value={stakeholderForm.phoneNumber} onChange={(event) => setStakeholderForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
                      </Field>
                      <Field label="Email">
                        <Input type="email" value={stakeholderForm.email} onChange={(event) => setStakeholderForm((current) => ({ ...current, email: event.target.value }))} />
                      </Field>
                    </div>
                    <Field label="Notes">
                      <Textarea value={stakeholderForm.notes} onChange={(event) => setStakeholderForm((current) => ({ ...current, notes: event.target.value }))} />
                    </Field>
                    <div className="flex justify-end">
                      <Button disabled={stakeholderSaving} onClick={createStakeholder} type="button" variant="outline">
                        {stakeholderSaving ? "Creating" : "Create record"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  {visibleFields.map((field) => {
                    const canCreateBrand = config.collection === "offerings" && field.name === "brandId" && hasPermission(member, "inventory.manageCatalog");
                    const fieldRegistration = register(field.name);
                    return (
                    <div className={cn(field.colSpan === "full" && "lg:col-span-2")} data-tour={fieldTourTarget(config.collection, field.name)} key={field.name}>
                      <Field label={field.label} error={validationErrors[field.name]}>
                        <div className="grid gap-1.5">
                          {field.type === "textarea" ? (
                            <Textarea placeholder={field.placeholder} readOnly={field.readOnly} {...fieldRegistration} />
                          ) : field.type === "select" ? (
                            <Select
                              {...fieldRegistration}
                              onChange={canCreateBrand ? (event) => {
                                if (event.target.value === "__create_brand__") {
                                  setValue("brandId", "", { shouldDirty: true });
                                  setBrandCreatorOpen(true);
                                  return;
                                }
                                void fieldRegistration.onChange(event);
                              } : fieldRegistration.onChange}
                            >
                              <option value="">Select {field.label.toLowerCase()}</option>
                              {optionsForField(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              {canCreateBrand ? <option value="__create_brand__">+ Create new brand</option> : null}
                            </Select>
                          ) : config.collection === "properties" && field.name === "agencyFee" ? (
                            <Input readOnly type="number" value={calculatedAgencyFee} />
                          ) : field.name === "commissionAmount" ? (
                            <Input readOnly type="number" value={commissionAmount} />
                          ) : field.name === "quoteSubtotal" ? (
                            <Input readOnly type="number" value={offeringSubtotal} />
                          ) : field.name === "totalInitialPayment" ? (
                            <Input readOnly type="number" value={totalInitialPayment} />
                          ) : field.name === "geoLatitude" || field.name === "geoLongitude" ? (
                            <Input inputMode="decimal" placeholder={field.placeholder} readOnly={field.readOnly} step="any" {...fieldRegistration} type="number" />
                          ) : (
                            <Input placeholder={field.placeholder} readOnly={field.readOnly} {...fieldRegistration} type={field.type} />
                          )}
                          {canCreateBrand ? (
                            <Button className="w-fit" disabled={brandSaving} onClick={() => setBrandCreatorOpen(true)} size="sm" type="button" variant="outline">
                              <Plus className="h-4 w-4" />
                              Create brand
                            </Button>
                          ) : null}
                          {field.helpText ? <span className="text-xs font-normal text-muted-foreground">{field.helpText}</span> : null}
                        </div>
                      </Field>
                      {canCreateBrand && brandCreatorOpen ? (
                        <div className="mt-3 grid gap-3 rounded-md border bg-muted/30 p-3">
                          <p className="text-sm font-semibold">Create a new brand</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Brand name">
                              <Input autoFocus required value={brandForm.name} onChange={(event) => setBrandForm((current) => ({ ...current, name: event.target.value }))} />
                            </Field>
                            <Field label="Brand code (optional)">
                              <Input value={brandForm.code} onChange={(event) => setBrandForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
                            </Field>
                            <Field label="Partner contact name">
                              <Input value={brandForm.contactName} onChange={(event) => setBrandForm((current) => ({ ...current, contactName: event.target.value }))} />
                            </Field>
                            <Field label="Partner contact email">
                              <Input type="email" value={brandForm.contactEmail} onChange={(event) => setBrandForm((current) => ({ ...current, contactEmail: event.target.value }))} />
                            </Field>
                          </div>
                          <Field label="Description">
                            <Textarea value={brandForm.description} onChange={(event) => setBrandForm((current) => ({ ...current, description: event.target.value }))} />
                          </Field>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button disabled={brandSaving} onClick={() => setBrandCreatorOpen(false)} size="sm" type="button" variant="ghost">Cancel</Button>
                            <Button disabled={brandSaving} onClick={createBrand} size="sm" type="button">
                              <Plus className="h-4 w-4" />
                              {brandSaving ? "Creating" : "Create and select brand"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </section>
              );
            })}
          </div>
          <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] -mx-5 -mb-5 border-t bg-white p-4 md:static md:m-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
            <Button className="h-12 w-full md:h-10 md:w-auto" data-tour={fieldTourTarget(config.collection, "save")} disabled={isSubmitting} type="submit">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Saving" : "Save record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
