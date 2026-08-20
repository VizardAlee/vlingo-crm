"use client";

import { Download, MessageSquare, PackageCheck, Plus, RefreshCw, Send, Warehouse } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { useAuth } from "@/features/auth/auth-provider";
import { BarcodeScanner } from "@/features/inventory/barcode-scanner";
import { InventoryEnterprisePanel, type InventoryEnterpriseMode } from "@/features/inventory/inventory-enterprise-panel";
import { hasAnyPermission, hasPermission, memberRoles } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import {
  addInventoryComment,
  createInventoryBrand,
  createInventoryLocation,
  listInventoryBalances,
  listInventoryBrands,
  listInventoryComments,
  listInventoryItems,
  listInventoryLocations,
  listInventoryMovements,
  recordInventoryMovement,
} from "@/services/inventory";
import type { InventoryBalance, InventoryBrand, InventoryComment, InventoryLocation, InventoryMovement, InventoryMovementPurpose, InventoryMovementType, Offering } from "@/types/crm";

type Tab = "overview" | "movements" | "comments" | "setup" | InventoryEnterpriseMode;
const movementTypes: InventoryMovementType[] = ["receipt", "issue", "transfer", "adjustmentIn", "adjustmentOut", "returnIn", "returnOut"];

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function InventoryDashboard() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [items, setItems] = useState<Offering[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [comments, setComments] = useState<InventoryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movement, setMovement] = useState({ movementType: "receipt" as InventoryMovementType, movementPurpose: "other" as InventoryMovementPurpose, offeringId: "", quantity: 1, fromLocationId: "", toLocationId: "", externalReference: "", notes: "", occurredAt: new Date().toISOString().slice(0, 10), batchNumber: "", expiryDate: "", serialNumbers: [] as string[] });
  const [brandForm, setBrandForm] = useState({ name: "", code: "", description: "", contactName: "", contactEmail: "" });
  const [locationForm, setLocationForm] = useState({ name: "", code: "", address: "", locationType: "warehouse" as InventoryLocation["locationType"] });
  const [commentForm, setCommentForm] = useState({ brandId: "", message: "", reportPeriod: new Date().toISOString().slice(0, 7) });
  const isPartner = memberRoles(member).includes("brandPartner");
  const canMoveStock = hasAnyPermission(member, ["inventory.receive", "inventory.issue", "inventory.adjust", "inventory.transfer"]);
  const canSetup = hasPermission(member, "inventory.manageCatalog");
  const canProcure = hasAnyPermission(member, ["inventory.procure", "inventory.receive", "inventory.approve"]);
  const canCount = hasAnyPermission(member, ["inventory.count", "inventory.approve"]);
  const canReserve = hasPermission(member, "inventory.reserve");
  const canApprove = hasPermission(member, "inventory.approve");
  const inventoryTourSteps = useMemo<GuidedTourStep[]>(() => {
    const steps: GuidedTourStep[] = [
      { target: "inventory-heading", title: isPartner ? "Your brand inventory" : "Inventory workspace", body: isPartner ? "This read-only dashboard is automatically limited to the brands and branches assigned to your representative account." : "Use this workspace to monitor stock and carry out the inventory actions allowed by your role and branch." },
      { target: "inventory-tab-overview", title: "Stock overview", body: isPartner ? "Review on-hand, reserved, and available quantities, low-stock items, branch/location balances, and recorded product sales." : "Review on-hand, reserved, and available quantities, inventory value, low-stock items, and balances by location." },
      { target: "inventory-tab-movements", title: "Movement ledger", body: isPartner ? "Review the receipt, transfer, issue, return, and adjustment history for your permitted brands." : "Record authorized receipts, issues, transfers, returns, and adjustments. Batch or serial details appear when the selected item requires them." },
    ];
    if (!isPartner) steps.push({ target: "inventory-tab-traceability", title: "Traceability", body: "Scan or search the batch/lot and serial registers to locate controlled stock and review its status." });
    if (canProcure) steps.push({ target: "inventory-tab-procurement", title: "Procurement", body: "Manage suppliers, submit multi-line purchase orders for approval, and receive approved orders fully or partially." });
    if (canCount) steps.push({ target: "inventory-tab-counts", title: "Stock counts", body: "Submit physical counts for approval and post approved variances without reducing stock below existing reservations." });
    if (canReserve) steps.push({ target: "inventory-tab-reservations", title: "Reservations", body: "Hold available stock for a deal, project, or work order, then release it or fulfill it as an inventory issue." });
    if (canApprove) steps.push({ target: "inventory-tab-approvals", title: "Approval queue", body: "Approve or reject purchase orders and stock counts created by another user. Creators cannot approve their own submissions." });
    steps.push(
      { target: "inventory-tab-comments", title: "Report collaboration", body: "Post comments against a brand and reporting period. Brand partners can collaborate here without changing stock." },
      { target: "inventory-export", title: "Export the report", body: "Download the inventory data you are permitted to see as a CSV file for analysis or sharing." },
    );
    if (canSetup) steps.push({ target: "inventory-tab-setup", title: "Inventory setup", body: "Create brands and stock locations here. Configure each product's barcode and traceability mode in Products/Services." });
    return steps;
  }, [canApprove, canCount, canProcure, canReserve, canSetup, isPartner]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBrands, nextItems, nextBalances, nextMovements, nextComments, nextLocations] = await Promise.all([
        listInventoryBrands(activeOrganizationId, member),
        listInventoryItems(activeOrganizationId, member),
        listInventoryBalances(activeOrganizationId, member),
        listInventoryMovements(activeOrganizationId, member),
        listInventoryComments(activeOrganizationId, member),
        isPartner ? Promise.resolve([]) : listInventoryLocations(activeOrganizationId, member),
      ]);
      setBrands(nextBrands);
      setItems(nextItems.filter((item) => Boolean(item.brandId)));
      setBalances(nextBalances);
      setMovements(nextMovements);
      setComments(nextComments);
      setLocations(nextLocations);
      setCommentForm((value) => ({ ...value, brandId: value.brandId || nextBrands[0]?.id || "" }));
      setMovement((value) => ({ ...value, offeringId: value.offeringId || nextItems.find((item) => item.brandId)?.id || "" }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, isPartner, member]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const itemTotals = useMemo(() => items.map((item) => ({
    ...item,
    quantity: balances.filter((balance) => balance.offeringId === item.id).reduce((sum, balance) => sum + Number(balance.quantityOnHand || 0), 0),
    reserved: balances.filter((balance) => balance.offeringId === item.id).reduce((sum, balance) => sum + Number(balance.quantityReserved || 0), 0),
  })), [balances, items]);
  const totalUnits = itemTotals.reduce((sum, item) => sum + item.quantity, 0);
  const inventoryValue = itemTotals.reduce((sum, item) => sum + item.quantity * Number(item.costPrice ?? 0), 0);
  const lowStock = itemTotals.filter((item) => item.reorderLevel !== undefined && item.quantity - item.reserved <= Number(item.reorderLevel)).length;
  const needsFrom = ["issue", "adjustmentOut", "transfer", "returnOut"].includes(movement.movementType);
  const needsTo = ["receipt", "adjustmentIn", "transfer", "returnIn"].includes(movement.movementType);
  const selectedMovementItem = items.find((item) => item.id === movement.offeringId);
  const salesMovements = movements.filter((entry) => entry.movementType === "issue" && entry.movementPurpose === "sale");
  const unitsSold = salesMovements.reduce((sum, entry) => sum + Number(entry.quantity), 0);

  async function submitMovement(event: React.FormEvent) {
    event.preventDefault();
    setSaving("movement");
    try {
      const result = await recordInventoryMovement({ ...movement, organizationId: activeOrganizationId, branchId: activeBranchId });
      toast({ title: "Stock movement recorded", description: result.referenceNumber, variant: "success" });
      setMovement((value) => ({ ...value, quantity: 1, externalReference: "", notes: "" }));
      await load();
    } catch (nextError) {
      toast({ title: "Unable to record movement", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
    } finally { setSaving(null); }
  }

  async function submitBrand(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving("brand");
    try {
      await createInventoryBrand({ ...brandForm, status: "active" }, { organizationId: activeOrganizationId, branchId: activeBranchId, userId: user.uid, userEmail: member?.email, userName: member?.displayName });
      setBrandForm({ name: "", code: "", description: "", contactName: "", contactEmail: "" });
      toast({ title: "Brand created", variant: "success" });
      await load();
    } catch (nextError) { toast({ title: "Unable to create brand", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" }); }
    finally { setSaving(null); }
  }

  async function submitLocation(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving("location");
    try {
      await createInventoryLocation({ ...locationForm, status: "active" }, { organizationId: activeOrganizationId, branchId: activeBranchId, userId: user.uid, userEmail: member?.email, userName: member?.displayName });
      setLocationForm({ name: "", code: "", address: "", locationType: "warehouse" });
      toast({ title: "Location created", variant: "success" });
      await load();
    } catch (nextError) { toast({ title: "Unable to create location", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" }); }
    finally { setSaving(null); }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !commentForm.brandId || !commentForm.message.trim()) return;
    setSaving("comment");
    try {
      await addInventoryComment({ ...commentForm, organizationId: activeOrganizationId, branchId: isPartner ? member?.partnerBranchIds?.[0] ?? member?.branchId ?? activeBranchId : activeBranchId, userId: user.uid, userEmail: member?.email, userName: member?.displayName });
      setCommentForm((value) => ({ ...value, message: "" }));
      toast({ title: "Comment posted", variant: "success" });
      await load();
    } catch (nextError) { toast({ title: "Unable to post comment", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" }); }
    finally { setSaving(null); }
  }

  function downloadReport() {
    const header = ["Brand", "SKU", "Barcode", "Item", "Location", "On hand", "Reserved", "Available", "Reorder level", "Unit cost", "Stock value"];
    const rows = balances.map((balance) => {
      const item = items.find((entry) => entry.id === balance.offeringId);
      const reserved = Number(balance.quantityReserved ?? 0);
      return [balance.brandName, balance.sku, item?.barcode ?? "", balance.offeringName, balance.locationName, balance.quantityOnHand, reserved, Number(balance.quantityOnHand) - reserved, item?.reorderLevel ?? "", item?.costPrice ?? 0, Number(balance.quantityOnHand) * Number(item?.costPrice ?? 0)];
    });
    const blob = new Blob([[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!hasPermission(member, "inventory.read")) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading inventory" />;

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none" data-tour="inventory-heading">
        <div><h1 className="text-xl font-semibold md:text-2xl">Inventory</h1><p className="mt-1 text-sm text-muted-foreground">{isPartner ? "Your read-only brand inventory report and collaboration space." : "Stock balances, movements, locations, brands, valuation, and partner reporting."}</p></div>
        <div className="mt-4 flex flex-wrap gap-2 md:mt-0"><GuidedTour autoStart storageKey={`vlingo-tour:inventory-enterprise-v1:${isPartner ? "partner" : "internal"}`} steps={inventoryTourSteps} /><Button data-tour="inventory-export" onClick={downloadReport} variant="outline"><Download className="h-4 w-4" />Export CSV</Button><Button onClick={load} variant="outline"><RefreshCw className="h-4 w-4" />Refresh</Button></div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="flex gap-2 overflow-x-auto pb-1">{(["overview", "movements", ...(!isPartner ? ["traceability"] : []), ...(canProcure ? ["procurement"] : []), ...(canCount ? ["counts"] : []), ...(canReserve ? ["reservations"] : []), ...(canApprove ? ["approvals"] : []), "comments", ...(canSetup ? ["setup"] : [])] as Tab[]).map((value) => <Button data-tour={`inventory-tab-${value}`} key={value} onClick={() => setTab(value)} variant={tab === value ? "primary" : "outline"}>{titleCase(value)}</Button>)}</div>

      {tab === "overview" ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Units on hand</p><p className="mt-2 text-2xl font-bold">{totalUnits.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Inventory value</p><p className="mt-2 text-2xl font-bold">{formatCurrency(inventoryValue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Tracked items</p><p className="mt-2 text-2xl font-bold">{itemTotals.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Low stock items</p><p className="mt-2 text-2xl font-bold text-warning">{lowStock}</p></CardContent></Card>
          {isPartner ? <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Units sold</p><p className="mt-2 text-2xl font-bold">{unitsSold.toLocaleString()}</p><p className="text-xs text-muted-foreground">Recorded sale issues</p></CardContent></Card> : null}
        </div>
        <Card><CardHeader><CardTitle>Stock by item</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[840px] text-left text-sm"><thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Brand / item</th><th className="px-4 py-3">SKU / barcode</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Reserved</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reorder</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{itemTotals.map((item) => { const available = item.quantity - item.reserved; const low = item.reorderLevel !== undefined && available <= Number(item.reorderLevel); return <tr className="border-t" key={item.id}><td className="px-4 py-3"><div className="font-semibold">{item.name}</div><div className="text-xs text-muted-foreground">{item.brandName} · {titleCase(item.trackingMode ?? "none")}</div></td><td className="px-4 py-3"><div>{item.sku || "—"}</div><div className="text-xs text-muted-foreground">{item.barcode}</div></td><td className="px-4 py-3 font-semibold">{item.quantity}</td><td className="px-4 py-3">{item.reserved}</td><td className="px-4 py-3 font-semibold">{available}</td><td className="px-4 py-3">{item.reorderLevel ?? "—"}</td><td className="px-4 py-3">{formatCurrency(item.quantity * Number(item.costPrice ?? 0))}</td><td className="px-4 py-3"><Badge tone={low ? "warning" : "success"}>{low ? "Low stock" : "Healthy"}</Badge></td></tr>; })}{!itemTotals.length ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>No branded inventory items are available yet.</td></tr> : null}</tbody></table></CardContent></Card>
        <Card><CardHeader><CardTitle>Balances by location</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{balances.map((balance) => <div className="rounded-md border p-3" key={balance.id}><div className="flex justify-between gap-3"><div><p className="font-semibold">{balance.offeringName}</p><p className="text-xs text-muted-foreground">{balance.brandName} · {balance.locationName}</p></div><p className="text-xl font-bold">{balance.quantityOnHand}</p></div></div>)}</CardContent></Card>
        {isPartner ? <Card><CardHeader><CardTitle>Recorded product sales across assigned branches</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Sale reference</th><th className="px-4 py-3">Qty</th></tr></thead><tbody>{salesMovements.map((entry) => <tr className="border-t" key={entry.id}><td className="px-4 py-3">{formatDate(entry.occurredAt)}</td><td className="px-4 py-3"><div className="font-semibold">{entry.offeringName}</div><div className="text-xs text-muted-foreground">{entry.brandName}</div></td><td className="px-4 py-3">{entry.branchId}</td><td className="px-4 py-3">{entry.fromLocationName || "—"}</td><td className="px-4 py-3">{entry.externalReference || entry.referenceNumber}</td><td className="px-4 py-3 font-semibold">{entry.quantity}</td></tr>)}{!salesMovements.length ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No product sales have been recorded for the selected brands and branches yet.</td></tr> : null}</tbody></table></CardContent></Card> : null}
      </> : null}

      {tab === "movements" ? <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {canMoveStock ? <Card><CardHeader><CardTitle>Record stock movement</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={submitMovement}><Field label="Scan item"><BarcodeScanner onScan={(code) => { const item = items.find((entry) => [entry.barcode, entry.sku].some((value) => String(value ?? "").toLowerCase() === code.toLowerCase())); if (item) setMovement((value) => ({ ...value, offeringId: item.id })); else toast({ title: "Barcode not found", description: code, variant: "error" }); }} /></Field><Field label="Movement type"><Select value={movement.movementType} onChange={(event) => setMovement((value) => ({ ...value, movementType: event.target.value as InventoryMovementType, movementPurpose: event.target.value === "issue" ? value.movementPurpose : "other" }))}>{movementTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</Select></Field>{movement.movementType === "issue" ? <Field label="Issue purpose"><Select value={movement.movementPurpose} onChange={(event) => setMovement((value) => ({ ...value, movementPurpose: event.target.value as InventoryMovementPurpose }))}>{["sale", "project", "internalUse", "other"].map((purpose) => <option key={purpose} value={purpose}>{titleCase(purpose)}</option>)}</Select></Field> : null}<Field label="Item"><Select required value={movement.offeringId} onChange={(event) => setMovement((value) => ({ ...value, offeringId: event.target.value, batchNumber: "", serialNumbers: [] }))}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.brandName} · {item.name}</option>)}</Select></Field><Field label="Quantity"><Input min={1} required type="number" value={movement.quantity} onChange={(event) => setMovement((value) => ({ ...value, quantity: Number(event.target.value) }))} /></Field>{needsFrom ? <Field label="Source location"><Select required value={movement.fromLocationId} onChange={(event) => setMovement((value) => ({ ...value, fromLocationId: event.target.value }))}><option value="">Select source</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field> : null}{needsTo ? <Field label="Destination location"><Select required value={movement.toLocationId} onChange={(event) => setMovement((value) => ({ ...value, toLocationId: event.target.value }))}><option value="">Select destination</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field> : null}{selectedMovementItem?.trackingMode === "batch" ? <><Field label="Batch number"><Input required value={movement.batchNumber} onChange={(event) => setMovement((value) => ({ ...value, batchNumber: event.target.value }))} /></Field>{needsTo ? <Field label="Expiry date"><Input type="date" value={movement.expiryDate} onChange={(event) => setMovement((value) => ({ ...value, expiryDate: event.target.value }))} /></Field> : null}</> : null}{selectedMovementItem?.trackingMode === "serial" ? <Field label="Serial numbers (one per line)"><Textarea required value={movement.serialNumbers.join("\n")} onChange={(event) => setMovement((value) => ({ ...value, serialNumbers: event.target.value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean) }))} /></Field> : null}<Field label="Movement date"><Input type="date" value={movement.occurredAt} onChange={(event) => setMovement((value) => ({ ...value, occurredAt: event.target.value }))} /></Field><Field label={movement.movementPurpose === "sale" ? "Deal, invoice, or sale reference" : "Supplier, PO, job or sale reference"}><Input required={movement.movementPurpose === "sale"} value={movement.externalReference} onChange={(event) => setMovement((value) => ({ ...value, externalReference: event.target.value }))} /></Field><Field label="Notes"><Textarea value={movement.notes} onChange={(event) => setMovement((value) => ({ ...value, notes: event.target.value }))} /></Field><Button disabled={saving === "movement"} type="submit"><PackageCheck className="h-4 w-4" />{saving === "movement" ? "Recording" : "Record movement"}</Button></form></CardContent></Card> : null}
        <Card className={canMoveStock ? "" : "xl:col-span-2"}><CardHeader><CardTitle>Movement ledger</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/70 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Qty</th></tr></thead><tbody>{movements.map((entry) => <tr className="border-t" key={entry.id}><td className="px-4 py-3">{formatDate(entry.occurredAt)}</td><td className="px-4 py-3"><div className="font-medium">{entry.referenceNumber}</div><div className="text-xs text-muted-foreground">{entry.externalReference}</div></td><td className="px-4 py-3"><div>{entry.offeringName}</div><div className="text-xs text-muted-foreground">{entry.brandName}</div></td><td className="px-4 py-3"><Badge tone="info">{titleCase(entry.movementType)}</Badge></td><td className="px-4 py-3">{[entry.fromLocationName, entry.toLocationName].filter(Boolean).join(" → ") || "—"}</td><td className="px-4 py-3 font-semibold">{entry.quantity}</td></tr>)}</tbody></table></CardContent></Card>
      </div> : null}

      {["procurement", "counts", "reservations", "traceability", "approvals"].includes(tab) ? <InventoryEnterprisePanel balances={balances} items={items} locations={locations} member={member} mode={tab as InventoryEnterpriseMode} onChanged={load} /> : null}

      {tab === "comments" ? <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>Comment on a report</CardTitle></CardHeader><CardContent><form className="grid gap-3" onSubmit={submitComment}><Field label="Brand"><Select required value={commentForm.brandId} onChange={(event) => setCommentForm((value) => ({ ...value, brandId: event.target.value }))}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</Select></Field><Field label="Report period"><Input type="month" value={commentForm.reportPeriod} onChange={(event) => setCommentForm((value) => ({ ...value, reportPeriod: event.target.value }))} /></Field><Field label="Comment"><Textarea required value={commentForm.message} onChange={(event) => setCommentForm((value) => ({ ...value, message: event.target.value }))} /></Field><Button disabled={saving === "comment"} type="submit"><Send className="h-4 w-4" />Post comment</Button></form></CardContent></Card><div className="grid content-start gap-3">{comments.map((comment) => <Card key={comment.id}><CardContent className="p-4"><div className="flex items-start gap-3"><MessageSquare className="mt-0.5 h-4 w-4 text-primary" /><div><p className="whitespace-pre-wrap text-sm">{comment.message}</p><p className="mt-2 text-xs text-muted-foreground">{brands.find((brand) => brand.id === comment.brandId)?.name ?? "Brand"} · {comment.reportPeriod || "General"} · {comment.createdByName || comment.createdByEmail} · {formatDate(comment.createdAt)}</p></div></div></CardContent></Card>)}{!comments.length ? <Card><CardContent className="p-8 text-center text-muted-foreground">No report comments yet.</CardContent></Card> : null}</div></div> : null}

      {tab === "setup" && canSetup ? <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Brands</CardTitle></CardHeader><CardContent className="grid gap-4"><form className="grid gap-3" onSubmit={submitBrand}><Field label="Brand name"><Input required value={brandForm.name} onChange={(event) => setBrandForm((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Brand code"><Input required value={brandForm.code} onChange={(event) => setBrandForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} /></Field><Field label="Partner contact name"><Input value={brandForm.contactName} onChange={(event) => setBrandForm((value) => ({ ...value, contactName: event.target.value }))} /></Field><Field label="Partner contact email"><Input type="email" value={brandForm.contactEmail} onChange={(event) => setBrandForm((value) => ({ ...value, contactEmail: event.target.value }))} /></Field><Field label="Description"><Textarea value={brandForm.description} onChange={(event) => setBrandForm((value) => ({ ...value, description: event.target.value }))} /></Field><Button disabled={saving === "brand"} type="submit"><Plus className="h-4 w-4" />Create brand</Button></form><div className="grid gap-2">{brands.map((brand) => <div className="flex items-center justify-between rounded-md border p-3" key={brand.id}><div><p className="font-semibold">{brand.name}</p><p className="text-xs text-muted-foreground">{brand.code} · {brand.contactEmail || "No partner contact"}</p></div><Badge tone="success">{brand.status}</Badge></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Stock locations</CardTitle></CardHeader><CardContent className="grid gap-4"><form className="grid gap-3" onSubmit={submitLocation}><Field label="Location name"><Input required value={locationForm.name} onChange={(event) => setLocationForm((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Location code"><Input required value={locationForm.code} onChange={(event) => setLocationForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} /></Field><Field label="Type"><Select value={locationForm.locationType} onChange={(event) => setLocationForm((value) => ({ ...value, locationType: event.target.value as InventoryLocation["locationType"] }))}>{["warehouse", "store", "site", "vehicle", "other"].map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}</Select></Field><Field label="Address"><Textarea value={locationForm.address} onChange={(event) => setLocationForm((value) => ({ ...value, address: event.target.value }))} /></Field><Button disabled={saving === "location"} type="submit"><Warehouse className="h-4 w-4" />Create location</Button></form><div className="grid gap-2">{locations.map((location) => <div className="flex items-center justify-between rounded-md border p-3" key={location.id}><div><p className="font-semibold">{location.name}</p><p className="text-xs text-muted-foreground">{location.code} · {titleCase(location.locationType)}</p></div><Badge tone="info">{location.status}</Badge></div>)}</div></CardContent></Card></div> : null}
    </section>
  );
}
