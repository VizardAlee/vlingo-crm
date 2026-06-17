"use client";

import { CheckCircle2, MailPlus, Pencil, Power, PowerOff, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission, rolePermissions } from "@/lib/permissions";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import {
  disableOrganizationMember,
  inviteOrganizationMember,
  listBranches,
  listMembers,
  reactivateOrganizationMember,
  updateOrganizationMember,
  type InviteUserInput,
} from "@/services/users";
import type { Branch, Member, RoleName } from "@/types/crm";

const roles = Object.keys(rolePermissions) as RoleName[];

const defaultInvite = {
  branchId: "head-office",
  displayName: "",
  email: "",
  phoneNumber: "",
  role: "salesExecutive" as RoleName,
};

function canAssignRole(currentMember: Member | null, role: RoleName) {
  const permissions = rolePermissions[role];
  const roleIsPrivileged = role === "superAdmin" || role === "managingDirector" || permissions.some((permission) => ["users.manage", "roles.manage"].includes(permission));
  return !roleIsPrivileged || hasPermission(currentMember, "roles.manage");
}

export function UsersManagement() {
  const { activeOrganizationId, member, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState(defaultInvite);
  const [editing, setEditing] = useState<Record<string, { branchId: string; role: RoleName }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignableRoles = useMemo(() => roles.filter((role) => canAssignRole(member, role)), [member]);

  const loadUsers = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [nextBranches, nextMembers] = await Promise.all([listBranches(activeOrganizationId), listMembers(activeOrganizationId)]);
      setBranches(nextBranches);
      setMembers(nextMembers);
      setInvite((value) => ({ ...value, branchId: nextBranches[0]?.id ?? value.branchId }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("invite");
    setError(null);
    setSuccess(null);
    try {
      const payload: InviteUserInput = {
        ...invite,
        organizationId: activeOrganizationId,
      };
      const result = await inviteOrganizationMember(payload);
      setInvite({ ...defaultInvite, branchId: branches[0]?.id ?? "head-office" });
      setSuccess(result.setupEmailSent
        ? `Invitation email sent to ${payload.email}.`
        : `User was created, but the invitation email was not sent. ${result.setupEmailError ?? "Check SMTP configuration."}`);
      await loadUsers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to invite user.");
    } finally {
      setSaving(null);
    }
  }

  async function submitMemberUpdate(target: Member) {
    const next = editing[target.id];
    if (!next) {
      return;
    }

    setSaving(`update-${target.id}`);
    setError(null);
    setSuccess(null);
    try {
      await updateOrganizationMember({ ...next, organizationId: activeOrganizationId, uid: target.id });
      setSuccess(`${target.displayName} was updated.`);
      await loadUsers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update member.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleStatus(target: Member) {
    setSaving(`status-${target.id}`);
    setError(null);
    setSuccess(null);
    try {
      if (target.status === "disabled") {
        await reactivateOrganizationMember(activeOrganizationId, target.id);
        setSuccess(`${target.displayName} was reactivated.`);
      } else {
        await disableOrganizationMember(activeOrganizationId, target.id);
        setSuccess(`${target.displayName} was disabled.`);
      }
      await loadUsers();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update member status.");
    } finally {
      setSaving(null);
    }
  }

  if (!hasPermission(member, "users.manage")) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading users" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Invite-only access, role assignment, branch assignment, and account status controls.</p>
        </div>
        <Button className="mt-4 h-11 w-full md:mt-0 md:w-auto" onClick={loadUsers} type="button" variant="outline">
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
          <CardTitle>Invite User</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-5" onSubmit={submitInvite}>
            <Field label="Full name">
              <Input required value={invite.displayName} onChange={(event) => setInvite((value) => ({ ...value, displayName: event.target.value }))} />
            </Field>
            <Field label="Email">
              <Input required type="email" value={invite.email} onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={invite.phoneNumber} onChange={(event) => setInvite((value) => ({ ...value, phoneNumber: event.target.value }))} />
            </Field>
            <Field label="Branch">
              <Select required value={invite.branchId} onChange={(event) => setInvite((value) => ({ ...value, branchId: event.target.value }))}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </Field>
            <Field label="Role">
              <Select required value={invite.role} onChange={(event) => setInvite((value) => ({ ...value, role: event.target.value as RoleName }))}>
                {assignableRoles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
              </Select>
            </Field>
            <div className="lg:col-span-5 lg:flex lg:justify-end">
              <Button className="h-11 w-full lg:w-auto" disabled={saving === "invite"} type="submit">
                <MailPlus className="h-4 w-4" />
                {saving === "invite" ? "Inviting" : "Invite and send setup email"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:hidden">
        {members.map((item) => {
          const edit = editing[item.id] ?? { branchId: item.branchId, role: item.role };
          const isSelf = item.id === user?.uid;
          return (
            <Card key={item.id}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.email}</p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Role">
                    <Select disabled={isSelf} value={edit.role} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, role: event.target.value as RoleName } }))}>
                      {assignableRoles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
                    </Select>
                  </Field>
                  <Field label="Branch">
                    <Select value={edit.branchId} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchId: event.target.value } }))}>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={saving === `update-${item.id}` || isSelf} onClick={() => submitMemberUpdate(item)} type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Save
                  </Button>
                  <Button disabled={saving === `status-${item.id}` || isSelf} onClick={() => toggleStatus(item)} type="button" variant={item.status === "disabled" ? "secondary" : "danger"}>
                    {item.status === "disabled" ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    {item.status === "disabled" ? "Reactivate" : "Disable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>Organization Members</CardTitle>
        </CardHeader>
        <CardContent className="max-w-full overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((item) => {
                const edit = editing[item.id] ?? { branchId: item.branchId, role: item.role };
                const isSelf = item.id === user?.uid;
                return (
                  <tr className="border-t" key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.displayName}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Select className="w-48" disabled={isSelf} value={edit.role} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, role: event.target.value as RoleName } }))}>
                        {assignableRoles.map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select className="w-44" value={edit.branchId} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchId: event.target.value } }))}>
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.updatedAt ?? item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button disabled={saving === `update-${item.id}` || isSelf} onClick={() => submitMemberUpdate(item)} size="sm" type="button" variant="outline">
                          <ShieldCheck className="h-4 w-4" />
                          Save
                        </Button>
                        <Button disabled={saving === `status-${item.id}` || isSelf} onClick={() => toggleStatus(item)} size="sm" type="button" variant={item.status === "disabled" ? "secondary" : "danger"}>
                          {item.status === "disabled" ? "Reactivate" : "Disable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
