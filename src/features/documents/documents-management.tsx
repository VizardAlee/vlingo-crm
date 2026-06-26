"use client";

import { CheckCircle2, Download, FileText, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { documentAccessPermissions } from "@/components/layout/navigation";
import { hasAnyPermission } from "@/lib/permissions";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import { listDocuments, uploadDocument, type DocumentRecord, type RelatedEntityType } from "@/services/documents";
import { listOrgRecords } from "@/services/repository";
import type { OrgCollection } from "@/services/firestore-paths";
import type { Permission } from "@/types/crm";

type RelatedOption = { label: string; value: string };
type RelatedConfig = {
  collection: OrgCollection;
  label: string;
  permissions: Permission[];
  type: RelatedEntityType;
  filter?: (record: Record<string, unknown>) => boolean;
};

const relatedConfigs: RelatedConfig[] = [
  { collection: "deals", label: "Deal", permissions: ["deals.read"], type: "deal" },
  { collection: "leads", label: "Lead", permissions: ["leads.readAssigned", "leads.readAll"], type: "lead" },
  { collection: "clients", label: "Client", permissions: ["clients.read"], type: "client" },
  { collection: "properties", label: "Property", permissions: ["properties.read"], type: "property" },
  { collection: "propertyUnits", label: "Unit", permissions: ["units.read"], type: "unit" },
  { collection: "tasks", label: "Task", permissions: ["tasks.read"], type: "task" },
  { collection: "rentalTenancies", label: "Tenancy", permissions: ["rentals.read"], type: "tenancy" },
  { collection: "developmentProjects", label: "Development project", permissions: ["development.read"], type: "development" },
  { collection: "marketingCampaigns", label: "Marketing campaign", permissions: ["marketing.read"], type: "marketing" },
  { collection: "propertyStakeholders", filter: (record) => record.type === "owner", label: "Owner", permissions: ["properties.read"], type: "owner" },
  { collection: "propertyStakeholders", filter: (record) => record.type === "developer", label: "Developer", permissions: ["properties.read"], type: "developer" },
  { collection: "propertyStakeholders", filter: (record) => record.type === "management", label: "Management record", permissions: ["properties.read"], type: "management" },
];

function recordLabel(type: RelatedEntityType, record: Record<string, unknown>) {
  if (type === "deal") {
    const detail = [record.clientName ?? record.leadName, record.propertyName, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.title ?? "Deal")} (${detail})` : String(record.title ?? record.referenceNumber ?? record.id);
  }

  if (type === "lead" || type === "client") {
    const detail = [record.phoneNumber, record.email, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.fullName ?? "Unnamed")} (${detail})` : String(record.fullName ?? record.referenceNumber ?? record.id);
  }

  if (type === "property") {
    const detail = [record.city, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.name ?? "Property")} (${detail})` : String(record.name ?? record.referenceNumber ?? record.id);
  }

  if (type === "unit") {
    const detail = [record.propertyName, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.unitNumber ?? "Unit")} (${detail})` : String(record.unitNumber ?? record.referenceNumber ?? record.id);
  }

  if (type === "task") {
    const detail = [record.assignedToName, record.dueAt, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.title ?? "Task")} (${detail})` : String(record.title ?? record.referenceNumber ?? record.id);
  }

  if (type === "tenancy") {
    const detail = [record.propertyName, record.unitName, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.tenantName ?? "Tenant")} (${detail})` : String(record.tenantName ?? record.referenceNumber ?? record.id);
  }

  if (type === "development") {
    const detail = [record.propertyName, record.city, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.name ?? "Development project")} (${detail})` : String(record.name ?? record.referenceNumber ?? record.id);
  }

  if (type === "marketing") {
    const detail = [record.channel, record.propertyName, record.referenceNumber].filter(Boolean).join(" · ");
    return detail ? `${String(record.name ?? "Marketing campaign")} (${detail})` : String(record.name ?? record.referenceNumber ?? record.id);
  }

  const detail = [record.phoneNumber, record.email, record.referenceNumber].filter(Boolean).join(" · ");
  return detail ? `${String(record.name ?? "Record")} (${detail})` : String(record.name ?? record.referenceNumber ?? record.id);
}

function routeForRelatedDocument(type: string | undefined, id: string | undefined) {
  if (!type || !id) {
    return null;
  }

  if (type === "lead") {
    return `/leads/${id}`;
  }

  if (type === "deal") {
    return `/deals/${id}`;
  }

  if (type === "client") {
    return `/clients/${id}`;
  }

  if (type === "property") {
    return `/properties/${id}`;
  }

  if (type === "unit") {
    return `/units/${id}`;
  }

  if (type === "task") {
    return `/tasks/${id}`;
  }

  if (type === "tenancy") {
    return `/rentals/${id}`;
  }

  if (type === "development") {
    return `/development/${id}`;
  }

  if (type === "marketing") {
    return `/marketing/${id}`;
  }

  return null;
}

export function DocumentsManagement() {
  const searchParams = useSearchParams();
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [relatedEntityType, setRelatedEntityType] = useState(searchParams.get("relatedEntityType") ?? "");
  const [relatedEntityId, setRelatedEntityId] = useState(searchParams.get("relatedEntityId") ?? "");
  const [relatedOptions, setRelatedOptions] = useState<RelatedOption[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(Boolean(searchParams.get("relatedEntityType")));
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const allowedRelatedConfigs = useMemo(() => relatedConfigs.filter((config) => hasAnyPermission(member, config.permissions)), [member]);
  const canUseDocuments = hasAnyPermission(member, documentAccessPermissions);

  const loadDocuments = useCallback(async () => {
    if (!canUseDocuments) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      setDocuments(await listDocuments(activeOrganizationId));
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load documents.";
      setError(message);
      toast({ title: "Unable to load documents", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, canUseDocuments, toast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadDocuments]);

  useEffect(() => {
    if (!relatedEntityType) {
      return;
    }

    const config = allowedRelatedConfigs.find((item) => item.type === relatedEntityType);
    if (!config) {
      const timeout = window.setTimeout(() => setRelatedLoading(false), 0);
      return () => window.clearTimeout(timeout);
    }

    let mounted = true;
    listOrgRecords<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection)
      .then((records) => {
        if (!mounted) {
          return;
        }

        const filteredRecords = config.filter ? records.filter(config.filter) : records;
        setRelatedOptions(filteredRecords.map((record) => ({ label: recordLabel(config.type, record), value: record.id })));
      })
      .catch(() => {
        if (mounted) {
          setRelatedOptions([]);
          setRelatedError(`Unable to load ${config.label.toLowerCase()} records for this user.`);
        }
      })
      .finally(() => {
        if (mounted) {
          setRelatedLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, allowedRelatedConfigs, relatedEntityType]);

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !file) {
      const message = "Choose a file before uploading.";
      setError(message);
      toast({ title: "Choose a file", description: message, variant: "error" });
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    const selectedRelatedOption = relatedOptions.find((option) => option.value === relatedEntityId);
    try {
      await uploadDocument({
        branchId: activeBranchId,
        category,
        file,
        organizationId: activeOrganizationId,
        relatedEntityId: relatedEntityType ? relatedEntityId : "",
        relatedEntityName: selectedRelatedOption?.label ?? "",
        relatedEntityType: relatedEntityType ? relatedEntityType as RelatedEntityType : undefined,
        title,
        userId: user.uid,
      });
      setTitle("");
      setCategory("general");
      setRelatedEntityType("");
      setRelatedEntityId("");
      setRelatedOptions([]);
      setRelatedError(null);
      setRelatedLoading(false);
      setFile(null);
      const message = "Document uploaded.";
      setSuccess(message);
      toast({ title: "Document uploaded", description: message, variant: "success" });
      await loadDocuments();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to upload document.";
      setError(message);
      toast({ title: "Unable to upload document", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!canUseDocuments) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading documents" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload, categorize, and attach files to operational records.</p>
        </div>
        <Button className="mt-4 h-11 w-full md:mt-0 md:w-auto" onClick={loadDocuments} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
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
          <CardTitle>Upload Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-4" onSubmit={submitUpload}>
            <Field label="Title">
              <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="general">General</option>
                <option value="clientKyc">Client KYC</option>
                <option value="titleDocument">Title document</option>
                <option value="agreement">Agreement</option>
                <option value="paymentEvidence">Payment evidence</option>
                <option value="inspection">Inspection</option>
              </Select>
            </Field>
            <Field label="Related type">
              <Select value={relatedEntityType} onChange={(event) => {
                const nextType = event.target.value;
                setRelatedEntityType(nextType);
                setRelatedEntityId("");
                setRelatedOptions([]);
                setRelatedError(null);
                setRelatedLoading(Boolean(nextType));
              }}>
                <option value="">None</option>
                {allowedRelatedConfigs.map((config) => <option key={config.type} value={config.type}>{config.label}</option>)}
              </Select>
            </Field>
            <Field label="Related record" error={relatedError ?? undefined}>
              <Select disabled={!relatedEntityType || relatedLoading} value={relatedEntityId} onChange={(event) => setRelatedEntityId(event.target.value)}>
                <option value="">{relatedLoading ? "Loading records" : relatedEntityType ? "Select record" : "Select related type first"}</option>
                {relatedEntityId && !relatedOptions.some((option) => option.value === relatedEntityId) ? <option value={relatedEntityId}>Selected record ({relatedEntityId})</option> : null}
                {relatedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <div className="lg:col-span-3">
              <Field label="File">
                <Input required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </Field>
            </div>
            <div className="lg:flex lg:items-end lg:justify-end">
              <Button className="h-11 w-full lg:w-auto" disabled={saving} type="submit">
                <Upload className="h-4 w-4" />
                {saving ? "Uploading" : "Upload"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {documents.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {documents.map((item) => (
            <Card key={item.id}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.fileName}</p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{titleCase(item.category)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Related</p>
                    {(() => {
                      const route = routeForRelatedDocument(item.relatedEntityType, item.relatedEntityId);
                      const label = item.relatedEntityName || item.relatedEntityId;
                      if (!item.relatedEntityType || !label) {
                        return <p className="truncate font-medium">None</p>;
                      }

                      const content = `${titleCase(item.relatedEntityType)} · ${label}`;
                      return route ? <Link className="truncate font-medium text-primary" href={route}>{content}</Link> : <p className="truncate font-medium">{content}</p>;
                    })()}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Size</p>
                    <p className="font-medium">{Math.ceil(item.size / 1024).toLocaleString()} KB</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatDate(item.updatedAt ?? item.createdAt)}</p>
                  </div>
                </div>
                <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium shadow-sm hover:bg-muted" href={item.downloadURL} rel="noreferrer" target="_blank">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No documents uploaded yet" />
      )}
    </section>
  );
}
