"use client";

import { CheckCircle2, Download, FileText, RefreshCw, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import { listDocuments, uploadDocument, type DocumentRecord, type RelatedEntityType } from "@/services/documents";

const entityTypes: RelatedEntityType[] = ["lead", "client", "property", "unit", "task"];

export function DocumentsManagement() {
  const searchParams = useSearchParams();
  const { activeBranchId, activeOrganizationId, user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [relatedEntityType, setRelatedEntityType] = useState(searchParams.get("relatedEntityType") ?? "");
  const [relatedEntityId, setRelatedEntityId] = useState(searchParams.get("relatedEntityId") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setDocuments(await listDocuments(activeOrganizationId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadDocuments]);

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !file) {
      setError("Choose a file before uploading.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadDocument({
        branchId: activeBranchId,
        category,
        file,
        organizationId: activeOrganizationId,
        relatedEntityId,
        relatedEntityType: relatedEntityType as RelatedEntityType,
        title,
        userId: user.uid,
      });
      setTitle("");
      setCategory("general");
      setRelatedEntityType("");
      setRelatedEntityId("");
      setFile(null);
      setSuccess("Document uploaded.");
      await loadDocuments();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to upload document.");
    } finally {
      setSaving(false);
    }
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
              <Select value={relatedEntityType} onChange={(event) => setRelatedEntityType(event.target.value)}>
                <option value="">None</option>
                {entityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
              </Select>
            </Field>
            <Field label="Related ID">
              <Input value={relatedEntityId} onChange={(event) => setRelatedEntityId(event.target.value)} />
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
                    <p className="truncate font-medium">{item.relatedEntityType ? `${titleCase(item.relatedEntityType)} ${item.relatedEntityId}` : "None"}</p>
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
