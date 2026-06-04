"use client";

import { readSheet } from "read-excel-file/browser";
import { CheckCircle2, Download, FileSpreadsheet, Save, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { leadSchema } from "@/lib/validation/schemas";
import { createOrgRecord, writeAuditLog } from "@/services/repository";
import { listBranches, listMembers } from "@/services/users";
import type { Branch, Member } from "@/types/crm";

type LeadFormState = Record<string, string>;

interface PreviewLead {
  data: Record<string, unknown>;
  errors: string[];
  rowNumber: number;
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
  whatsappNumber: "",
};

const headerAliases: Record<string, string[]> = {
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
  preferredBedrooms: ["bedrooms", "beds", "preferredbedrooms"],
  preferredCity: ["city", "preferredcity"],
  preferredLocation: ["location", "preferredlocation", "area", "neighborhood"],
  preferredPropertyCategory: ["category", "propertycategory"],
  preferredState: ["state", "preferredstate"],
  propertyType: ["propertytype", "type"],
  referralName: ["referralname", "referrer", "referredby"],
  referralPhone: ["referralphone", "referrerphone"],
  source: ["source", "leadsource", "origin"],
  sourcePlatform: ["platform", "sourceplatform", "channel"],
  sourceReference: ["reference", "sourcereference", "externalid", "leadid"],
  tags: ["tags", "tag"],
  transactionInterest: ["interest", "transactioninterest", "transaction", "intent"],
  whatsappNumber: ["whatsapp", "whatsappnumber"],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueFromRow(row: Record<string, unknown>, field: string) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  const aliases = headerAliases[field] ?? [field];
  const match = aliases.find((alias) => normalized[normalizeHeader(alias)] !== undefined);
  const value = match ? normalized[normalizeHeader(match)] : undefined;
  return value === undefined || value === null ? "" : String(value).trim();
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

function parsePreviewRows(rows: Record<string, unknown>[], defaults: LeadFormState) {
  return rows.map<PreviewLead>((row, index) => {
    const values = { ...defaults };
    Object.keys(headerAliases).forEach((field) => {
      const value = valueFromRow(row, field);
      if (value) {
        values[field] = value;
      }
    });
    values.transactionInterest = normalizeInterest(values.transactionInterest);
    values.source = values.source || defaults.source || "Imported";
    values.sourcePlatform = values.sourcePlatform || defaults.sourcePlatform || "Other";
    values.status = values.status || "new";
    values.assignedTo = values.assignedTo || defaults.assignedTo;

    const parsed = leadSchema.safeParse(formToLeadPayload(values));
    return {
      data: parsed.success ? parsed.data as Record<string, unknown> : formToLeadPayload(values),
      errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`),
      rowNumber: index + 2,
    };
  });
}

function parseCsv(text: string) {
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
  return body.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

async function spreadsheetRows(file: File) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(await file.text());
  }

  const rows: unknown[][] = await readSheet(file);
  const [headers = [], ...body] = rows;
  return body.map((cells: unknown[]) => Object.fromEntries(headers.map((header: unknown, index: number) => [String(header ?? ""), cells[index] ?? ""])));
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
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [branchId, setBranchId] = useState("");
  const [values, setValues] = useState<LeadFormState>(defaultLead);
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignableMembers = useMemo(() => members.filter((item) => item.status === "active"), [members]);
  const validPreviewRows = preview.filter((row) => row.errors.length === 0);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBranches, nextMembers] = await Promise.all([listBranches(activeOrganizationId), listMembers(activeOrganizationId)]);
      setBranches(nextBranches);
      setMembers(nextMembers);
      setBranchId((current) => current || nextBranches[0]?.id || "");
      setValues((current) => ({ ...current, assignedTo: current.assignedTo || user?.uid || nextMembers[0]?.id || "" }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load lead form options.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, user?.uid]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOptions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadOptions]);

  function updateField(field: string, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
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
      const parsed = leadSchema.safeParse(formToLeadPayload(values));
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
    if (!file) {
      return;
    }

    try {
      const rows = await spreadsheetRows(file);
      if (!rows.length) {
        setError("The selected file has no rows.");
        return;
      }

      setPreview(parsePreviewRows(rows, values));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to read spreadsheet.");
    }
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
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Default assignee">
            <Select value={values.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)}>
              {assignableMembers.map((item) => <option key={item.id} value={item.id}>{item.displayName} - {item.role}</option>)}
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
              Accepted headers include name/fullName, phone/phoneNumber, whatsapp, email, source, platform, campaign, interest, propertyType, location, state, city, budgetMinimum, budgetMaximum, temperature, nextFollowUp, notes, and tags.
            </div>

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
