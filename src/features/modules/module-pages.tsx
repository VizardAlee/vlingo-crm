"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionDenied, LoadingState, ErrorState } from "@/components/ui/state";
import { CrmTable } from "@/components/tables/crm-table";
import { ModuleForm } from "@/features/modules/module-form";
import { columnsFor, type ModuleConfig } from "@/features/modules/module-config";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getOrgRecord, listOrgRecords } from "@/services/repository";

export function ModuleListPage({ config }: { config: ModuleConfig }) {
  const { activeOrganizationId, member } = useAuth();
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listOrgRecords<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection)
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
  }, [activeOrganizationId, config.collection]);

  if (!hasAnyPermission(member, [config.listPermission as never, "dashboard.viewExecutive" as never])) {
    return <PermissionDenied />;
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, filter, sort, export, and manage organization-scoped records.</p>
        </div>
        {hasPermission(member, config.createPermission as never) ? (
          <ButtonLink href={`${config.route}/new`}>
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
  if (!hasPermission(member, config.createPermission as never)) {
    return <PermissionDenied />;
  }

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Create {config.title.slice(0, -1)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Validated form data writes through the organization-scoped Firestore repository.</p>
      </div>
      <ModuleForm config={config} />
    </section>
  );
}

export function ModuleDetailPage({ config, id }: { config: ModuleConfig; id: string }) {
  const { activeOrganizationId, member } = useAuth();
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id)
      .then(setRecord)
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

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{String(record.fullName ?? record.name ?? record.title ?? record.subject ?? record.unitNumber ?? "Record")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{String(record.referenceNumber ?? id)} · {status}</p>
        </div>
        {hasPermission(member, config.editPermission as never) ? <ButtonLink href={`${config.route}/${id}/edit`} variant="outline">Edit record</ButtonLink> : null}
      </div>
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
            <p>Related activities, notes, documents, and audit entries are displayed here when recorded for this entity.</p>
            <div className="rounded-md border border-dashed p-4">No timeline entries yet.</div>
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
    <section className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Edit {config.title.slice(0, -1)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization and audit fields are preserved by the repository and security rules.</p>
      </div>
      <ModuleForm config={config} existing={record} id={id} />
    </section>
  );
}
