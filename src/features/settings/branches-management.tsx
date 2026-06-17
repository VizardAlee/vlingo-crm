"use client";

import { Building2, CheckCircle2, MapPin, Pencil, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { formatDate, statusTone, titleCase } from "@/lib/utils";
import {
  createOrganizationBranch,
  listOrganizationBranches,
  updateOrganizationBranch,
  type BranchRecord,
  type BranchStatus,
} from "@/services/branches";

interface BranchFormState {
  address: string;
  code: string;
  name: string;
  status: BranchStatus;
}

const defaultBranch: BranchFormState = {
  address: "",
  code: "",
  name: "",
  status: "active",
};

function branchToForm(branch: BranchRecord): BranchFormState {
  return {
    address: branch.address ?? "",
    code: branch.code ?? "",
    name: branch.name ?? "",
    status: branch.status,
  };
}

export function BranchesManagement() {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [draft, setDraft] = useState<BranchFormState>(defaultBranch);
  const [editing, setEditing] = useState<Record<string, BranchFormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageBranches = hasPermission(member, "users.manage");

  const loadBranches = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setBranches(await listOrganizationBranches(activeOrganizationId));
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to load branches.";
      setError(message);
      toast({ title: "Unable to load branches", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, toast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadBranches();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadBranches]);

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      const message = "You need to be signed in to create a branch.";
      setError(message);
      toast({ title: "Unable to create branch", description: message, variant: "error" });
      return;
    }

    setSaving("create");
    setError(null);
    setSuccess(null);
    try {
      await createOrganizationBranch({
        ...draft,
        organizationId: activeOrganizationId,
        userId: user.uid,
      });
      setDraft(defaultBranch);
      const message = `${draft.name} was created.`;
      setSuccess(message);
      toast({ title: "Branch created", description: message, variant: "success" });
      await loadBranches();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to create branch.";
      setError(message);
      toast({ title: "Unable to create branch", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function submitUpdate(branch: BranchRecord) {
    if (!user) {
      const message = "You need to be signed in to update a branch.";
      setError(message);
      toast({ title: "Unable to update branch", description: message, variant: "error" });
      return;
    }

    const next = editing[branch.id] ?? branchToForm(branch);
    setSaving(`update-${branch.id}`);
    setError(null);
    setSuccess(null);
    try {
      await updateOrganizationBranch({
        ...next,
        branchId: branch.id,
        organizationId: activeOrganizationId,
        userId: user.uid,
      });
      const message = `${next.name} was updated.`;
      setSuccess(message);
      toast({ title: "Branch updated", description: message, variant: "success" });
      await loadBranches();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to update branch.";
      setError(message);
      toast({ title: "Unable to update branch", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  function updateEdit(branch: BranchRecord, updates: Partial<BranchFormState>) {
    setEditing((value) => ({
      ...value,
      [branch.id]: {
        ...(value[branch.id] ?? branchToForm(branch)),
        ...updates,
      },
    }));
  }

  if (!canManageBranches) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading branches" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create branch offices, update branch details, and close branches without removing historic records.</p>
        </div>
        <Button className="mt-4 h-11 w-full md:mt-0 md:w-auto" onClick={loadBranches} type="button" variant="outline">
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
          <CardTitle>Create Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[1fr_160px_160px]" onSubmit={submitCreate}>
            <Field label="Branch name">
              <Input required value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
            </Field>
            <Field label="Code">
              <Input required value={draft.code} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} />
            </Field>
            <Field label="Status">
              <Select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as BranchStatus }))}>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </Select>
            </Field>
            <Field label="Address">
              <Textarea required value={draft.address} onChange={(event) => setDraft((value) => ({ ...value, address: event.target.value }))} />
            </Field>
            <div className="lg:col-span-2 lg:flex lg:items-end lg:justify-end">
              <Button className="h-11 w-full lg:w-auto" disabled={saving === "create"} type="submit">
                <Plus className="h-4 w-4" />
                {saving === "create" ? "Creating" : "Create branch"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {branches.length === 0 ? <EmptyState title="No branches found" /> : null}

      <div className="grid gap-3 lg:hidden">
        {branches.map((branch) => {
          const edit = editing[branch.id] ?? branchToForm(branch);
          return (
            <Card key={branch.id}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{branch.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{branch.code}</p>
                  </div>
                  <Badge tone={statusTone(branch.status)}>{titleCase(branch.status)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input value={edit.name} onChange={(event) => updateEdit(branch, { name: event.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={edit.code} onChange={(event) => updateEdit(branch, { code: event.target.value })} />
                  </Field>
                  <Field label="Status">
                    <Select value={edit.status} onChange={(event) => updateEdit(branch, { status: event.target.value as BranchStatus })}>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </Field>
                  <div className="grid content-end text-xs text-muted-foreground">
                    Updated {formatDate(branch.updatedAt ?? branch.createdAt)}
                  </div>
                </div>
                <Field label="Address">
                  <Textarea value={edit.address} onChange={(event) => updateEdit(branch, { address: event.target.value })} />
                </Field>
                <Button disabled={saving === `update-${branch.id}`} onClick={() => submitUpdate(branch)} type="button" variant="outline">
                  <Pencil className="h-4 w-4" />
                  Save branch
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {branches.length > 0 ? (
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle>Branch Offices</CardTitle>
          </CardHeader>
          <CardContent className="max-w-full overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const edit = editing[branch.id] ?? branchToForm(branch);
                  return (
                    <tr className="border-t align-top" key={branch.id}>
                      <td className="px-4 py-3">
                        <Input className="w-56" value={edit.name} onChange={(event) => updateEdit(branch, { name: event.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <Input className="w-28" value={edit.code} onChange={(event) => updateEdit(branch, { code: event.target.value })} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-72 gap-2">
                          <MapPin className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <Textarea className="min-h-20" value={edit.address} onChange={(event) => updateEdit(branch, { address: event.target.value })} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select className="w-32" value={edit.status} onChange={(event) => updateEdit(branch, { status: event.target.value as BranchStatus })}>
                          <option value="active">Active</option>
                          <option value="closed">Closed</option>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(branch.updatedAt ?? branch.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button disabled={saving === `update-${branch.id}`} onClick={() => submitUpdate(branch)} size="sm" type="button" variant="outline">
                          <Pencil className="h-4 w-4" />
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
