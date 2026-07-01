"use client";

import { CheckCircle2, Copy, Link2, MailPlus, Pencil, Power, PowerOff, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessAllBranches, hasPermission, memberRoles, rolePermissions } from "@/lib/permissions";
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
import type { Branch, BranchAccess, Member, RoleName } from "@/types/crm";

const roles = Object.keys(rolePermissions) as RoleName[];

const defaultInvite = {
  branchId: "head-office",
  branchAccess: "own" as BranchAccess,
  displayName: "",
  email: "",
  phoneNumber: "",
  roles: ["salesExecutive"] as RoleName[],
};

function firstAssignableRole(options: RoleName[]) {
  return options.includes("salesExecutive") ? "salesExecutive" : options[0] ?? "agent";
}

function canAssignRole(currentMember: Member | null, role: RoleName) {
  const permissions = rolePermissions[role];
  const roleIsPrivileged = role === "superAdmin" || role === "managingDirector" || permissions.some((permission) => ["users.manage", "roles.manage"].includes(permission));
  return !roleIsPrivileged || hasPermission(currentMember, "roles.manage");
}

function displayRoles(member: Member) {
  return memberRoles(member).map((role) => titleCase(role)).join(", ");
}

function hasUnassignableRole(target: Member, options: RoleName[]) {
  return memberRoles(target).some((role) => !options.includes(role));
}

function normalizeRoleSelection(rolesValue: RoleName[], fallback: RoleName) {
  return rolesValue.length ? rolesValue : [fallback];
}

function normalizeAssignableRoleSelection(rolesValue: RoleName[], fallback: RoleName, options: RoleName[]) {
  const allowed = rolesValue.filter((role) => options.includes(role));
  const safeFallback = options.includes(fallback) ? fallback : firstAssignableRole(options);
  return normalizeRoleSelection(allowed, safeFallback);
}

function toggleRole(rolesValue: RoleName[], role: RoleName) {
  return rolesValue.includes(role) ? rolesValue.filter((item) => item !== role) : [...rolesValue, role];
}

function RoleSelector({
  disabled,
  onChange,
  rolesValue,
  options,
}: {
  disabled?: boolean;
  onChange: (nextRoles: RoleName[]) => void;
  options: RoleName[];
  rolesValue: RoleName[];
}) {
  return (
    <div className="grid max-h-40 gap-2 overflow-auto rounded-md border bg-white p-2">
      {options.map((role) => {
        const checked = rolesValue.includes(role);
        return (
          <label className="flex cursor-pointer items-center gap-2 text-sm" key={role}>
            <Input
              checked={checked}
              className="h-4 w-4"
              disabled={disabled || (checked && rolesValue.length === 1)}
              onChange={() => onChange(toggleRole(rolesValue, role))}
              type="checkbox"
            />
            <span>{titleCase(role)}</span>
          </label>
        );
      })}
    </div>
  );
}

export function UsersManagement() {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState(defaultInvite);
  const [editing, setEditing] = useState<Record<string, { branchId: string; branchAccess: BranchAccess; roles: RoleName[] }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ email: string; setupLink: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignableRoles = useMemo(() => roles.filter((role) => canAssignRole(member, role)), [member]);
  const canGrantAllBranches = hasPermission(member, "roles.manage") || canAccessAllBranches(member);
  const defaultAssignableRole = firstAssignableRole(assignableRoles);

  const loadUsers = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [nextBranches, nextMembers] = await Promise.all([listBranches(activeOrganizationId), listMembers(activeOrganizationId)]);
      setBranches(nextBranches);
      setMembers(nextMembers);
      setInvite((value) => ({ ...value, branchId: nextBranches[0]?.id ?? value.branchId }));
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load users.";
      setError(message);
      toast({ title: "Unable to load users", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, toast]);

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
    setGeneratedInvite(null);
    setSuccess(null);
    try {
      const payload: InviteUserInput = {
        ...invite,
        roles: normalizeAssignableRoleSelection(invite.roles, defaultAssignableRole, assignableRoles),
        role: normalizeAssignableRoleSelection(invite.roles, defaultAssignableRole, assignableRoles)[0],
        organizationId: activeOrganizationId,
      };
      const result = await inviteOrganizationMember(payload);
      setInvite({ ...defaultInvite, branchId: branches[0]?.id ?? "head-office" });
      setGeneratedInvite({ email: result.email, setupLink: result.setupLink });
      const message = `User created. Copy the setup link and share it with ${payload.email}.`;
      setSuccess(message);
      toast({ title: "User created", description: message, variant: "success" });
      await loadUsers();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to invite user.";
      setError(message);
      toast({ title: "Unable to invite user", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function copyInviteLink() {
    if (!generatedInvite) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedInvite.setupLink);
      const message = `Setup link copied for ${generatedInvite.email}.`;
      setSuccess(message);
      toast({ title: "Setup link copied", description: message, variant: "success" });
    } catch {
      const message = "Unable to copy automatically. Select and copy the setup link manually.";
      setError(message);
      toast({ title: "Unable to copy setup link", description: message, variant: "error" });
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
      const nextRoles = normalizeAssignableRoleSelection(next.roles, target.role, assignableRoles);
      await updateOrganizationMember({ ...next, roles: nextRoles, role: nextRoles[0], organizationId: activeOrganizationId, uid: target.id });
      const message = `${target.displayName} was updated.`;
      setSuccess(message);
      toast({ title: "Member updated", description: message, variant: "success" });
      await loadUsers();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update member.";
      setError(message);
      toast({ title: "Unable to update member", description: message, variant: "error" });
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
        const message = `${target.displayName} was reactivated.`;
        setSuccess(message);
        toast({ title: "Member reactivated", description: message, variant: "success" });
      } else {
        await disableOrganizationMember(activeOrganizationId, target.id);
        const message = `${target.displayName} was disabled.`;
        setSuccess(message);
        toast({ title: "Member disabled", description: message, variant: "success" });
      }
      await loadUsers();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update member status.";
      setError(message);
      toast({ title: "Unable to update member status", description: message, variant: "error" });
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

      {generatedInvite ? (
        <div className="grid gap-3 rounded-md border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Setup link ready</p>
              <p className="text-sm text-muted-foreground">Share this link with {generatedInvite.email}. The user will use it to set their password.</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input aria-label="Generated setup link" readOnly value={generatedInvite.setupLink} onFocus={(event) => event.currentTarget.select()} />
            <Button className="h-10" onClick={copyInviteLink} type="button" variant="outline">
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </div>
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
            <Field label="Branch access">
              <Select
                disabled={!canGrantAllBranches}
                value={invite.branchAccess}
                onChange={(event) => setInvite((value) => ({ ...value, branchAccess: event.target.value as BranchAccess }))}
              >
                <option value="own">Own branch only</option>
                <option value="all">All branches</option>
              </Select>
            </Field>
            <div className="lg:col-span-5">
              <Field label="Roles">
                <RoleSelector
                  onChange={(nextRoles) => setInvite((value) => ({ ...value, roles: normalizeAssignableRoleSelection(nextRoles, defaultAssignableRole, assignableRoles) }))}
                  options={assignableRoles}
                  rolesValue={invite.roles}
                />
              </Field>
            </div>
            <div className="lg:col-span-5 lg:flex lg:justify-end">
              <Button className="h-11 w-full lg:w-auto" disabled={saving === "invite"} type="submit">
                <MailPlus className="h-4 w-4" />
                {saving === "invite" ? "Generating link" : "Invite and generate link"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:hidden">
        {members.map((item) => {
          const edit = editing[item.id] ?? { branchAccess: item.branchAccess ?? "own", branchId: item.branchId, roles: memberRoles(item) };
          const isSelf = item.id === user?.uid;
          const protectedRole = hasUnassignableRole(item, assignableRoles);
          const canEditTarget = !isSelf && !protectedRole;
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
                <div className="grid gap-3 text-sm">
                  <Field label="Roles">
                    <RoleSelector disabled={!canEditTarget} onChange={(nextRoles) => setEditing((value) => ({ ...value, [item.id]: { ...edit, roles: normalizeAssignableRoleSelection(nextRoles, item.role, assignableRoles) } }))} options={protectedRole ? memberRoles(item) : assignableRoles} rolesValue={protectedRole ? memberRoles(item) : edit.roles.filter((role) => assignableRoles.includes(role))} />
                    {protectedRole ? <p className="text-xs text-muted-foreground">Requires role management access.</p> : null}
                  </Field>
                  <Field label="Branch">
                    <Select disabled={!canEditTarget} value={edit.branchId} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchId: event.target.value } }))}>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Branch access">
                    <Select disabled={!canGrantAllBranches || !canEditTarget} value={edit.branchAccess} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchAccess: event.target.value as BranchAccess } }))}>
                      <option value="own">Own branch only</option>
                      <option value="all">All branches</option>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={saving === `update-${item.id}` || !canEditTarget} onClick={() => submitMemberUpdate(item)} type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Save
                  </Button>
                  <Button disabled={saving === `status-${item.id}` || !canEditTarget} onClick={() => toggleStatus(item)} type="button" variant={item.status === "disabled" ? "secondary" : "danger"}>
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
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((item) => {
                const edit = editing[item.id] ?? { branchAccess: item.branchAccess ?? "own", branchId: item.branchId, roles: memberRoles(item) };
                const isSelf = item.id === user?.uid;
                const protectedRole = hasUnassignableRole(item, assignableRoles);
                const canEditTarget = !isSelf && !protectedRole;
                return (
                  <tr className="border-t" key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.displayName}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid w-64 gap-2">
                        <RoleSelector disabled={!canEditTarget} onChange={(nextRoles) => setEditing((value) => ({ ...value, [item.id]: { ...edit, roles: normalizeAssignableRoleSelection(nextRoles, item.role, assignableRoles) } }))} options={protectedRole ? memberRoles(item) : assignableRoles} rolesValue={protectedRole ? memberRoles(item) : edit.roles.filter((role) => assignableRoles.includes(role))} />
                        <p className="text-xs text-muted-foreground">{protectedRole ? "Requires role management access." : displayRoles(item)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select className="w-44" disabled={!canEditTarget} value={edit.branchId} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchId: event.target.value } }))}>
                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select className="w-40" disabled={!canGrantAllBranches || !canEditTarget} value={edit.branchAccess} onChange={(event) => setEditing((value) => ({ ...value, [item.id]: { ...edit, branchAccess: event.target.value as BranchAccess } }))}>
                        <option value="own">Own branch only</option>
                        <option value="all">All branches</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.updatedAt ?? item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button disabled={saving === `update-${item.id}` || !canEditTarget} onClick={() => submitMemberUpdate(item)} size="sm" type="button" variant="outline">
                          <ShieldCheck className="h-4 w-4" />
                          Save
                        </Button>
                        <Button disabled={saving === `status-${item.id}` || !canEditTarget} onClick={() => toggleStatus(item)} size="sm" type="button" variant={item.status === "disabled" ? "secondary" : "danger"}>
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
