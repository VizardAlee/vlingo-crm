import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { rolePermissions } from "@/lib/permissions";
import { titleCase } from "@/lib/utils";

export function OrganizationSettings() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">Branding, default organization scope, and deployment identity.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Beacon Corporate Realty Limited</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]"><span className="text-muted-foreground">Default organization ID</span><strong className="break-words">beacon-corporate-realty</strong></div>
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]"><span className="text-muted-foreground">Brand color</span><strong>#b11226</strong></div>
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]"><span className="text-muted-foreground">Logo</span><strong className="break-words">public/branding/beacon-logo.jpeg</strong></div>
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
