"use client";

import Link from "next/link";
import { where } from "firebase/firestore";
import { ArrowLeft, Boxes, BriefcaseBusiness, CheckCircle2, CircleDollarSign, ClipboardList, Plus, ShoppingCart, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { dealToInstallationPlan } from "@/features/installations/installation-quote";
import { effectiveBranchId, hasPermission } from "@/lib/permissions";
import { createReference, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import {
  closeStockReservation,
  createPurchaseOrder,
  createStockReservation,
  listInventoryBalances,
  listInventoryItems,
  listInventoryLocations,
  listInventoryMovements,
  listInventoryPurchaseOrders,
  listInventoryReservations,
  listInventorySuppliers,
} from "@/services/inventory";
import { createOrgRecord, getOrgRecord, listOrgRecords, updateOrgRecord, writeAuditLog } from "@/services/repository";
import type {
  Deal,
  FinanceExpense,
  FinancePayment,
  InstallationCostCategory,
  InstallationCostLine,
  InstallationInvoice,
  InstallationMaterialLine,
  InstallationProject,
  InstallationProjectStatus,
  InventoryBalance,
  InventoryLocation,
  InventoryMovement,
  InventoryPurchaseOrder,
  InventoryReservation,
  InventorySupplier,
  Offering,
} from "@/types/crm";

const projectStatuses: InstallationProjectStatus[] = ["draft", "planning", "awaitingApproval", "approved", "procurement", "scheduled", "inProgress", "commissioning", "completed", "onHold", "cancelled"];
const costCategories: InstallationCostCategory[] = ["externalMaterial", "service", "labour", "transport", "subcontractor", "permit", "equipmentHire", "other"];

function numberValue(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function projectTone(status: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "completed") return "success";
  if (["cancelled", "onHold"].includes(status)) return "danger";
  if (["inProgress", "commissioning"].includes(status)) return "info";
  if (["awaitingApproval", "procurement"].includes(status)) return "warning";
  return "muted";
}

function writeContext(activeOrganizationId: string, branchId: string, user: ReturnType<typeof useAuth>["user"], displayName?: string) {
  if (!user) throw new Error("You must be signed in.");
  return {
    organizationId: activeOrganizationId,
    branchId,
    userId: user.uid,
    userEmail: user.email ?? undefined,
    userName: displayName ?? user.displayName ?? undefined,
  };
}

export function InstallationProjectsPage() {
  const { activeBranchId, activeOrganizationId, member } = useAuth();
  const [projects, setProjects] = useState<InstallationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const branchId = effectiveBranchId(member, activeBranchId);

  useEffect(() => {
    listOrgRecords<InstallationProject>(activeOrganizationId, "installationProjects", branchId ? [where("branchId", "==", branchId)] : [])
      .then(setProjects)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Unable to load installation projects."))
      .finally(() => setLoading(false));
  }, [activeOrganizationId, branchId]);

  if (!hasPermission(member, "installations.read")) return <PermissionDenied />;

  const active = projects.filter((project) => !["completed", "cancelled"].includes(project.status)).length;
  const contractValue = projects.reduce((sum, project) => sum + Number(project.contractValue ?? 0), 0);

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Installation Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deliver each installation from the CRM deal through materials, procurement, site work, invoicing, and profitability.</p>
        </div>
        {hasPermission(member, "installations.create") ? <ButtonLink href="/installations/new"><Plus className="h-4 w-4" />New installation</ButtonLink> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="All projects" value={String(projects.length)} />
        <Summary label="Active delivery" value={String(active)} />
        <Summary label="Contract value" value={formatCurrency(contractValue)} />
      </div>
      {error ? <ErrorState message={error} /> : loading ? <LoadingState label="Loading installation projects" /> : (
        <div className="grid gap-3">
          {projects.length ? projects.map((project) => (
            <Link className="rounded-md border bg-white p-4 shadow-sm transition hover:border-primary/40" href={`/installations/${project.id}`} key={project.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold">{project.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{project.referenceNumber} · {project.clientName || "No client linked"} · {project.siteAddress || "No site address"}</div>
                </div>
                <Badge tone={projectTone(project.status)}>{titleCase(project.status)}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <span>Contract: <strong>{formatCurrency(project.contractValue)}</strong></span>
                <span>Progress: <strong>{Number(project.progressPercent ?? 0)}%</strong></span>
                <span>Target: <strong>{formatDate(project.expectedCompletionDate)}</strong></span>
              </div>
            </Link>
          )) : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No installation projects yet. Create one directly or from an existing CRM deal.</div>}
        </div>
      )}
    </section>
  );
}

export function InstallationProjectCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealId, setDealId] = useState(searchParams.get("dealId") ?? "");
  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [notes, setNotes] = useState("");
  const branchId = effectiveBranchId(member, activeBranchId);
  const selectedDeal = useMemo(() => deals.find((item) => item.id === dealId), [dealId, deals]);
  const importedPlan = useMemo(() => dealToInstallationPlan(selectedDeal), [selectedDeal]);

  useEffect(() => {
    listOrgRecords<Deal>(activeOrganizationId, "deals", branchId ? [where("branchId", "==", branchId)] : [])
      .then((nextDeals) => {
        setDeals(nextDeals);
        const initialDeal = nextDeals.find((item) => item.id === dealId);
        if (initialDeal) {
          setName((current) => current || `${initialDeal.title} installation`);
          setContractValue((current) => current || String(initialDeal.agreedAmount ?? initialDeal.quoteTotal ?? initialDeal.offerAmount ?? initialDeal.quoteSubtotal ?? ""));
          setScopeOfWork((current) => current || initialDeal.scopeOfWork || "");
        }
      })
      .catch(() => setDeals([]));
  }, [activeOrganizationId, branchId, dealId]);

  if (!hasPermission(member, "installations.create")) return <PermissionDenied />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !siteAddress.trim() || numberValue(contractValue) < 0) {
      setError("Enter the project name, site address, and a valid contract value.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const deal = deals.find((item) => item.id === dealId);
      if (deal?.installationProjectId) {
        setError("This deal already has an installation project. Open the existing project from the deal instead.");
        return;
      }
      const installationPlan = dealToInstallationPlan(deal);
      const context = writeContext(activeOrganizationId, branchId, user, member?.displayName);
      const id = await createOrgRecord("installationProjects", {
        name: name.trim(),
        dealId: deal?.id ?? "",
        dealReference: deal?.referenceNumber ?? "",
        clientId: deal?.clientId ?? "",
        clientName: deal?.clientName ?? deal?.leadName ?? "",
        clientPhone: deal?.clientPhone ?? "",
        clientEmail: deal?.clientEmail ?? "",
        siteAddress: siteAddress.trim(),
        projectManagerId: user?.uid ?? "",
        projectManagerName: member?.displayName ?? user?.displayName ?? "",
        startDate: startDate || "",
        expectedCompletionDate: expectedCompletionDate || "",
        contractValue: numberValue(contractValue),
        contingencyAmount: 0,
        amountReceived: Number(deal?.paidAmount ?? 0),
        progressPercent: 0,
        scopeOfWork: scopeOfWork.trim(),
        materials: installationPlan.materials,
        costLines: installationPlan.costLines,
        status: "planning" as InstallationProjectStatus,
        notes: notes.trim(),
      }, context, "INS");
      if (deal && hasPermission(member, "deals.update")) {
        const needsProcurement = deal.quoteLines?.some((line) => ["procureToStock", "directToSite"].includes(line.fulfillment));
        await updateOrgRecord("deals", deal.id, { installationProjectId: id, installationProjectName: name.trim(), fulfillmentStatus: needsProcurement ? "procurement" : "scheduled" }, context);
      }
      await writeAuditLog(context, "installation.create", "installationProjects", id, { dealId: deal?.id ?? null, name: name.trim() });
      router.push(`/installations/${id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create installation project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-5">
      <div><h1 className="text-2xl font-semibold">Create installation project</h1><p className="mt-1 text-sm text-muted-foreground">Choose the CRM deal and its products, external materials, services, labour, and transport will be copied into the project automatically.</p></div>
      {error ? <ErrorState message={error} /> : null}
      <Card><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <Field className="md:col-span-2" label="CRM deal (optional)"><Select value={dealId} onChange={(event) => { const nextDealId = event.target.value; const deal = deals.find((item) => item.id === nextDealId); setDealId(nextDealId); if (deal) { setName(`${deal.title} installation`); setContractValue(String(deal.agreedAmount ?? deal.quoteTotal ?? deal.offerAmount ?? deal.quoteSubtotal ?? "")); setScopeOfWork(deal.scopeOfWork ?? ""); } }}><option value="">No linked deal</option>{deals.filter((deal) => !deal.installationProjectId).map((deal) => <option key={deal.id} value={deal.id}>{deal.title} · {deal.referenceNumber}</option>)}</Select></Field>
        {selectedDeal ? (
          <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 md:col-span-2">
            <div>
              <strong className="text-sm">Deal items ready to import</strong>
              <p className="mt-1 text-xs text-muted-foreground">These requirements will be available in the project immediately after creation. You do not need to enter them again.</p>
            </div>
            {[...importedPlan.materials.map((line) => ({ id: line.id, label: "Inventory material", name: line.offeringName, quantity: line.quantityRequired })), ...importedPlan.costLines.map((line) => ({ id: line.id, label: line.category === "externalMaterial" ? "External material" : titleCase(line.category), name: line.description, quantity: line.quantity }))].map((line) => (
              <div className="flex flex-col justify-between gap-1 rounded-md border bg-white px-3 py-2 text-sm sm:flex-row sm:items-center" key={line.id}>
                <span><strong>{line.name}</strong><span className="ml-2 text-xs text-muted-foreground">{line.label}</span></span>
                <span>{line.quantity} required</span>
              </div>
            ))}
            {!importedPlan.materials.length && !importedPlan.costLines.length ? <p className="text-sm text-warning">This deal has no quotation items to import. Add its products and services to the deal quotation first.</p> : null}
          </div>
        ) : null}
        <Field label="Project name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Contract value"><Input min="0" required type="number" value={contractValue} onChange={(event) => setContractValue(event.target.value)} /></Field>
        <Field className="md:col-span-2" label="Installation site"><Textarea required value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} /></Field>
        <Field label="Start date"><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
        <Field label="Expected completion"><Input type="date" value={expectedCompletionDate} onChange={(event) => setExpectedCompletionDate(event.target.value)} /></Field>
        <Field className="md:col-span-2" label="Scope of work"><Textarea value={scopeOfWork} onChange={(event) => setScopeOfWork(event.target.value)} /></Field>
        <Field className="md:col-span-2" label="Internal notes"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex gap-2 md:col-span-2"><Button disabled={saving} type="submit">{saving ? "Creating…" : "Create project"}</Button><ButtonLink href="/installations" variant="outline">Cancel</ButtonLink></div>
      </form></CardContent></Card>
    </section>
  );
}

type ProjectData = {
  balances: InventoryBalance[];
  expenses: FinanceExpense[];
  items: Offering[];
  locations: InventoryLocation[];
  movements: InventoryMovement[];
  orders: InventoryPurchaseOrder[];
  payments: FinancePayment[];
  reservations: InventoryReservation[];
  suppliers: InventorySupplier[];
  invoices: InstallationInvoice[];
};

const emptyData: ProjectData = { balances: [], expenses: [], invoices: [], items: [], locations: [], movements: [], orders: [], payments: [], reservations: [], suppliers: [] };

export function InstallationProjectDetailPage({ id }: { id: string }) {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<InstallationProject | null>(null);
  const [data, setData] = useState<ProjectData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [material, setMaterial] = useState({ offeringId: "", quantity: "1", estimatedUnitCost: "", notes: "" });
  const [cost, setCost] = useState({ category: "externalMaterial" as InstallationCostCategory, description: "", vendor: "", quantity: "1", estimatedUnitCost: "", actualAmount: "", paymentStatus: "notPaid" as InstallationCostLine["paymentStatus"] });
  const [reservation, setReservation] = useState({ offeringId: "", locationId: "", quantity: "1" });
  const [procurement, setProcurement] = useState({ supplierId: "", offeringId: "", quantity: "1", unitCost: "", paymentArrangement: "credit" as "paid" | "credit" | "partPaid", amountPaid: "", paymentMethod: "bankTransfer" as "cash" | "bankTransfer" | "card" | "cheque" | "other", paymentDueAt: "" });
  const [invoice, setInvoice] = useState({ description: "Installation project milestone", subtotal: "", taxAmount: "0", dueAt: "", notes: "" });

  const load = useCallback(async () => {
    try {
      const nextProject = await getOrgRecord<InstallationProject>(activeOrganizationId, "installationProjects", id);
      if (!nextProject) { setProject(null); return; }
      setProject(nextProject);
      const [items, balances, locations, reservations, movements, suppliers, orders, expenses, payments, invoices] = await Promise.all([
        listInventoryItems(activeOrganizationId, member),
        listInventoryBalances(activeOrganizationId, member),
        listInventoryLocations(activeOrganizationId, member),
        listInventoryReservations(activeOrganizationId, member),
        listInventoryMovements(activeOrganizationId, member),
        listInventorySuppliers(activeOrganizationId, member),
        listInventoryPurchaseOrders(activeOrganizationId, member),
        hasPermission(member, "reports.viewFinancial") ? listOrgRecords<FinanceExpense>(activeOrganizationId, "financeExpenses", [where("relatedEntityId", "==", id)]) : Promise.resolve([]),
        hasPermission(member, "reports.viewFinancial") ? listOrgRecords<FinancePayment>(activeOrganizationId, "financePayments", [where("sourceId", "==", id)]) : Promise.resolve([]),
        listOrgRecords<InstallationInvoice>(activeOrganizationId, "installationInvoices", [where("installationProjectId", "==", id)]),
      ]);
      setData({ items, balances, locations, reservations: reservations.filter((item) => item.relatedEntityId === id), movements: movements.filter((item) => item.externalReference === id), suppliers, orders: orders.filter((item) => item.installationProjectId === id), expenses, payments, invoices });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load project workspace.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, id, member]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const itemMap = useMemo(() => new Map(data.items.map((item) => [item.id, item])), [data.items]);
  const canUpdate = hasPermission(member, "installations.update");
  const context = project && user ? writeContext(activeOrganizationId, project.branchId, user, member?.displayName) : null;

  if (!hasPermission(member, "installations.read")) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading installation workspace" />;
  if (!project) return <ErrorState message={error ?? "Installation project not found."} />;

  const materials = project.materials ?? [];
  const costLines = project.costLines ?? [];
  const externalMaterials = costLines.filter((line) => line.category === "externalMaterial");
  const plannedMaterials = materials.reduce((sum, line) => sum + line.quantityRequired * line.estimatedUnitCost, 0);
  const plannedOther = costLines.reduce((sum, line) => sum + line.quantity * line.estimatedUnitCost, 0);
  const recordedCostActual = costLines.reduce((sum, line) => sum + Number(line.actualAmount ?? 0), 0);
  const financeExpenseActual = data.expenses.filter((item) => ["approved", "paid"].includes(item.approvalStatus)).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const actualOther = Math.max(recordedCostActual, financeExpenseActual);
  const issuedCost = data.movements.reduce((sum, movement) => sum + Number(itemMap.get(movement.offeringId)?.costPrice ?? 0) * Number(movement.quantity ?? 0), 0);
  const supplierCommitments = data.orders.filter((order) => !["rejected", "cancelled"].includes(order.approvalStatus)).reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
  const amountReceived = data.payments.filter((payment) => payment.verificationStatus === "verified").reduce((sum, payment) => sum + Number(payment.amount ?? 0), Number(project.amountReceived ?? 0));
  const actualCost = actualOther + issuedCost + supplierCommitments;
  const forecastCost = Math.max(plannedMaterials, issuedCost + supplierCommitments) + Math.max(plannedOther, actualOther);
  const margin = Number(project.contractValue ?? 0) - forecastCost;
  const amountInvoiced = data.invoices.reduce((sum, entry) => sum + Number(entry.totalAmount ?? 0), 0);

  async function saveProject(payload: Record<string, unknown>, action: string, success: string) {
    if (!context) return;
    setSaving(action);
    setError(null);
    try {
      await updateOrgRecord("installationProjects", id, payload, context);
      await writeAuditLog(context, `installation.${action}`, "installationProjects", id, payload);
      toast({ title: success, variant: "success" });
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update project.");
    } finally { setSaving(""); }
  }

  async function addMaterial(event: FormEvent) {
    event.preventDefault();
    const item = itemMap.get(material.offeringId);
    if (!item) return setError("Select an inventory product.");
    const line: InstallationMaterialLine = { id: uid("mat"), offeringId: item.id, offeringName: item.name, sku: item.sku, brandId: item.brandId, brandName: item.brandName, quantityRequired: numberValue(material.quantity), estimatedUnitCost: numberValue(material.estimatedUnitCost || String(item.costPrice ?? 0)), notes: material.notes.trim() };
    if (line.quantityRequired <= 0) return setError("Material quantity must be greater than zero.");
    await saveProject({ materials: [...materials, line] }, "material.add", "Material requirement added");
    setMaterial({ offeringId: "", quantity: "1", estimatedUnitCost: "", notes: "" });
  }

  async function addCost(event: FormEvent) {
    event.preventDefault();
    if (!cost.description.trim() || numberValue(cost.quantity) <= 0) return setError("Enter a description and positive quantity.");
    const line: InstallationCostLine = { id: uid("cost"), category: cost.category, description: cost.description.trim(), vendor: cost.vendor.trim(), quantity: numberValue(cost.quantity), estimatedUnitCost: numberValue(cost.estimatedUnitCost), actualAmount: numberValue(cost.actualAmount), paymentStatus: cost.paymentStatus };
    await saveProject({ costLines: [...costLines, line] }, "cost.add", "Project cost added");
    setCost({ category: "externalMaterial", description: "", vendor: "", quantity: "1", estimatedUnitCost: "", actualAmount: "", paymentStatus: "notPaid" });
  }

  async function reserveMaterial(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    const item = itemMap.get(reservation.offeringId);
    const location = data.locations.find((entry) => entry.id === reservation.locationId);
    if (!item || !location) return setError("Select a material and stock location.");
    setSaving("reserve");
    try {
      await createStockReservation({ organizationId: activeOrganizationId, branchId: location.branchId, offeringId: item.id, locationId: location.id, quantity: numberValue(reservation.quantity), relatedEntityType: "project", relatedEntityId: id, relatedEntityName: project.name, notes: `Reserved for ${project.referenceNumber}` });
      toast({ title: "Stock reserved", description: "The quantity is protected for this installation.", variant: "success" });
      setReservation({ offeringId: "", locationId: "", quantity: "1" });
      await load();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to reserve stock."); } finally { setSaving(""); }
  }

  async function closeReservation(record: InventoryReservation, action: "release" | "fulfill") {
    setSaving(`reservation-${record.id}`);
    try {
      await closeStockReservation({ organizationId: activeOrganizationId, reservationId: record.id, action });
      toast({ title: action === "fulfill" ? "Materials issued to project" : "Reservation released", variant: "success" });
      await load();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to update reservation."); } finally { setSaving(""); }
  }

  async function procure(event: FormEvent) {
    event.preventDefault();
    if (!project) return;
    if (!procurement.supplierId || !procurement.offeringId) return setError("Select a supplier and inventory item.");
    setSaving("procure");
    try {
      await createPurchaseOrder({ organizationId: activeOrganizationId, branchId: project.branchId, supplierId: procurement.supplierId, installationProjectId: id, installationProjectName: project.name, lines: [{ offeringId: procurement.offeringId, quantity: numberValue(procurement.quantity), unitCost: numberValue(procurement.unitCost) }], paymentArrangement: procurement.paymentArrangement, amountPaid: numberValue(procurement.amountPaid), paymentMethod: procurement.paymentArrangement === "credit" ? undefined : procurement.paymentMethod, paymentDueAt: procurement.paymentDueAt || undefined, notes: `Procurement for ${project.referenceNumber}` });
      toast({ title: "Purchase order submitted", description: "It is linked to this project and follows inventory approval and receiving controls.", variant: "success" });
      await load();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to create purchase order."); } finally { setSaving(""); }
  }

  async function createMilestoneInvoice(event: FormEvent) {
    event.preventDefault();
    if (!context || !project) return;
    const subtotal = numberValue(invoice.subtotal);
    const taxAmount = numberValue(invoice.taxAmount);
    if (!invoice.description.trim() || subtotal <= 0 || taxAmount < 0) return setError("Enter an invoice description and positive amount.");
    setSaving("invoice");
    try {
      const invoiceNumber = createReference("PINV");
      const invoiceId = await createOrgRecord("installationInvoices", {
        invoiceNumber,
        referenceNumber: invoiceNumber,
        installationProjectId: id,
        installationProjectName: project.name,
        projectReference: project.referenceNumber,
        clientName: project.clientName || "Customer",
        clientPhone: project.clientPhone || "",
        clientEmail: project.clientEmail || "",
        siteAddress: project.siteAddress,
        description: invoice.description.trim(),
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        issuedAt: new Date().toISOString().slice(0, 10),
        dueAt: invoice.dueAt || "",
        paymentStatus: "unpaid",
        notes: invoice.notes.trim(),
        status: "issued",
      }, context, "PINV");
      await writeAuditLog(context, "installation.invoice.create", "installationInvoices", invoiceId, { installationProjectId: id, totalAmount: subtotal + taxAmount });
      toast({ title: "Project invoice created", variant: "success" });
      setInvoice({ description: "Installation project milestone", subtotal: "", taxAmount: "0", dueAt: "", notes: "" });
      await load();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to create project invoice."); } finally { setSaving(""); }
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><Link className="mb-2 inline-flex items-center gap-1 text-sm text-primary" href="/installations"><ArrowLeft className="h-4 w-4" />All installations</Link><h1 className="text-2xl font-semibold">{project.name}</h1><p className="mt-1 text-sm text-muted-foreground">{project.referenceNumber} · {project.clientName || "No client"} · {project.siteAddress}</p></div>
        <div className="flex flex-wrap gap-2"><Badge tone={projectTone(project.status)}>{titleCase(project.status)}</Badge>{project.dealId ? <ButtonLink href={`/deals/${project.dealId}`} variant="outline">Open CRM deal</ButtonLink> : null}{hasPermission(member, "tasks.create") ? <ButtonLink href={`/tasks/new?relatedEntityType=installationProject&relatedEntityId=${id}`} variant="outline">Add task</ButtonLink> : null}{hasPermission(member, "activities.create") ? <ButtonLink href={`/activities/new?relatedEntityType=installationProject&relatedEntityId=${id}`} variant="outline">Log update</ButtonLink> : null}{hasPermission(member, "installations.read") ? <ButtonLink href={`/documents?relatedEntityType=installationProject&relatedEntityId=${id}`} variant="outline">Documents</ButtonLink> : null}{hasPermission(member, "finance.create") ? <ButtonLink href={`/finance?source=installationProject:${id}&relatedEntityType=installationProject&relatedEntityId=${id}`} variant="outline">Record payment / expense</ButtonLink> : null}</div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Summary label="Contract value" value={formatCurrency(project.contractValue)} />
        <Summary label="Amount received" value={formatCurrency(amountReceived)} />
        <Summary label="Planned cost" value={formatCurrency(plannedMaterials + plannedOther)} />
        <Summary label="Committed / actual" value={formatCurrency(actualCost)} />
        <Summary label="Forecast margin" value={formatCurrency(margin)} />
        <Summary label="Amount invoiced" value={formatCurrency(amountInvoiced)} />
      </div>
      <Card><CardHeader><CardTitle>Delivery control</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
        <Field label="Project status"><Select disabled={!canUpdate || Boolean(saving)} value={project.status} onChange={(event) => void saveProject({ status: event.target.value }, "status.update", "Project status updated")}>{projectStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</Select></Field>
        <Field label="Progress %"><Input disabled={!canUpdate} max="100" min="0" type="number" value={project.progressPercent ?? 0} onChange={(event) => setProject({ ...project, progressPercent: numberValue(event.target.value) })} onBlur={() => void saveProject({ progressPercent: project.progressPercent ?? 0 }, "progress.update", "Progress updated")} /></Field>
        <div className="rounded-md bg-muted p-3 text-sm"><div className="font-medium">Project owner</div><div className="mt-1 text-muted-foreground">{project.projectManagerName || "Not assigned"}</div></div>
        <div className="md:col-span-3"><div className="text-sm font-medium">Scope of work</div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{project.scopeOfWork || "No scope recorded."}</p></div>
      </CardContent></Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-4 w-4" />Project materials</CardTitle></CardHeader><CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={addMaterial}>
            <Field className="sm:col-span-2" label="Inventory product"><Select disabled={!canUpdate} value={material.offeringId} onChange={(event) => { const item = itemMap.get(event.target.value); setMaterial((current) => ({ ...current, offeringId: event.target.value, estimatedUnitCost: String(item?.costPrice ?? "") })); }}><option value="">Select product</option>{data.items.filter((item) => item.brandId).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku || "No SKU"}</option>)}</Select></Field>
            <Field label="Quantity required"><Input min="0.01" step="any" type="number" value={material.quantity} onChange={(event) => setMaterial((current) => ({ ...current, quantity: event.target.value }))} /></Field>
            <Field label="Estimated unit cost"><Input min="0" step="any" type="number" value={material.estimatedUnitCost} onChange={(event) => setMaterial((current) => ({ ...current, estimatedUnitCost: event.target.value }))} /></Field>
            <Button className="sm:col-span-2" disabled={!canUpdate || saving === "material.add"} type="submit"><Plus className="h-4 w-4" />Add material requirement</Button>
          </form>
          <div className="grid gap-2">
            {materials.map((line) => { const available = data.balances.filter((balance) => balance.offeringId === line.offeringId).reduce((sum, balance) => sum + Number(balance.quantityOnHand ?? 0) - Number(balance.quantityReserved ?? 0), 0); return <div className="rounded-md border p-3 text-sm" key={line.id}><div className="flex justify-between gap-3"><strong>{line.offeringName}</strong><span>{line.quantityRequired} required</span></div><div className="mt-1 flex justify-between text-muted-foreground"><span>{line.sku || "Inventory product"}</span><span className={available < line.quantityRequired ? "text-warning" : "text-success"}>{available} available across accessible branches</span></div>{line.notes ? <p className="mt-2 text-xs text-muted-foreground">{line.notes}</p> : null}</div>; })}
            {externalMaterials.map((line) => <div className="rounded-md border p-3 text-sm" key={`material-${line.id}`}><div className="flex justify-between gap-3"><strong>{line.description}</strong><span>{line.quantity} required</span></div><div className="mt-1 flex justify-between text-muted-foreground"><span>External / direct-to-site material</span><span>{formatCurrency(line.quantity * line.estimatedUnitCost)}</span></div>{line.notes ? <p className="mt-2 text-xs text-muted-foreground">{line.notes}</p> : null}</div>)}
            {!materials.length && !externalMaterials.length ? <Empty text="Deal materials appear here automatically. You can also add another inventory requirement when the project scope changes." /> : null}
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4" />External materials and service costs</CardTitle></CardHeader><CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={addCost}>
            <Field label="Cost category"><Select disabled={!canUpdate} value={cost.category} onChange={(event) => setCost((current) => ({ ...current, category: event.target.value as InstallationCostCategory }))}>{costCategories.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</Select></Field>
            <Field label="Description"><Input value={cost.description} onChange={(event) => setCost((current) => ({ ...current, description: event.target.value }))} /></Field>
            <Field label="Vendor / worker"><Input value={cost.vendor} onChange={(event) => setCost((current) => ({ ...current, vendor: event.target.value }))} /></Field>
            <Field label="Quantity"><Input min="0.01" step="any" type="number" value={cost.quantity} onChange={(event) => setCost((current) => ({ ...current, quantity: event.target.value }))} /></Field>
            <Field label="Estimated unit cost"><Input min="0" step="any" type="number" value={cost.estimatedUnitCost} onChange={(event) => setCost((current) => ({ ...current, estimatedUnitCost: event.target.value }))} /></Field>
            <Field label="Actual amount (if known)"><Input min="0" step="any" type="number" value={cost.actualAmount} onChange={(event) => setCost((current) => ({ ...current, actualAmount: event.target.value }))} /></Field>
            <Field label="Payment status"><Select value={cost.paymentStatus} onChange={(event) => setCost((current) => ({ ...current, paymentStatus: event.target.value as InstallationCostLine["paymentStatus"] }))}><option value="notPaid">Not paid</option><option value="partPaid">Part paid</option><option value="paid">Paid</option><option value="credit">Credit agreement</option></Select></Field>
            <Button className="self-end" disabled={!canUpdate || saving === "cost.add"} type="submit"><Plus className="h-4 w-4" />Add project cost</Button>
          </form>
          <div className="grid gap-2">{costLines.map((line) => <div className="rounded-md border p-3 text-sm" key={line.id}><div className="flex justify-between gap-3"><strong>{line.description}</strong><span>{formatCurrency(line.quantity * line.estimatedUnitCost)}</span></div><div className="mt-1 text-muted-foreground">{titleCase(line.category)} · {line.vendor || "No vendor"} · {titleCase(line.paymentStatus || "notPaid")}</div>{line.notes ? <p className="mt-2 text-xs text-muted-foreground">{line.notes}</p> : null}</div>)}{!costLines.length ? <Empty text="Record externally sourced materials, labour, transport, permits, hire, and subcontracting here." /> : null}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Reserve and issue available stock</CardTitle></CardHeader><CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={reserveMaterial}>
            <Field label="Material"><Select value={reservation.offeringId} onChange={(event) => setReservation((current) => ({ ...current, offeringId: event.target.value }))}><option value="">Select material</option>{materials.map((line) => <option key={line.id} value={line.offeringId}>{line.offeringName}</option>)}</Select></Field>
            <Field label="Stock location"><Select value={reservation.locationId} onChange={(event) => setReservation((current) => ({ ...current, locationId: event.target.value }))}><option value="">Select branch/location</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field>
            <Field label="Quantity"><Input min="0.01" step="any" type="number" value={reservation.quantity} onChange={(event) => setReservation((current) => ({ ...current, quantity: event.target.value }))} /></Field>
            <Button className="sm:col-span-3" disabled={!hasPermission(member, "inventory.reserve") || saving === "reserve"} type="submit">Reserve stock</Button>
          </form>
          <div className="grid gap-2">{data.reservations.map((record) => <div className="rounded-md border p-3 text-sm" key={record.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{record.offeringName}</strong><div className="text-muted-foreground">{record.quantity} · {record.locationName}</div></div><Badge tone={record.reservationStatus === "fulfilled" ? "success" : record.reservationStatus === "active" ? "warning" : "muted"}>{titleCase(record.reservationStatus)}</Badge></div>{record.reservationStatus === "active" ? <div className="mt-3 flex gap-2"><Button disabled={!hasPermission(member, "inventory.issue") || saving === `reservation-${record.id}`} onClick={() => void closeReservation(record, "fulfill")} size="sm" type="button">Issue to project</Button><Button disabled={!hasPermission(member, "inventory.reserve") || saving === `reservation-${record.id}`} onClick={() => void closeReservation(record, "release")} size="sm" type="button" variant="outline">Release</Button></div> : null}</div>)}{!data.reservations.length ? <Empty text="No stock has been reserved for this project." /> : null}</div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Procure inventory shortages</CardTitle></CardHeader><CardContent className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={procure}>
            <Field label="Supplier"><Select value={procurement.supplierId} onChange={(event) => setProcurement((current) => ({ ...current, supplierId: event.target.value }))}><option value="">Select supplier</option>{data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></Field>
            <Field label="Inventory item"><Select value={procurement.offeringId} onChange={(event) => setProcurement((current) => ({ ...current, offeringId: event.target.value, unitCost: String(itemMap.get(event.target.value)?.costPrice ?? "") }))}><option value="">Select item</option>{materials.map((line) => <option key={line.id} value={line.offeringId}>{line.offeringName}</option>)}</Select></Field>
            <Field label="Quantity"><Input min="0.01" step="any" type="number" value={procurement.quantity} onChange={(event) => setProcurement((current) => ({ ...current, quantity: event.target.value }))} /></Field>
            <Field label="Unit cost"><Input min="0" step="any" type="number" value={procurement.unitCost} onChange={(event) => setProcurement((current) => ({ ...current, unitCost: event.target.value }))} /></Field>
            <Field label="Payment arrangement"><Select value={procurement.paymentArrangement} onChange={(event) => setProcurement((current) => ({ ...current, paymentArrangement: event.target.value as typeof current.paymentArrangement }))}><option value="credit">Credit</option><option value="partPaid">Part paid</option><option value="paid">Paid</option></Select></Field>
            {procurement.paymentArrangement !== "credit" ? <Field label="Payment method"><Select value={procurement.paymentMethod} onChange={(event) => setProcurement((current) => ({ ...current, paymentMethod: event.target.value as typeof current.paymentMethod }))}><option value="bankTransfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="cheque">Cheque</option><option value="other">Other</option></Select></Field> : null}
            {procurement.paymentArrangement === "partPaid" ? <Field label="Amount paid"><Input min="0" step="any" type="number" value={procurement.amountPaid} onChange={(event) => setProcurement((current) => ({ ...current, amountPaid: event.target.value }))} /></Field> : null}
            {procurement.paymentArrangement !== "paid" ? <Field label="Payment due"><Input required type="date" value={procurement.paymentDueAt} onChange={(event) => setProcurement((current) => ({ ...current, paymentDueAt: event.target.value }))} /></Field> : null}
            <Button className="self-end" disabled={!hasPermission(member, "inventory.procure") || saving === "procure"} type="submit">Create linked purchase order</Button>
          </form>
          <div className="grid gap-2">{data.orders.map((order) => <div className="rounded-md border p-3 text-sm" key={order.id}><div className="flex justify-between gap-3"><strong>{order.referenceNumber}</strong><span>{formatCurrency(order.totalAmount)}</span></div><div className="mt-1 text-muted-foreground">{order.supplierName} · {titleCase(order.approvalStatus)} · {titleCase(order.paymentStatus || "unpaid")}</div></div>)}{!data.orders.length ? <Empty text="Project-linked purchase orders appear here. Receiving them adds stock through the normal controlled workflow." /> : null}</div>
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" />Project financial ledger</CardTitle></CardHeader><CardContent>
        <div className="grid gap-3 md:grid-cols-4"><Ledger icon={<CheckCircle2 className="h-4 w-4" />} label="Customer receipts" value={formatCurrency(amountReceived)} /><Ledger icon={<Boxes className="h-4 w-4" />} label="Inventory issued" value={formatCurrency(issuedCost)} /><Ledger icon={<ShoppingCart className="h-4 w-4" />} label="Supplier commitments" value={formatCurrency(supplierCommitments)} /><Ledger icon={<Truck className="h-4 w-4" />} label="Other actual costs" value={formatCurrency(actualOther)} /></div>
        <p className="mt-4 text-xs text-muted-foreground">Forecast margin equals contract value less issued stock at catalogue cost, linked supplier commitments, approved finance expenses, and actual project cost entries. It updates as operational records are posted.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Milestone invoices</CardTitle></CardHeader><CardContent className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={createMilestoneInvoice}>
          <Field className="sm:col-span-2" label="Invoice description / milestone"><Input value={invoice.description} onChange={(event) => setInvoice((current) => ({ ...current, description: event.target.value }))} /></Field>
          <Field label="Subtotal"><Input min="0" step="any" type="number" value={invoice.subtotal} onChange={(event) => setInvoice((current) => ({ ...current, subtotal: event.target.value }))} /></Field>
          <Field label="Tax amount"><Input min="0" step="any" type="number" value={invoice.taxAmount} onChange={(event) => setInvoice((current) => ({ ...current, taxAmount: event.target.value }))} /></Field>
          <Field label="Payment due"><Input type="date" value={invoice.dueAt} onChange={(event) => setInvoice((current) => ({ ...current, dueAt: event.target.value }))} /></Field>
          <Field label="Invoice note"><Input value={invoice.notes} onChange={(event) => setInvoice((current) => ({ ...current, notes: event.target.value }))} /></Field>
          <Button className="sm:col-span-2" disabled={!hasPermission(member, "finance.create") || saving === "invoice"} type="submit">Create milestone invoice</Button>
        </form>
        <div className="grid content-start gap-2">{data.invoices.map((entry) => <div className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={entry.id}><div><strong>{entry.invoiceNumber || entry.referenceNumber}</strong><div className="mt-1 text-muted-foreground">{entry.description} · {formatCurrency(entry.totalAmount)} · due {formatDate(entry.dueAt)}</div></div><ButtonLink href={`/installation-invoices/${entry.id}`} size="sm" variant="outline">View / print</ButtonLink></div>)}{!data.invoices.length ? <Empty text="Create deposit, procurement, progress, commissioning, or final-balance invoices as the project advances." /> : null}</div>
      </CardContent></Card>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs font-medium uppercase text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></CardContent></Card>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}

function Ledger({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-md bg-muted p-3"><div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">{icon}{label}</div><div className="mt-2 text-lg font-semibold">{value}</div></div>;
}
