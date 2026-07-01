"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
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

function organizationTourTarget(name: string) {
  return `organization-${name}`;
}

const organizationTourSteps: GuidedTourStep[] = [
  { target: organizationTourTarget("identity"), title: "Organization identity", body: "Set the public and legal organization names used across the workspace." },
  { target: organizationTourTarget("logo"), title: "Logo", body: "Upload a logo or paste a logo URL. Uploads can also detect the primary brand color." },
  { target: organizationTourTarget("color"), title: "Primary color", body: "Choose the main brand color used in navigation, buttons, and highlights." },
  { target: organizationTourTarget("status"), title: "Status", body: "Keep the organization active unless access should be disabled." },
  { target: organizationTourTarget("save"), title: "Save organization", body: "Save changes after reviewing the organization name, logo, color, and status." },
];

function componentToHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
}

function saturationFor(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  if (max === min) {
    return 0;
  }

  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function extractLogoPrimaryColor(file: File) {
  return new Promise<string | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }

        context.clearRect(0, 0, size, size);
        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { blue: number; count: number; green: number; red: number; score: number }>();

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] ?? 0;
          const green = pixels[index + 1] ?? 0;
          const blue = pixels[index + 2] ?? 0;
          const alpha = pixels[index + 3] ?? 0;
          const brightness = (red + green + blue) / 3;
          const saturation = saturationFor(red, green, blue);

          if (alpha < 180 || brightness > 238 || brightness < 35 || saturation < 0.22) {
            continue;
          }

          const bucketRed = Math.round(red / 24) * 24;
          const bucketGreen = Math.round(green / 24) * 24;
          const bucketBlue = Math.round(blue / 24) * 24;
          const key = `${bucketRed},${bucketGreen},${bucketBlue}`;
          const existing = buckets.get(key) ?? { blue: 0, count: 0, green: 0, red: 0, score: 0 };
          existing.blue += blue;
          existing.count += 1;
          existing.green += green;
          existing.red += red;
          existing.score += saturation * Math.min(1, Math.abs(brightness - 128) / 128 + 0.55);
          buckets.set(key, existing);
        }

        const dominant = Array.from(buckets.values()).sort((left, right) => right.count * right.score - left.count * left.score)[0];
        resolve(dominant ? rgbToHex(dominant.red / dominant.count, dominant.green / dominant.count, dominant.blue / dominant.count) : null);
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = objectUrl;
  });
}

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
      const extractedColor = await extractLogoPrimaryColor(file);
      const logoUrl = await uploadOrganizationLogo({ file, organizationId: activeOrganizationId });
      setForm((current) => ({ ...current, logoUrl, primaryColor: extractedColor ?? current.primaryColor }));
      toast({
        title: "Logo uploaded",
        description: extractedColor ? "Primary color was detected from the logo. Review it, then save the organization settings." : "Review the preview, then save the organization settings.",
        variant: "success",
      });
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
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Organization</h1>
          <p className="mt-1 text-sm text-muted-foreground">Branding, default organization scope, and deployment identity.</p>
        </div>
        <GuidedTour className="mt-4 h-11 w-full md:mt-0 md:w-auto" storageKey="beacon-tour:organization" steps={organizationTourSteps} />
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
              <div className="grid gap-4 md:grid-cols-2" data-tour={organizationTourTarget("identity")}>
                <Field label="Organization name">
                  <Input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Legal name">
                  <Input required value={form.legalName} onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
                <div data-tour={organizationTourTarget("logo")}>
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
                        <p className="text-xs text-muted-foreground">{uploadingLogo ? "Uploading logo and detecting brand color..." : "Upload a PNG, JPG, SVG, or WebP image up to 2 MB, or paste a hosted logo URL."}</p>
                      </div>
                    </div>
                  </div>
                </Field>
                </div>
                <div data-tour={organizationTourTarget("color")}>
                <Field label="Primary color">
                  <Input required type="color" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} />
                </Field>
                </div>
              </div>
              <div data-tour={organizationTourTarget("status")}>
              <Field label="Status">
                <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Organization["status"] }))}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </Field>
              </div>
              <div className="flex justify-end">
                <Button data-tour={organizationTourTarget("save")} disabled={saving} type="submit">{saving ? "Saving" : "Save organization"}</Button>
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
