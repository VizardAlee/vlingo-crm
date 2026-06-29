"use client";

import { readSheet } from "read-excel-file/browser";
import { where, type QueryConstraint } from "firebase/firestore";
import { CheckCircle2, Download, FileSpreadsheet, Save, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches, hasPermission, memberRoles } from "@/lib/permissions";
import { leadSchema } from "@/lib/validation/schemas";
import { createOrgRecord, listOrgRecords, writeAuditLog } from "@/services/repository";
import { listBranches, listMembers } from "@/services/users";
import type { Branch, Member, Property, PropertyUnit } from "@/types/crm";

type LeadFormState = Record<string, string>;

interface PreviewLead {
  data: Record<string, unknown>;
  errors: string[];
  rowNumber: number;
}

interface ImportSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

const leadStatuses = ["new", "contacted", "qualified", "propertyRecommended", "inspectionScheduled", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "converted", "lost", "dormant"];
const leadSources = ["Website", "Facebook", "Instagram", "Google Ads", "WhatsApp", "Referral", "Agent", "Walk-in", "Phone call", "Property portal", "Event", "Other"];
const platforms = ["Meta", "Google", "TikTok", "LinkedIn", "PropertyPro", "PrivateProperty", "WhatsApp", "Website", "Manual", "Other"];
const propertyTypes = ["Apartment", "Terrace", "Detached house", "Semi-detached house", "Bungalow", "Land", "Commercial", "Shortlet", "Office", "Warehouse", "Mixed-use"];
const interests = ["buy", "rent", "lease", "invest"];
const paymentPreferences = ["outright", "installment", "mortgage", "leasePlan", "notDecided"];
const temperatures = ["cold", "warm", "hot"];
const contactPreferences = ["phone", "whatsapp", "email", "sms"];

const defaultLead: LeadFormState = {
  assignedTo: "",
  budgetMaximum: "",
  budgetMinimum: "",
  campaignName: "",
  contactPreference: "whatsapp",
  email: "",
  fullName: "",
  intendedUse: "",
  leadTemperature: "warm",
  nextFollowUpAt: "",
  notes: "",
  paymentPreference: "notDecided",
  phoneNumber: "",
  propertyId: "",
  propertyName: "",
  propertyReferenceNumber: "",
  preferredBedrooms: "",
  preferredBudgetCurrency: "NGN",
  preferredCity: "",
  preferredInspectionDate: "",
  preferredLocation: "",
  preferredPropertyCategory: "",
  preferredState: "",
  propertyType: "",
  referralName: "",
  referralPhone: "",
  score: "25",
  source: "Website",
  sourcePlatform: "Manual",
  sourceReference: "",
  status: "new",
  tags: "",
  transactionInterest: "buy",
  unitId: "",
  unitName: "",
  whatsappNumber: "",
};

const headerAliases: Record<string, string[]> = {
  assignedTo: ["assignedto", "assignee", "agent", "assignedagent", "owner", "salesperson"],
  budgetMaximum: ["budgetmaximum", "maxbudget", "budgetmax", "maximumbudget", "budgetto"],
  budgetMinimum: ["budgetminimum", "minbudget", "budgetmin", "minimumbudget", "budgetfrom"],
  campaignName: ["campaign", "campaignname", "adcampaign"],
  contactPreference: ["contactpreference", "preferredcontact", "bestcontact"],
  email: ["email", "emailaddress"],
  fullName: ["fullname", "name", "clientname", "leadname", "customername"],
  intendedUse: ["intendeduse", "purpose", "use"],
  leadTemperature: ["temperature", "leadtemperature", "priority"],
  nextFollowUpAt: ["nextfollowup", "nextfollowupdate", "followup", "followupdate"],
  notes: ["notes", "comment", "comments", "remark", "remarks"],
  paymentPreference: ["paymentpreference", "paymentplan", "paymentmethod"],
  phoneNumber: ["phone", "phonenumber", "mobile", "mobilenumber", "telephone"],
  propertyId: ["propertyid", "listingid"],
  propertyName: ["property", "propertyname", "listing", "listingname"],
  propertyReferenceNumber: ["propertyreference", "propertyreferencenumber", "listingreference", "propertyref", "listingref"],
  preferredBedrooms: ["bedrooms", "beds", "preferredbedrooms"],
  preferredBudgetCurrency: ["currency", "budgetcurrency", "preferredbudgetcurrency"],
  preferredCity: ["city", "preferredcity"],
  preferredInspectionDate: ["inspectiondate", "preferredinspectiondate", "viewingdate", "tourdate"],
  preferredLocation: ["location", "preferredlocation", "area", "neighborhood"],
  preferredPropertyCategory: ["category", "propertycategory"],
  preferredState: ["state", "preferredstate"],
  propertyType: ["propertytype", "type"],
  referralName: ["referralname", "referrer", "referredby"],
  referralPhone: ["referralphone", "referrerphone"],
  score: ["score", "leadscore"],
  source: ["source", "leadsource", "origin"],
  sourcePlatform: ["platform", "sourceplatform", "channel"],
  sourceReference: ["reference", "sourcereference", "externalid", "leadid"],
  status: ["status", "leadstatus", "stage", "pipeline"],
  tags: ["tags", "tag"],
  transactionInterest: ["interest", "transactioninterest", "transaction", "intent"],
  unitId: ["unitid"],
  unitName: ["unit", "unitname", "unitnumber"],
  whatsappNumber: ["whatsapp", "whatsappnumber"],
};

const importFields = [
  { key: "fullName", label: "Full name", required: true },
  { key: "phoneNumber", label: "Phone number", required: true },
  { key: "whatsappNumber", label: "WhatsApp number" },
  { key: "email", label: "Email" },
  { key: "contactPreference", label: "Contact preference" },
  { key: "source", label: "Source" },
  { key: "sourcePlatform", label: "Platform" },
  { key: "campaignName", label: "Campaign name" },
  { key: "sourceReference", label: "External reference" },
  { key: "transactionInterest", label: "Transaction interest" },
  { key: "propertyId", label: "Property ID" },
  { key: "propertyName", label: "Property name" },
  { key: "propertyReferenceNumber", label: "Property reference" },
  { key: "unitId", label: "Unit ID" },
  { key: "unitName", label: "Unit name/number" },
  { key: "propertyType", label: "Property type" },
  { key: "preferredPropertyCategory", label: "Property category" },
  { key: "preferredBedrooms", label: "Bedrooms" },
  { key: "preferredLocation", label: "Preferred location" },
  { key: "preferredState", label: "State" },
  { key: "preferredCity", label: "City" },
  { key: "preferredBudgetCurrency", label: "Currency" },
  { key: "budgetMinimum", label: "Budget minimum" },
  { key: "budgetMaximum", label: "Budget maximum" },
  { key: "paymentPreference", label: "Payment preference" },
  { key: "intendedUse", label: "Intended use" },
  { key: "status", label: "Status" },
  { key: "score", label: "Score" },
  { key: "leadTemperature", label: "Lead temperature" },
  { key: "nextFollowUpAt", label: "Next follow-up" },
  { key: "preferredInspectionDate", label: "Preferred inspection" },
  { key: "referralName", label: "Referral name" },
  { key: "referralPhone", label: "Referral phone" },
  { key: "assignedTo", label: "Assignee" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags" },
];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeLookup(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueFromRow(row: Record<string, unknown>, field: string, mapping?: Record<string, string>) {
  const mappedHeader = mapping?.[field];
  if (mapping && !mappedHeader) {
    return "";
  }

  if (mappedHeader) {
    const value = row[mappedHeader];
    return value === undefined || value === null ? "" : String(value).trim();
  }

  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  const aliases = headerAliases[field] ?? [field];
  const match = aliases.find((alias) => normalized[normalizeHeader(alias)] !== undefined);
  const value = match ? normalized[normalizeHeader(match)] : undefined;
  return value === undefined || value === null ? "" : String(value).trim();
}

function detectColumnMapping(headers: string[]) {
  return Object.fromEntries(importFields.map(({ key }) => {
    const aliases = headerAliases[key] ?? [key];
    const match = headers.find((header) => aliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)));
    return [key, match ?? ""];
  }));
}

function findProperty(values: Record<string, string>, properties: Property[]) {
  const propertyId = values.propertyId;
  const propertyName = values.propertyName;
  const propertyReference = values.propertyReferenceNumber;
  return properties.find((property) => {
    const candidates = [property.id, property.name, property.referenceNumber].map(normalizeLookup).filter(Boolean);
    return [propertyId, propertyName, propertyReference].some((value) => value && candidates.includes(normalizeLookup(value)));
  });
}

function findUnit(values: Record<string, string>, propertyUnits: PropertyUnit[], propertyId?: string) {
  const unitId = values.unitId;
  const unitName = values.unitName;
  return propertyUnits.find((unit) => {
    if (propertyId && unit.propertyId !== propertyId) {
      return false;
    }

    const candidates = [unit.id, unit.unitNumber, unit.referenceNumber].map(normalizeLookup).filter(Boolean);
    return [unitId, unitName].some((value) => value && candidates.includes(normalizeLookup(value)));
  });
}

function enrichLeadLinkage<T extends Record<string, unknown>>(payload: T, properties: Property[], propertyUnits: PropertyUnit[]) {
  const values = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value ?? "")]));
  const linkedProperty = findProperty(values, properties);
  const linkedUnit = findUnit(values, propertyUnits, linkedProperty?.id) ?? findUnit(values, propertyUnits);
  const unitProperty = linkedUnit ? properties.find((property) => property.id === linkedUnit.propertyId) : undefined;
  const property = linkedProperty ?? unitProperty;

  return {
    ...payload,
    propertyId: property?.id ?? payload.propertyId ?? "",
    propertyName: property?.name ?? linkedUnit?.propertyName ?? payload.propertyName ?? "",
    propertyReferenceNumber: property?.referenceNumber ?? linkedUnit?.propertyReferenceNumber ?? payload.propertyReferenceNumber ?? "",
    unitId: linkedUnit?.id ?? payload.unitId ?? "",
    unitName: linkedUnit?.unitNumber ?? payload.unitName ?? "",
  };
}

function cleanHeaderRow(headers: unknown[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = String(header ?? "").trim() || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function normalizeInterest(value: string) {
  const next = value.toLowerCase();
  if (["buy", "sale", "purchase"].includes(next)) {
    return "buy";
  }

  if (["rent", "rental"].includes(next)) {
    return "rent";
  }

  if (["lease", "leasing"].includes(next)) {
    return "lease";
  }

  if (["invest", "investment", "investor"].includes(next)) {
    return "invest";
  }

  return "buy";
}

function formToLeadPayload(values: LeadFormState) {
  return {
    ...values,
    assignedAgentId: values.assignedTo,
    budgetMaximum: values.budgetMaximum,
    budgetMinimum: values.budgetMinimum,
    preferredBedrooms: values.preferredBedrooms,
    score: values.score || "25",
    tags: values.tags,
    transactionInterest: normalizeInterest(values.transactionInterest),
  };
}

function parsePreviewRows(rows: Record<string, unknown>[], defaults: LeadFormState, properties: Property[], propertyUnits: PropertyUnit[], mapping?: Record<string, string>) {
  return rows.map<PreviewLead>((row, index) => {
    const values = { ...defaults };
    importFields.forEach(({ key }) => {
      const value = valueFromRow(row, key, mapping);
      if (value) {
        values[key] = value;
      }
    });
    values.phoneNumber = values.phoneNumber || values.whatsappNumber;
    values.whatsappNumber = values.whatsappNumber || values.phoneNumber;
    values.transactionInterest = normalizeInterest(values.transactionInterest);
    values.source = values.source || defaults.source || "Imported";
    values.sourcePlatform = values.sourcePlatform || defaults.sourcePlatform || "Other";
    values.status = values.status || "new";
    values.assignedTo = values.assignedTo || defaults.assignedTo;

    const enrichedPayload = enrichLeadLinkage(formToLeadPayload(values), properties, propertyUnits);
    const parsed = leadSchema.safeParse(enrichedPayload);
    return {
      data: parsed.success ? parsed.data as Record<string, unknown> : enrichedPayload,
      errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`),
      rowNumber: index + 2,
    };
  });
}

function parseCsv(text: string): ImportSheet {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  const [headers = [], ...body] = rows;
  const cleanHeaders = cleanHeaderRow(headers);
  return {
    headers: cleanHeaders,
    rows: body.map((cells) => Object.fromEntries(cleanHeaders.map((header, index) => [header, cells[index] ?? ""]))),
  };
}

async function spreadsheetRows(file: File): Promise<ImportSheet> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(await file.text());
  }

  const rows: unknown[][] = await readSheet(file);
  const [headers = [], ...body] = rows;
  const cleanHeaders = cleanHeaderRow(headers);
  return {
    headers: cleanHeaders,
    rows: body.map((cells: unknown[]) => Object.fromEntries(cleanHeaders.map((header: string, index: number) => [header, cells[index] ?? ""]))),
  };
}

function downloadTemplate() {
  const headers = [
    "fullName",
    "phoneNumber",
    "whatsappNumber",
    "email",
    "source",
    "sourcePlatform",
    "campaignName",
    "transactionInterest",
    "propertyReferenceNumber",
    "unitName",
    "propertyType",
    "preferredLocation",
    "preferredState",
    "preferredCity",
    "budgetMinimum",
    "budgetMaximum",
    "leadTemperature",
    "nextFollowUpAt",
    "notes",
    "tags",
  ];
  const example = [
    "Ada Okafor",
    "+2348010000001",
    "+2348010000001",
    "ada@example.com",
    "Facebook",
    "Meta",
    "Lekki Q2 Campaign",
    "buy",
    "PROP-2026-001",
    "Block A - Unit 3",
    "Apartment",
    "Lekki Phase 1",
    "Lagos",
    "Lagos",
    "25000000",
    "50000000",
    "hot",
    "2026-06-10",
    "Interested in 3-bedroom apartments",
    "buyer,lekki",
  ];
  const csv = [headers, example].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "lead-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function LeadCreatePage() {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyUnits, setPropertyUnits] = useState<PropertyUnit[]>([]);
  const [branchId, setBranchId] = useState("");
  const [values, setValues] = useState<LeadFormState>(defaultLead);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const branchOptions = useMemo(() => (
    canAccessAllBranches(member) ? branches : branches.filter((branch) => branch.id === member?.branchId)
  ), [branches, member]);
  const optionBranchConstraints = useMemo<QueryConstraint[]>(() => (
    canAccessAllBranches(member) ? [] : [where("branchId", "==", member?.branchId || "")]
  ), [member]);
  const assignableMembers = useMemo(() => members.filter((item) => (
    item.status === "active" && (canAccessAllBranches(member) || item.branchId === branchId)
  )), [branchId, member, members]);
  const propertyOptions = useMemo(
    () => properties.map((property) => {
      const detail = [property.city, property.referenceNumber].filter(Boolean).join(" · ");
      return { label: detail ? `${property.name} (${detail})` : property.name, value: property.id };
    }),
    [properties],
  );
  const unitOptions = useMemo(
    () => propertyUnits
      .filter((unit) => !values.propertyId || unit.propertyId === values.propertyId)
      .map((unit) => {
        const detail = [unit.propertyName, unit.referenceNumber].filter(Boolean).join(" · ");
        return { label: detail ? `${unit.unitNumber} (${detail})` : unit.unitNumber, value: unit.id };
      }),
    [propertyUnits, values.propertyId],
  );
  const validPreviewRows = preview.filter((row) => row.errors.length === 0);

  useEffect(() => {
    if (success) {
      toast({ title: "Lead workflow updated", description: success, variant: "success" });
    }
  }, [success, toast]);

  useEffect(() => {
    if (error) {
      toast({ title: "Lead action failed", description: error, variant: "error" });
    }
  }, [error, toast]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBranches, nextMembers, nextProperties, nextPropertyUnits] = await Promise.all([
        listBranches(activeOrganizationId),
        listMembers(activeOrganizationId),
        listOrgRecords<Property>(activeOrganizationId, "properties", optionBranchConstraints).catch(() => []),
        listOrgRecords<PropertyUnit>(activeOrganizationId, "propertyUnits", optionBranchConstraints).catch(() => []),
      ]);
      const visibleBranches = canAccessAllBranches(member) ? nextBranches : nextBranches.filter((branch) => branch.id === member?.branchId);
      const nextBranchId = visibleBranches[0]?.id || member?.branchId || "";
      setBranches(nextBranches);
      setMembers(nextMembers);
      setProperties(canAccessAllBranches(member) ? nextProperties : nextProperties.filter((property) => property.branchId === nextBranchId));
      setPropertyUnits(canAccessAllBranches(member) ? nextPropertyUnits : nextPropertyUnits.filter((unit) => unit.branchId === nextBranchId));
      setBranchId((current) => current && visibleBranches.some((branch) => branch.id === current) ? current : nextBranchId);
      setValues((current) => {
        const branchMembers = nextMembers.filter((item) => item.status === "active" && (canAccessAllBranches(member) || item.branchId === nextBranchId));
        return { ...current, assignedTo: current.assignedTo || user?.uid || branchMembers[0]?.id || "" };
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load lead form options.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, member, optionBranchConstraints, user?.uid]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOptions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadOptions]);

  function updateField(field: string, value: string) {
    setValues((current) => {
      if (field === "propertyId") {
        const selectedUnit = propertyUnits.find((unit) => unit.id === current.unitId);
        return {
          ...current,
          propertyId: value,
          unitId: selectedUnit && selectedUnit.propertyId !== value ? "" : current.unitId,
          unitName: selectedUnit && selectedUnit.propertyId !== value ? "" : current.unitName,
        };
      }

      if (field === "unitId") {
        const selectedUnit = propertyUnits.find((unit) => unit.id === value);
        return {
          ...current,
          propertyId: selectedUnit?.propertyId ?? current.propertyId,
          unitId: value,
        };
      }

      return { ...current, [field]: value };
    });
  }

  async function createLead(payload: Record<string, unknown>) {
    if (!user) {
      throw new Error("You must be signed in to create leads.");
    }

    const context = { branchId, organizationId: activeOrganizationId, userId: user.uid };
    const id = await createOrgRecord("leads", payload, context, "LEAD");
    await writeAuditLog(context, "lead.create", "leads", id, payload);
    return id;
  }

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const parsed = leadSchema.safeParse(enrichLeadLinkage(formToLeadPayload(values), properties, propertyUnits));
      if (!parsed.success) {
        setError(parsed.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`).join(" · "));
        return;
      }

      await createLead(parsed.data as Record<string, unknown>);
      setValues({ ...defaultLead, assignedTo: values.assignedTo || user?.uid || "" });
      setSuccess("Lead created.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create lead.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportFile(file: File | null) {
    setError(null);
    setSuccess(null);
    setPreview([]);
    setImportHeaders([]);
    setImportRows([]);
    setColumnMapping({});
    if (!file) {
      return;
    }

    try {
      const { headers, rows } = await spreadsheetRows(file);
      if (!rows.length) {
        setError("The selected file has no rows.");
        return;
      }

      if (!headers.length) {
        setError("The selected file has no header row.");
        return;
      }

      const nextMapping = detectColumnMapping(headers);
      setImportHeaders(headers);
      setImportRows(rows);
      setColumnMapping(nextMapping);
      setPreview(parsePreviewRows(rows, values, properties, propertyUnits, nextMapping));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to read spreadsheet.");
    }
  }

  function updateColumnMapping(field: string, header: string) {
    const next = { ...columnMapping, [field]: header };
    setColumnMapping(next);
    if (importRows.length) {
      setPreview(parsePreviewRows(importRows, values, properties, propertyUnits, next));
    }
  }

  function refreshImportPreview() {
    setPreview(parsePreviewRows(importRows, values, properties, propertyUnits, columnMapping));
  }

  async function importValidRows() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      for (const row of validPreviewRows) {
        await createLead(row.data);
      }
      setSuccess(`${validPreviewRows.length} lead${validPreviewRows.length === 1 ? "" : "s"} imported.`);
      setPreview([]);
      setImportHeaders([]);
      setImportRows([]);
      setColumnMapping({});
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to import leads.");
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission(member, "leads.create")) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading lead capture" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Create Lead</h1>
          <p className="mt-1 text-sm text-muted-foreground">Capture leads manually or import lead sheets from external platforms.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-0 md:flex">
          <Button onClick={() => setMode("manual")} type="button" variant={mode === "manual" ? "primary" : "outline"}>Manual</Button>
          <Button onClick={() => setMode("import")} type="button" variant={mode === "import" ? "primary" : "outline"}>Import</Button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Capture Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Branch">
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Default assignee">
            <Select value={values.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)}>
              {assignableMembers.map((item) => <option key={item.id} value={item.id}>{item.displayName} - {memberRoles(item).join(", ")}</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>

      {mode === "manual" ? (
        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={submitManual}>
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Full name"><Input required value={values.fullName} onChange={(event) => updateField("fullName", event.target.value)} /></Field>
                <Field label="Phone number"><Input required value={values.phoneNumber} onChange={(event) => updateField("phoneNumber", event.target.value)} /></Field>
                <Field label="WhatsApp number"><Input value={values.whatsappNumber} onChange={(event) => updateField("whatsappNumber", event.target.value)} /></Field>
                <Field label="Email"><Input type="email" value={values.email} onChange={(event) => updateField("email", event.target.value)} /></Field>
                <Field label="Contact preference">
                  <Select value={values.contactPreference} onChange={(event) => updateField("contactPreference", event.target.value)}>
                    {contactPreferences.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Lead temperature">
                  <Select value={values.leadTemperature} onChange={(event) => updateField("leadTemperature", event.target.value)}>
                    {temperatures.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <Field label="Source">
                  <Select value={values.source} onChange={(event) => updateField("source", event.target.value)}>
                    {leadSources.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Platform">
                  <Select value={values.sourcePlatform} onChange={(event) => updateField("sourcePlatform", event.target.value)}>
                    {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Campaign name"><Input value={values.campaignName} onChange={(event) => updateField("campaignName", event.target.value)} /></Field>
                <Field label="External reference"><Input value={values.sourceReference} onChange={(event) => updateField("sourceReference", event.target.value)} /></Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <Field label="Transaction interest">
                  <Select value={values.transactionInterest} onChange={(event) => updateField("transactionInterest", event.target.value)}>
                    {interests.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Property type">
                  <Select value={values.propertyType} onChange={(event) => updateField("propertyType", event.target.value)}>
                    <option value="">Select type</option>
                    {propertyTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Property category"><Input value={values.preferredPropertyCategory} onChange={(event) => updateField("preferredPropertyCategory", event.target.value)} /></Field>
                <Field label="Bedrooms"><Input min="0" type="number" value={values.preferredBedrooms} onChange={(event) => updateField("preferredBedrooms", event.target.value)} /></Field>
              </div>

              <div className="grid gap-4 rounded-md border bg-muted/30 p-4 lg:grid-cols-2">
                <Field label="Linked property">
                  <Select value={values.propertyId} onChange={(event) => updateField("propertyId", event.target.value)}>
                    <option value="">Select property</option>
                    {propertyOptions.map((property) => <option key={property.value} value={property.value}>{property.label}</option>)}
                  </Select>
                </Field>
                <Field label="Linked unit">
                  <Select value={values.unitId} onChange={(event) => updateField("unitId", event.target.value)}>
                    <option value="">Select unit</option>
                    {unitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <Field label="Preferred location"><Input value={values.preferredLocation} onChange={(event) => updateField("preferredLocation", event.target.value)} /></Field>
                <Field label="State"><Input value={values.preferredState} onChange={(event) => updateField("preferredState", event.target.value)} /></Field>
                <Field label="City"><Input value={values.preferredCity} onChange={(event) => updateField("preferredCity", event.target.value)} /></Field>
                <Field label="Currency"><Input value={values.preferredBudgetCurrency} onChange={(event) => updateField("preferredBudgetCurrency", event.target.value)} /></Field>
                <Field label="Budget minimum"><Input min="0" type="number" value={values.budgetMinimum} onChange={(event) => updateField("budgetMinimum", event.target.value)} /></Field>
                <Field label="Budget maximum"><Input min="0" type="number" value={values.budgetMaximum} onChange={(event) => updateField("budgetMaximum", event.target.value)} /></Field>
                <Field label="Payment preference">
                  <Select value={values.paymentPreference} onChange={(event) => updateField("paymentPreference", event.target.value)}>
                    {paymentPreferences.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Intended use"><Input value={values.intendedUse} onChange={(event) => updateField("intendedUse", event.target.value)} /></Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <Field label="Status">
                  <Select value={values.status} onChange={(event) => updateField("status", event.target.value)}>
                    {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <Field label="Score"><Input max="100" min="0" type="number" value={values.score} onChange={(event) => updateField("score", event.target.value)} /></Field>
                <Field label="Next follow-up"><Input type="date" value={values.nextFollowUpAt} onChange={(event) => updateField("nextFollowUpAt", event.target.value)} /></Field>
                <Field label="Preferred inspection"><Input type="date" value={values.preferredInspectionDate} onChange={(event) => updateField("preferredInspectionDate", event.target.value)} /></Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Referral name"><Input value={values.referralName} onChange={(event) => updateField("referralName", event.target.value)} /></Field>
                <Field label="Referral phone"><Input value={values.referralPhone} onChange={(event) => updateField("referralPhone", event.target.value)} /></Field>
                <Field label="Tags"><Input value={values.tags} onChange={(event) => updateField("tags", event.target.value)} /></Field>
                <Field label="Notes"><Textarea value={values.notes} onChange={(event) => updateField("notes", event.target.value)} /></Field>
              </div>

              <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] -mx-5 -mb-5 border-t bg-white p-4 md:static md:m-0 md:flex md:justify-end md:border-0 md:bg-transparent md:p-0">
                <Button className="h-12 w-full md:h-10 md:w-auto" disabled={saving} type="submit">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving" : "Create lead"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Import Leads</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Field label="CSV or Excel file">
                <Input accept=".csv,.xls,.xlsx" type="file" onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)} />
              </Field>
              <div className="md:flex md:items-end">
                <Button className="h-11 w-full md:w-auto" onClick={downloadTemplate} type="button" variant="outline">
                  <Download className="h-4 w-4" />
                  Template
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              Upload any CSV or Excel sheet with a header row. CRM fields can be matched to the file headers below; optional fields can be left unmapped.
            </div>

            {importHeaders.length ? (
              <div className="grid gap-4 rounded-md border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Match columns</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{importHeaders.length} file columns detected. Required fields must map to a useful column before import.</p>
                  </div>
                  <Button onClick={refreshImportPreview} type="button" variant="outline">Refresh preview</Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {importFields.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <Select value={columnMapping[field.key] ?? ""} onChange={(event) => updateColumnMapping(field.key, event.target.value)}>
                        <option value="">{field.required ? "Select a column" : "Do not import"}</option>
                        {importHeaders.map((header) => <option key={`${field.key}-${header}`} value={header}>{header}</option>)}
                      </Select>
                      {field.required ? <span className="text-xs font-medium text-primary">Required</span> : null}
                    </Field>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.length ? (
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{preview.length} rows previewed</span>
                    <Badge tone="success">{validPreviewRows.length} valid</Badge>
                    <Badge tone={preview.length - validPreviewRows.length ? "danger" : "muted"}>{preview.length - validPreviewRows.length} issues</Badge>
                  </div>
                  <Button disabled={!validPreviewRows.length || saving} onClick={importValidRows} type="button">
                    <Upload className="h-4 w-4" />
                    {saving ? "Importing" : "Import valid rows"}
                  </Button>
                </div>
                <div className="grid gap-3 lg:hidden">
                  {preview.slice(0, 25).map((row) => (
                    <div className="rounded-md border bg-white p-4" key={row.rowNumber}>
                      <div className="flex justify-between gap-3">
                        <p className="font-semibold">Row {row.rowNumber}: {String(row.data.fullName ?? "Unnamed")}</p>
                        <Badge tone={row.errors.length ? "danger" : "success"}>{row.errors.length ? "Issue" : "Valid"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{String(row.data.phoneNumber ?? "No phone")} · {String(row.data.source ?? "No source")}</p>
                      {row.data.propertyName || row.data.unitName ? <p className="mt-1 text-sm text-muted-foreground">{[row.data.unitName, row.data.propertyName].filter(Boolean).join(" · ")}</p> : null}
                      {row.errors.length ? <p className="mt-2 text-sm text-destructive">{row.errors.join(" · ")}</p> : null}
                    </div>
                  ))}
                </div>
                <div className="hidden max-w-full overflow-x-auto lg:block">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Linked offering</th>
                        <th className="px-4 py-3">Interest</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 50).map((row) => (
                        <tr className="border-t" key={row.rowNumber}>
                          <td className="px-4 py-3">{row.rowNumber}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{String(row.data.fullName ?? "Unnamed")}</p>
                            {row.errors.length ? <p className="mt-1 text-xs text-destructive">{row.errors.join(" · ")}</p> : null}
                          </td>
                          <td className="px-4 py-3">{String(row.data.phoneNumber ?? "")}</td>
                          <td className="px-4 py-3">{String(row.data.source ?? "")}</td>
                          <td className="px-4 py-3">{[row.data.unitName, row.data.propertyName].filter(Boolean).join(" · ") || "Not linked"}</td>
                          <td className="px-4 py-3">{String(row.data.transactionInterest ?? "")}</td>
                          <td className="px-4 py-3"><Badge tone={row.errors.length ? "danger" : "success"}>{row.errors.length ? "Needs fix" : "Ready"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
