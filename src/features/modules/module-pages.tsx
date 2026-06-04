"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where, type QueryConstraint } from "firebase/firestore";
import { CheckCircle2, GitBranch, ListTodo, MessageSquarePlus, Plus, Repeat2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionDenied, LoadingState, ErrorState } from "@/components/ui/state";
import { CrmTable } from "@/components/tables/crm-table";
import { ModuleForm } from "@/features/modules/module-form";
import { columnsFor, type ModuleConfig } from "@/features/modules/module-config";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import { listDocuments, type DocumentRecord } from "@/services/documents";
import { getOrgRecord, listOrgRecords } from "@/services/repository";
import { convertLeadToClient } from "@/services/workflows";

type RelatedEntityType = "lead" | "client" | "property" | "unit" | "task";

function relatedTypeForCollection(collection: ModuleConfig["collection"]): RelatedEntityType | null {
  if (collection === "leads") {
    return "lead";
  }

  if (collection === "clients") {
    return "client";
  }

  if (collection === "properties") {
    return "property";
  }

  if (collection === "propertyUnits") {
    return "unit";
  }

  if (collection === "tasks") {
    return "task";
  }

  return null;
}

async function safeListOrgRecords(organizationId: string, collectionName: "tasks" | "activities") {
  try {
    return await listOrgRecords<Record<string, unknown> & { id: string }>(organizationId, collectionName);
  } catch {
    return [];
  }
}

async function safeListDocuments(organizationId: string) {
  try {
    return await listDocuments(organizationId);
  } catch {
    return [];
  }
}

export function ModuleListPage({ config }: { config: ModuleConfig }) {
  const { activeOrganizationId, member, user } = useAuth();
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const constraints: QueryConstraint[] = [];

    if (config.collection === "leads" && user && !hasPermission(member, "leads.readAll")) {
      constraints.push(where("assignedTo", "==", user.uid));
    }

    if (config.collection === "tasks" && user && !hasAnyPermission(member, ["dashboard.viewExecutive", "users.manage"])) {
      constraints.push(where("assignedTo", "==", user.uid));
    }

    listOrgRecords<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, constraints)
      .then((items) => {
        if (mounted) {
          setRecords(items);
        }
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Unable to load records."))
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, config.collection, member, user]);

  if (!hasAnyPermission(member, [config.listPermission as never, "dashboard.viewExecutive" as never])) {
    return <PermissionDenied />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, filter, sort, export, and manage organization-scoped records.</p>
        </div>
        {hasPermission(member, config.createPermission as never) ? (
          <ButtonLink className="h-11 w-full md:h-10 md:w-auto" href={`${config.route}/new`}>
            <Plus className="h-4 w-4" />
            New {config.title.slice(0, -1)}
          </ButtonLink>
        ) : null}
      </div>
      {error ? <ErrorState message={error} /> : loading ? <LoadingState label={`Loading ${config.title.toLowerCase()}`} /> : (
        <CrmTable columns={columnsFor(config.collection)} data={records} emptyActionHref={`${config.route}/new`} emptyActionLabel={`Create ${config.title.slice(0, -1)}`} emptyTitle={config.emptyTitle} />
      )}
    </section>
  );
}

export function ModuleCreatePage({ config }: { config: ModuleConfig }) {
  const { member } = useAuth();
  const searchParams = useSearchParams();
  if (!hasPermission(member, config.createPermission as never)) {
    return <PermissionDenied />;
  }

  const initialValues = Object.fromEntries(searchParams.entries());

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Create {config.title.slice(0, -1)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Validated form data writes through the organization-scoped Firestore repository.</p>
      </div>
      <ModuleForm config={config} initialValues={initialValues} />
    </section>
  );
}

export function ModuleDetailPage({ config, id }: { config: ModuleConfig; id: string }) {
  const router = useRouter();
  const { activeOrganizationId, member } = useAuth();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const relatedType = relatedTypeForCollection(config.collection);
    Promise.all([
      getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id),
      safeListOrgRecords(activeOrganizationId, "tasks"),
      safeListOrgRecords(activeOrganizationId, "activities"),
      safeListDocuments(activeOrganizationId),
    ])
      .then(([nextRecord, nextTasks, nextActivities, nextDocuments]) => {
        setRecord(nextRecord);
        if (relatedType) {
          setTasks(nextTasks.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
          setActivities(nextActivities.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 6));
          setDocuments(nextDocuments.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
        }
      })
      .finally(() => setLoading(false));
  }, [activeOrganizationId, config.collection, id]);

  if (!hasAnyPermission(member, [config.listPermission as never, "dashboard.viewExecutive" as never])) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading record" />;
  }

  if (!record) {
    return <ErrorState message="Record not found." />;
  }

  const status = String(record.status ?? record.propertyStatus ?? "active");
  const relatedType = relatedTypeForCollection(config.collection);
  const relatedQuery = relatedType ? `relatedEntityType=${relatedType}&relatedEntityId=${id}` : "";

  async function handleConvertLead() {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await convertLeadToClient(activeOrganizationId, id);
      setActionSuccess("Lead converted to client.");
      router.push(`/clients/${result.clientId}`);
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Unable to convert lead.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm md:flex-row md:items-start md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{String(record.fullName ?? record.name ?? record.title ?? record.subject ?? record.unitNumber ?? "Record")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{String(record.referenceNumber ?? id)} · {status}</p>
        </div>
        <div className="grid gap-2 md:flex">
          {config.collection === "leads" && hasPermission(member, "clients.create") && status !== "converted" ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={actionLoading} onClick={handleConvertLead} type="button" variant="secondary">
              <Repeat2 className="h-4 w-4" />
              Convert
            </Button>
          ) : null}
          {hasPermission(member, config.editPermission as never) ? <ButtonLink className="h-11 w-full md:h-10 md:w-auto" href={`${config.route}/${id}/edit`} variant="outline">Edit record</ButtonLink> : null}
        </div>
      </div>
      {actionError ? <ErrorState message={actionError} /> : null}
      {actionSuccess ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {actionSuccess}
        </div>
      ) : null}
      {relatedType ? (
        <div className="grid gap-2 md:grid-cols-3">
          <ButtonLink href={`/tasks/new?${relatedQuery}`} variant="outline">
            <ListTodo className="h-4 w-4" />
            Add task
          </ButtonLink>
          <ButtonLink href={`/activities/new?${relatedQuery}`} variant="outline">
            <MessageSquarePlus className="h-4 w-4" />
            Log activity
          </ButtonLink>
          <ButtonLink href={`/documents?${relatedQuery}`} variant="outline">
            <GitBranch className="h-4 w-4" />
            Attach document
          </ButtonLink>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {Object.entries(record).slice(0, 8).map(([key, value]) => (
              <div className="flex justify-between gap-4" key={key}>
                <span className="text-muted-foreground">{key}</span>
                <span className="max-w-48 truncate font-medium">{String(value ?? "Not set")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {activities.length ? activities.map((activity) => (
              <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                  <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4">No timeline entries yet.</div>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Open Tasks</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {tasks.length ? tasks.map((task) => (
              <Link className="rounded-md border p-3 hover:bg-muted" href={`/tasks/${task.id}`} key={String(task.id)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{String(task.title ?? "Task")}</span>
                  <Badge tone={statusTone(String(task.status ?? "notStarted"))}>{titleCase(String(task.status ?? "notStarted"))}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">Priority: {titleCase(String(task.priority ?? "medium"))}</p>
              </Link>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No related tasks yet.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {documents.length ? documents.map((document) => (
              <a className="rounded-md border p-3 hover:bg-muted" href={document.downloadURL} key={document.id} rel="noreferrer" target="_blank">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{document.title}</span>
                  <Badge tone="muted">{titleCase(document.category)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{formatDate(document.updatedAt ?? document.createdAt)}</p>
              </a>
            )) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No attached documents yet.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ModuleEditPage({ config, id }: { config: ModuleConfig; id: string }) {
  const { activeOrganizationId, member } = useAuth();
  const [record, setRecord] = useState<Record<string, string | number | string[] | undefined> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgRecord<Record<string, string | number | string[] | undefined> & { id: string }>(activeOrganizationId, config.collection, id)
      .then(setRecord)
      .finally(() => setLoading(false));
  }, [activeOrganizationId, config.collection, id]);

  if (!hasPermission(member, config.editPermission as never)) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading form" />;
  }

  if (!record) {
    return <ErrorState message="Record not found." />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Edit {config.title.slice(0, -1)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization and audit fields are preserved by the repository and security rules.</p>
      </div>
      <ModuleForm config={config} existing={record} id={id} />
    </section>
  );
}
