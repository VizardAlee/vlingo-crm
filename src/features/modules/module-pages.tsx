"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where, type QueryConstraint } from "firebase/firestore";
import { CalendarClock, CheckCircle2, CircleCheck, Clock, Flame, GitBranch, ListTodo, MessageSquarePlus, PhoneCall, Plus, Repeat2, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PermissionDenied, LoadingState, ErrorState } from "@/components/ui/state";
import { CrmTable } from "@/components/tables/crm-table";
import { ModuleForm } from "@/features/modules/module-form";
import { columnsFor, type ModuleConfig } from "@/features/modules/module-config";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, statusTone, titleCase } from "@/lib/utils";
import { listDocuments, type DocumentRecord } from "@/services/documents";
import { createOrgRecord, getOrgRecord, listOrgRecords, updateOrgRecord, writeAuditLog } from "@/services/repository";
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

function collectionForRelatedEntity(type: unknown): ModuleConfig["collection"] | null {
  if (type === "lead") {
    return "leads";
  }

  if (type === "client") {
    return "clients";
  }

  if (type === "property") {
    return "properties";
  }

  if (type === "unit") {
    return "propertyUnits";
  }

  if (type === "task") {
    return "tasks";
  }

  return null;
}

function routeForRelatedEntity(type: unknown, id: string) {
  const collectionName = collectionForRelatedEntity(type);
  if (!collectionName) {
    return null;
  }

  if (collectionName === "propertyUnits") {
    return `/units/${id}`;
  }

  return `/${collectionName}/${id}`;
}

function recordDisplayName(record: Record<string, unknown>) {
  return String(record.fullName ?? record.name ?? record.title ?? record.subject ?? record.unitNumber ?? record.referenceNumber ?? record.id ?? "Record");
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

async function safeGetRelatedRecord(organizationId: string, record: Record<string, unknown> | null) {
  if (!record?.relatedEntityId) {
    return null;
  }

  const collectionName = collectionForRelatedEntity(record.relatedEntityType);
  if (!collectionName) {
    return null;
  }

  try {
    return await getOrgRecord<Record<string, unknown> & { id: string }>(organizationId, collectionName, String(record.relatedEntityId));
  } catch {
    return null;
  }
}

const leadJourneyStages = [
  { description: "Fresh lead from manual entry or import.", key: "new", label: "New" },
  { description: "A call, WhatsApp, email, or visit has happened.", key: "contacted", label: "Contacted" },
  { description: "Budget, need, location, and timeline are understood.", key: "qualified", label: "Qualified" },
  { description: "A matching property or unit has been suggested.", key: "propertyRecommended", label: "Recommended" },
  { description: "A physical or virtual inspection has been booked.", key: "inspectionScheduled", label: "Inspection set" },
  { description: "Inspection has happened and outcome is recorded.", key: "inspectionCompleted", label: "Inspection done" },
  { description: "Price, payment plan, and terms are being discussed.", key: "negotiation", label: "Negotiation" },
  { description: "Proposal, offer, or reservation details have been shared.", key: "offerMade", label: "Offer made" },
  { description: "Deposit, reservation fee, or formal commitment is pending.", key: "paymentPending", label: "Payment pending" },
] as const;

const terminalLeadStages = [
  { icon: CircleCheck, key: "converted", label: "Closed won" },
  { icon: XCircle, key: "lost", label: "Closed lost" },
] as const;

const interactionTypes = [
  "phoneCall",
  "whatsappMessage",
  "email",
  "meeting",
  "inspection",
  "followUp",
  "documentRequest",
  "internalNote",
] as const;

const lostReasons = ["No budget", "Wrong location", "Bought elsewhere", "Unreachable", "Price issue", "Timeline changed", "Not serious", "Duplicate lead", "Other"];

function dateDisplay(value: unknown) {
  if (!value) {
    return "Not set";
  }

  if (value instanceof Date || typeof value === "string") {
    return formatDate(value);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatDate(value.toDate() as Date);
  }

  return String(value);
}

function formatRecordValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Not set";
  }

  if (value instanceof Date || typeof value === "string") {
    return String(value);
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return dateDisplay(value);
  }

  return String(value);
}

function isOpenTask(task: Record<string, unknown>) {
  return !["completed", "cancelled"].includes(String(task.status ?? ""));
}

function LeadJourneyPanel({
  activities,
  id,
  onChanged,
  record,
  tasks,
}: {
  activities: Record<string, unknown>[];
  id: string;
  onChanged: () => Promise<void>;
  record: Record<string, unknown>;
  tasks: Record<string, unknown>[];
}) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [stageStatus, setStageStatus] = useState(String(record.status ?? "new"));
  const [stageNote, setStageNote] = useState("");
  const [lostReason, setLostReason] = useState(String(record.lostReason ?? ""));
  const [interactionType, setInteractionType] = useState<(typeof interactionTypes)[number]>("phoneCall");
  const [interactionSubject, setInteractionSubject] = useState("");
  const [interactionBody, setInteractionBody] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState("medium");
  const [saving, setSaving] = useState<"stage" | "interaction" | "task" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentStatus = String(record.status ?? "new");
  const currentStageIndex = leadJourneyStages.findIndex((stage) => stage.key === currentStatus);
  const openTasks = tasks.filter(isOpenTask);
  const context = user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null;
  const canUpdateLead = hasAnyPermission(member, ["leads.assign", "leads.updateAssigned"]);
  const canCreateActivity = hasPermission(member, "activities.create");
  const canCreateTask = hasPermission(member, "tasks.create");

  async function handleStageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to update the journey.");
      return;
    }

    if (stageStatus === "converted") {
      setError("Use Convert when the lead has made a confirmed business commitment.");
      return;
    }

    if (!stageNote.trim()) {
      setError("Add a short note so the stage change has context.");
      return;
    }

    if (stageStatus === "lost" && !lostReason.trim()) {
      setError("Choose or enter a lost reason before closing the lead as lost.");
      return;
    }

    const stageHistory = Array.isArray(record.stageHistory) ? record.stageHistory : [];
    const nextPayload: Record<string, unknown> = {
      lostReason: stageStatus === "lost" ? lostReason : "",
      stageHistory: [
        ...stageHistory,
        {
          at: new Date().toISOString(),
          from: currentStatus,
          note: stageNote.trim(),
          reason: stageStatus === "lost" ? lostReason : "",
          to: stageStatus,
          userId: context.userId,
        },
      ],
      status: stageStatus,
    };

    if (["contacted", "qualified", "inspectionCompleted", "negotiation", "offerMade", "paymentPending", "lost"].includes(stageStatus)) {
      nextPayload.lastContactAt = new Date().toISOString();
    }

    setSaving("stage");
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord("leads", id, nextPayload, context);
      const activityId = await createOrgRecord("activities", {
        body: stageNote.trim(),
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "completed",
        subject: `Stage changed to ${titleCase(stageStatus)}`,
        type: stageStatus === "lost" ? "internalNote" : "followUp",
      }, context, "ACT");
      await writeAuditLog(context, "lead.stageChange", "leads", id, nextPayload);
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: `Stage changed to ${titleCase(stageStatus)}` });
      setStageNote("");
      if (stageStatus === "lost") {
        setLostReason(lostReason);
      }
      setSuccess("Sales journey updated.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update sales journey.");
    } finally {
      setSaving(null);
    }
  }

  async function handleInteractionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to log an interaction.");
      return;
    }

    if (!interactionSubject.trim()) {
      setError("Add an interaction subject.");
      return;
    }

    setSaving("interaction");
    setError(null);
    setSuccess(null);
    try {
      const activityId = await createOrgRecord("activities", {
        body: interactionBody.trim(),
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "completed",
        subject: interactionSubject.trim(),
        type: interactionType,
      }, context, "ACT");

      const nextLeadUpdate: Record<string, unknown> = { lastContactAt: new Date().toISOString() };
      if (currentStatus === "new" && interactionType !== "internalNote") {
        nextLeadUpdate.status = "contacted";
        setStageStatus("contacted");
        nextLeadUpdate.stageHistory = [
          ...(Array.isArray(record.stageHistory) ? record.stageHistory : []),
          {
            at: new Date().toISOString(),
            from: "new",
            note: interactionSubject.trim(),
            to: "contacted",
            userId: context.userId,
          },
        ];
      }

      await updateOrgRecord("leads", id, nextLeadUpdate, context);
      await writeAuditLog(context, "activity.create", "activities", activityId, { relatedEntityId: id, subject: interactionSubject.trim() });
      setInteractionSubject("");
      setInteractionBody("");
      setSuccess("Interaction logged.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to log interaction.");
    } finally {
      setSaving(null);
    }
  }

  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to create a follow-up.");
      return;
    }

    if (!followUpTitle.trim()) {
      setError("Add a follow-up title.");
      return;
    }

    setSaving("task");
    setError(null);
    setSuccess(null);
    try {
      const taskId = await createOrgRecord("tasks", {
        assignedTo: String(record.assignedTo ?? context.userId),
        description: `Lead follow-up for ${String(record.fullName ?? record.referenceNumber ?? id)}`,
        dueAt: followUpDueAt || "",
        priority: followUpPriority,
        relatedEntityId: id,
        relatedEntityType: "lead",
        status: "notStarted",
        title: followUpTitle.trim(),
      }, context, "TASK");

      await updateOrgRecord("leads", id, { nextFollowUpAt: followUpDueAt || "" }, context);
      await writeAuditLog(context, "task.create", "tasks", taskId, { relatedEntityId: id, title: followUpTitle.trim() });
      setFollowUpTitle("");
      setFollowUpDueAt("");
      setSuccess("Follow-up task created.");
      await onChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create follow-up task.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Sales Journey</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">A lead becomes a client only after conversion at Closed Won.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(currentStatus)}>{titleCase(currentStatus)}</Badge>
            <Badge tone={openTasks.length ? "warning" : "muted"}>{openTasks.length} open follow-up{openTasks.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {leadJourneyStages.map((stage, index) => {
              const isDone = currentStatus === "converted" || currentStatus === "lost" || (currentStageIndex >= 0 && index < currentStageIndex);
              const isCurrent = stage.key === currentStatus;
              return (
                <div className={cn("rounded-md border p-3", isCurrent ? "border-primary bg-primary/5" : isDone ? "border-success/30 bg-success/5" : "bg-white")} key={stage.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.description}</p>
                </div>
              );
            })}
            {terminalLeadStages.map((stage) => {
              const Icon = stage.icon;
              const active = currentStatus === stage.key;
              return (
                <div className={cn("rounded-md border p-3", active ? stage.key === "converted" ? "border-success bg-success/5" : "border-destructive bg-destructive/5" : "bg-white")} key={stage.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <Icon className={cn("h-4 w-4", active ? stage.key === "converted" ? "text-success" : "text-destructive" : "text-muted-foreground")} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.key === "converted" ? "Confirmed commitment, payment, reservation, or approved conversion." : "Lead is closed with a clear reason and note."}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Lead value</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(Number(record.budgetMaximum ?? record.budgetMinimum ?? 0))}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Last contact</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.lastContactAt)}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Next follow-up</p>
              <p className="mt-1 text-lg font-semibold">{dateDisplay(record.nextFollowUpAt)}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Temperature</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold"><Flame className="h-4 w-4 text-warning" /> {titleCase(String(record.leadTemperature ?? "warm"))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Move Stage</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleStageSubmit}>
              <Field label="Next stage">
                <Select disabled={!canUpdateLead || currentStatus === "converted"} value={stageStatus} onChange={(event) => setStageStatus(event.target.value)}>
                  {[...leadJourneyStages, { description: "", key: "lost", label: "Closed lost" }].map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
                </Select>
              </Field>
              {stageStatus === "lost" ? (
                <Field label="Lost reason">
                  <Select disabled={!canUpdateLead} value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                    <option value="">Select lost reason</option>
                    {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label="Stage note">
                <Textarea disabled={!canUpdateLead || currentStatus === "converted"} placeholder="What happened, what changed, or what should happen next?" value={stageNote} onChange={(event) => setStageNote(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canUpdateLead || currentStatus === "converted" || saving === "stage"} type="submit">
                <Send className="h-4 w-4" />
                {saving === "stage" ? "Updating" : "Update stage"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Log Interaction</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleInteractionSubmit}>
              <Field label="Interaction type">
                <Select disabled={!canCreateActivity || currentStatus === "converted"} value={interactionType} onChange={(event) => setInteractionType(event.target.value as (typeof interactionTypes)[number])}>
                  {interactionTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </Select>
              </Field>
              <Field label="Subject">
                <Input disabled={!canCreateActivity || currentStatus === "converted"} value={interactionSubject} onChange={(event) => setInteractionSubject(event.target.value)} />
              </Field>
              <Field label="Details">
                <Textarea disabled={!canCreateActivity || currentStatus === "converted"} value={interactionBody} onChange={(event) => setInteractionBody(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={!canCreateActivity || currentStatus === "converted" || saving === "interaction"} type="submit" variant="secondary">
                <PhoneCall className="h-4 w-4" />
                {saving === "interaction" ? "Logging" : "Log interaction"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next Action</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleTaskSubmit}>
              <Field label="Follow-up title">
                <Input disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} placeholder="Call back, send proposal, book inspection..." value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} />
              </Field>
              <Field label="Due date">
                <Input disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} type="date" value={followUpDueAt} onChange={(event) => setFollowUpDueAt(event.target.value)} />
              </Field>
              <Field label="Priority">
                <Select disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost"} value={followUpPriority} onChange={(event) => setFollowUpPriority(event.target.value)}>
                  {["low", "medium", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
                </Select>
              </Field>
              <Button className="h-11" disabled={!canCreateTask || currentStatus === "converted" || currentStatus === "lost" || saving === "task"} type="submit" variant="outline">
                <CalendarClock className="h-4 w-4" />
                {saving === "task" ? "Creating" : "Create follow-up"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Journey History</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {Array.isArray(record.stageHistory) && record.stageHistory.length ? record.stageHistory.slice().reverse().map((entry, index) => {
            const item = entry as Record<string, unknown>;
            return (
              <div className="rounded-md border p-3" key={`${String(item.at)}-${index}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{titleCase(String(item.from ?? "new"))} to {titleCase(String(item.to ?? currentStatus))}</span>
                  <span className="text-xs text-muted-foreground">{dateDisplay(item.at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{String(item.note ?? "No note")}</p>
                {item.reason ? <p className="mt-1 text-xs font-medium text-destructive">Reason: {String(item.reason)}</p> : null}
              </div>
            );
          }) : <div className="rounded-md border border-dashed p-4 text-muted-foreground">No stage changes have been recorded yet.</div>}
          {activities.length ? activities.slice(0, 3).map((activity) => (
            <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/activities/${activity.id}`} key={String(activity.id)}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{String(activity.subject ?? "Activity")}</span>
                <Badge tone="muted">{titleCase(String(activity.type ?? "activity"))}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{String(activity.body ?? "No details")}</p>
            </Link>
          )) : null}
        </CardContent>
      </Card>
    </div>
  );
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
  const [relatedRecord, setRelatedRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const relatedType = relatedTypeForCollection(config.collection);
    const [nextRecord, nextTasks, nextActivities, nextDocuments] = await Promise.all([
      getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id),
      safeListOrgRecords(activeOrganizationId, "tasks"),
      safeListOrgRecords(activeOrganizationId, "activities"),
      safeListDocuments(activeOrganizationId),
    ]);
    const nextRelatedRecord = config.collection === "activities" ? await safeGetRelatedRecord(activeOrganizationId, nextRecord) : null;
    setRecord(nextRecord);
    setRelatedRecord(nextRelatedRecord);
    if (relatedType) {
      setTasks(nextTasks.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 8));
      setActivities(nextActivities.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 10));
      setDocuments(nextDocuments.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
    }
  }, [activeOrganizationId, config.collection, id]);

  useEffect(() => {
    let mounted = true;
    const relatedType = relatedTypeForCollection(config.collection);

    Promise.all([
      getOrgRecord<Record<string, unknown> & { id: string }>(activeOrganizationId, config.collection, id),
      safeListOrgRecords(activeOrganizationId, "tasks"),
      safeListOrgRecords(activeOrganizationId, "activities"),
      safeListDocuments(activeOrganizationId),
    ])
      .then(async ([nextRecord, nextTasks, nextActivities, nextDocuments]) => {
        if (!mounted) {
          return;
        }

        const nextRelatedRecord = await safeGetRelatedRecord(activeOrganizationId, config.collection === "activities" ? nextRecord : null);
        if (!mounted) {
          return;
        }

        setRecord(nextRecord);
        setRelatedRecord(nextRelatedRecord);
        if (relatedType) {
          setTasks(nextTasks.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 8));
          setActivities(nextActivities.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 10));
          setDocuments(nextDocuments.filter((item) => item.relatedEntityType === relatedType && item.relatedEntityId === id).slice(0, 5));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
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
  const relatedRecordHref = relatedRecord ? routeForRelatedEntity(record.relatedEntityType, relatedRecord.id) : null;
  const relatedRecordLabel = titleCase(String(record.relatedEntityType ?? "Related record"));

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
          {config.collection === "leads" && hasPermission(member, "clients.create") && status !== "converted" && status !== "lost" ? (
            <Button className="h-11 w-full md:h-10 md:w-auto" disabled={actionLoading} onClick={handleConvertLead} type="button" variant="secondary">
              <Repeat2 className="h-4 w-4" />
              Convert to client
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
      {config.collection === "leads" ? (
        <LeadJourneyPanel activities={activities} id={id} onChanged={loadDetail} record={record} tasks={tasks} />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {config.collection === "activities" && relatedRecord ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{relatedRecordLabel}</span>
                {relatedRecordHref ? (
                  <Link className="max-w-48 truncate font-medium text-primary" href={relatedRecordHref}>{recordDisplayName(relatedRecord)}</Link>
                ) : (
                  <span className="max-w-48 truncate font-medium">{recordDisplayName(relatedRecord)}</span>
                )}
              </div>
            ) : null}
            {Object.entries(record).slice(0, 8).map(([key, value]) => (
              <div className="flex justify-between gap-4" key={key}>
                <span className="text-muted-foreground">{key}</span>
                <span className="max-w-48 truncate font-medium">{formatRecordValue(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
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
