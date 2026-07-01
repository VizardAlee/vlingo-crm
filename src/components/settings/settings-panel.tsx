"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, rolePermissions } from "@/lib/permissions";
import { titleCase } from "@/lib/utils";
import { getOrganization, updateOrganization, uploadOrganizationLogo } from "@/services/organization";
import type { Organization } from "@/types/crm";

const defaultOrganizationForm = {
  legalName: "Vlingo Systems Nig. Ltd.",
  logoUrl: "/branding/vlingo-logo.jpeg",
  name: "Vlingo Systems",
  primaryColor: "#14550f",
  status: "active" as Organization["status"],
};

export function OrganizationSettings() {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const canManageOrganization = hasAnyPermission(member, ["users.manage", "roles.manage"]);
  const [form, setForm] = useState(defaultOrganizationForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getOrganization(activeOrganizationId)
      .then((organization) => {
        if (!mounted) {
          return;
        }

        if (organization) {
          setForm({
            legalName: organization.legalName || defaultOrganizationForm.legalName,
            logoUrl: organization.logoUrl || defaultOrganizationForm.logoUrl,
            name: organization.name || defaultOrganizationForm.name,
            primaryColor: organization.primaryColor || defaultOrganizationForm.primaryColor,
            status: organization.status || "active",
          });
        }
      })
      .catch((nextError) => {
        const message = nextError instanceof Error ? nextError.message : "Unable to load organization settings.";
        setError(message);
        toast({ title: "Unable to load organization", description: message, variant: "error" });
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeOrganizationId, toast]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setError("You must be signed in to update organization settings.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateOrganization({
        ...form,
        organizationId: activeOrganizationId,
        userId: user.uid,
      });
      toast({ title: "Organization updated", description: "Organization details have been saved.", variant: "success" });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update organization settings.";
      setError(message);
      toast({ title: "Unable to update organization", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function onLogoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingLogo(true);
    setError(null);
    try {
      const logoUrl = await uploadOrganizationLogo({ file, organizationId: activeOrganizationId });
      setForm((current) => ({ ...current, logoUrl }));
      toast({ title: "Logo uploaded", description: "Review the preview, then save the organization settings.", variant: "success" });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to upload organization logo.";
      setError(message);
      toast({ title: "Unable to upload logo", description: message, variant: "error" });
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!canManageOrganization) {
    return <PermissionDenied />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">Branding, default organization scope, and deployment identity.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{form.legalName || form.name}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState label="Loading organization settings" /> : (
            <form className="grid gap-4" onSubmit={onSubmit}>
              {error ? <ErrorState message={error} /> : null}
              <Field label="Organization ID">
                <Input readOnly value={activeOrganizationId} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Organization name">
                  <Input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Legal name">
                  <Input required value={form.legalName} onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
                <Field label="Logo">
                  <div className="grid gap-3">
                    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
                      <div className="flex h-16 w-full max-w-52 items-center justify-center overflow-hidden rounded-md bg-muted sm:w-40">
                        {form.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={`${form.name} logo preview`} className="max-h-full max-w-full object-contain" src={form.logoUrl} />
                        ) : (
                          <span className="text-xs text-muted-foreground">No logo</span>
                        )}
                      </div>
                      <div className="grid flex-1 gap-2">
                        <Input value={form.logoUrl} onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} />
                        <Input accept="image/*" disabled={uploadingLogo} type="file" onChange={onLogoSelected} />
                        <p className="text-xs text-muted-foreground">{uploadingLogo ? "Uploading logo..." : "Upload a PNG, JPG, SVG, or WebP image up to 2 MB, or paste a hosted logo URL."}</p>
                      </div>
                    </div>
                  </div>
                </Field>
                <Field label="Primary color">
                  <Input required type="color" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} />
                </Field>
              </div>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Organization["status"] }))}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </Field>
              <div className="flex justify-end">
                <Button disabled={saving} type="submit">{saving ? "Saving" : "Save organization"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function BranchSettings() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">Branch records and active office context for organization-scoped work.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Head Office</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Branch records live at organizations/{`{organizationId}`}/branches/{`{branchId}`} and are seeded for local development.</CardContent>
      </Card>
    </section>
  );
}

export function UserSettings() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Membership, invitations, account status, and branch assignment.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Invite Workflow</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Use the `provisionOrganizationMember` Cloud Function scaffold for secure member creation and custom-claim assignment.</CardContent>
      </Card>
    </section>
  );
}

export function RoleSettings() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Roles and Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Permission bundles remain readable and usable on mobile, tablet, and desktop.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(rolePermissions).map(([role, permissions]) => (
          <Card key={role}>
            <CardHeader><CardTitle>{titleCase(role)}</CardTitle></CardHeader>
            <CardContent className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
              {permissions.map((permission) => <Badge key={permission} tone="muted">{permission}</Badge>)}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function AuditLogSettings() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Audit Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Protected event history for security-sensitive operations.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Protected Audit Trail</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Audit logs are write-protected in Firestore rules for ordinary users. Client writes are scaffolded for development, while production audit writes should use Cloud Functions.</CardContent>
      </Card>
    </section>
  );
}
