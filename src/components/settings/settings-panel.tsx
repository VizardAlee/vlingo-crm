import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { rolePermissions } from "@/lib/permissions";
import { titleCase } from "@/lib/utils";

export function OrganizationSettings() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Organization</h1>
      <Card>
        <CardHeader><CardTitle>Beacon Corporate Realty Limited</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Default organization ID</span><strong>beacon-corporate-realty</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Brand color</span><strong>#b11226</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Logo</span><strong>public/branding/beacon-logo.jpeg</strong></div>
        </CardContent>
      </Card>
    </section>
  );
}

export function BranchSettings() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <Card>
        <CardHeader><CardTitle>Head Office</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Branch records live at organizations/{`{organizationId}`}/branches/{`{branchId}`} and are seeded for local development.</CardContent>
      </Card>
    </section>
  );
}

export function UserSettings() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Users</h1>
      <Card>
        <CardHeader><CardTitle>Invite Workflow</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Use the `provisionOrganizationMember` Cloud Function scaffold for secure member creation and custom-claim assignment.</CardContent>
      </Card>
    </section>
  );
}

export function RoleSettings() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Roles and Permissions</h1>
      <div className="grid gap-4">
        {Object.entries(rolePermissions).map(([role, permissions]) => (
          <Card key={role}>
            <CardHeader><CardTitle>{titleCase(role)}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
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
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <Card>
        <CardHeader><CardTitle>Protected Audit Trail</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Audit logs are write-protected in Firestore rules for ordinary users. Client writes are scaffolded for development, while production audit writes should use Cloud Functions.</CardContent>
      </Card>
    </section>
  );
}
