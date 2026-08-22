"use client";

import { Ban, Building2, CheckCircle2, MapPin, Pencil, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { formatDate, statusTone } from "@/lib/utils";
import {
  createOrganizationBranch,
  deleteOrganizationBranch,
  listOrganizationBranches,
  setOrganizationBranchStatus,
  updateOrganizationBranch,
  type BranchRecord,
  type BranchStatus,
} from "@/services/branches";

interface BranchFormState {
  address: string;
  code: string;
  name: string;
}

const defaultBranch: BranchFormState = {
  address: "",
  code: "",
  name: "",
};

function branchTourTarget(name: string) {
  return `branches-${name}`;
}

const branchTourSteps: GuidedTourStep[] = [
  { target: branchTourTarget("create"), title: "Create branch", body: "Add branch name, code, and address to create an active location for users and records." },
  { target: branchTourTarget("name"), title: "Branch name", body: "Use the clear office or location name that staff recognize." },
  { target: branchTourTarget("code"), title: "Branch code", body: "Use a short unique code. It becomes part of branch identity and reporting." },
  { target: branchTourTarget("status"), title: "Branch lifecycle", body: "Disable a branch to stop it being selected for new work. Enable it later, or delete it only when it has no users or linked records." },
  { target: branchTourTarget("address"), title: "Address", body: "Record the physical branch address for operations and administration." },
  { target: branchTourTarget("save"), title: "Save branch", body: "Create or update the branch after checking the details." },
  { target: branchTourTarget("edit"), title: "Edit existing branches", body: "Existing branch cards let you update details, disable or enable a location, and safely delete an unused disabled branch." },
];

function branchToForm(branch: BranchRecord): BranchFormState {
  return {
    address: branch.address ?? "",
    code: branch.code ?? "",
    name: branch.name ?? "",
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

  async function changeBranchStatus(branch: BranchRecord) {
    const nextStatus: BranchStatus = branch.status === "active" ? "closed" : "active";
    if (nextStatus === "closed" && !window.confirm(
      `Disable ${branch.name}? It will no longer appear as a location for new work. Reassign its users first.`,
    )) {
      return;
    }

    setSaving(`status-${branch.id}`);
    setError(null);
    setSuccess(null);
    try {
      await setOrganizationBranchStatus(activeOrganizationId, branch.id, nextStatus);
      const message = `${branch.name} was ${nextStatus === "closed" ? "disabled" : "enabled"}.`;
      setSuccess(message);
      toast({ title: `Branch ${nextStatus === "closed" ? "disabled" : "enabled"}`, description: message, variant: "success" });
      await loadBranches();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to change branch status.";
      setError(message);
      toast({ title: "Unable to change branch status", description: message, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function removeBranch(branch: BranchRecord) {
    if (branch.status !== "closed") {
      const message = "Disable the branch before deleting it.";
      setError(message);
      toast({ title: "Branch must be disabled", description: message, variant: "error" });
      return;
    }
    if (!window.confirm(
      `Delete ${branch.name}? This is allowed only when the branch has no assigned users or linked business records.`,
    )) {
      return;
    }

    setSaving(`delete-${branch.id}`);
    setError(null);
    setSuccess(null);
    try {
      await deleteOrganizationBranch(activeOrganizationId, branch.id);
      const message = `${branch.name} was deleted.`;
      setSuccess(message);
      toast({ title: "Branch deleted", description: message, variant: "success" });
      await loadBranches();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to delete branch.";
      setError(message);
      toast({ title: "Unable to delete branch", description: message, variant: "error" });
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
          <p className="mt-1 text-sm text-muted-foreground">Create and manage locations. Disable closed offices, or delete an unused branch without orphaning users or business records.</p>
        </div>
        <div className="mt-4 grid gap-2 md:mt-0 md:flex">
          <GuidedTour className="h-11 w-full md:w-auto" storageKey="beacon-tour:branches" steps={branchTourSteps} />
          <Button className="h-11 w-full md:w-auto" onClick={loadBranches} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
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
          <form className="grid gap-4 lg:grid-cols-[1fr_160px]" data-tour={branchTourTarget("create")} onSubmit={submitCreate}>
            <div data-tour={branchTourTarget("name")}>
            <Field label="Branch name">
              <Input required value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
            </Field>
            </div>
            <div data-tour={branchTourTarget("code")}>
            <Field label="Code">
              <Input required value={draft.code} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} />
            </Field>
            </div>
            <div className="lg:col-span-2" data-tour={branchTourTarget("address")}>
            <Field label="Address">
              <Textarea required value={draft.address} onChange={(event) => setDraft((value) => ({ ...value, address: event.target.value }))} />
            </Field>
            </div>
            <div className="lg:col-span-2 lg:flex lg:items-end lg:justify-end">
              <Button className="h-11 w-full lg:w-auto" data-tour={branchTourTarget("save")} disabled={saving === "create"} type="submit">
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
            <Card data-tour={branchTourTarget("edit")} key={branch.id}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{branch.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{branch.code}</p>
                  </div>
                  <Badge data-tour={branchTourTarget("status")} tone={statusTone(branch.status)}>{branch.status === "closed" ? "Disabled" : "Active"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <Input value={edit.name} onChange={(event) => updateEdit(branch, { name: event.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={edit.code} onChange={(event) => updateEdit(branch, { code: event.target.value })} />
                  </Field>
                  <div className="grid content-end text-xs text-muted-foreground">
                    Updated {formatDate(branch.updatedAt ?? branch.createdAt)}
                  </div>
                </div>
                <Field label="Address">
                  <Textarea value={edit.address} onChange={(event) => updateEdit(branch, { address: event.target.value })} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button disabled={saving === `update-${branch.id}`} onClick={() => submitUpdate(branch)} type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Save
                  </Button>
                  <Button disabled={saving === `status-${branch.id}`} onClick={() => changeBranchStatus(branch)} type="button" variant="outline">
                    {branch.status === "active" ? <Ban className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    {branch.status === "active" ? "Disable" : "Enable"}
                  </Button>
                  <Button disabled={branch.status !== "closed" || saving === `delete-${branch.id}`} onClick={() => removeBranch(branch)} title={branch.status !== "closed" ? "Disable this branch before deleting it" : "Delete unused branch"} type="button" variant="danger">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
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
            <table className="w-full min-w-[1080px] text-left text-sm">
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
                        <Badge data-tour={branchTourTarget("status")} tone={statusTone(branch.status)}>{branch.status === "closed" ? "Disabled" : "Active"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(branch.updatedAt ?? branch.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="grid min-w-32 gap-2">
                          <Button disabled={saving === `update-${branch.id}`} onClick={() => submitUpdate(branch)} size="sm" type="button" variant="outline">
                            <Pencil className="h-4 w-4" />
                            Save
                          </Button>
                          <Button disabled={saving === `status-${branch.id}`} onClick={() => changeBranchStatus(branch)} size="sm" type="button" variant="outline">
                            {branch.status === "active" ? <Ban className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            {branch.status === "active" ? "Disable" : "Enable"}
                          </Button>
                          <Button disabled={branch.status !== "closed" || saving === `delete-${branch.id}`} onClick={() => removeBranch(branch)} size="sm" title={branch.status !== "closed" ? "Disable this branch before deleting it" : "Delete unused branch"} type="button" variant="danger">
                            <Trash2 className="h-4 w-4" />
                            Delete
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
      ) : null}
    </section>
  );
}
