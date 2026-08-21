"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, PackageCheck, ShoppingCart, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { effectiveBranchId, hasAnyPermission, hasPermission, memberRoles } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { getDashboardMetrics, type DashboardMetrics } from "@/services/dashboard";
import { listInventoryBalances, listInventoryItems, listInventoryMovements } from "@/services/inventory";
import { listPosSales } from "@/services/pos";
import type { InventoryBalance, InventoryMovement, Offering, PosSale } from "@/types/crm";

export default function DashboardPage() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const [crm, setCrm] = useState<DashboardMetrics | null>(null);
  const [items, setItems] = useState<Offering[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewCrm = hasAnyPermission(member, ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll"]);
  const canViewInventory = hasPermission(member, "inventory.read");
  const canViewPos = hasPermission(member, "pos.read");
  const isPartner = memberRoles(member).includes("brandPartner");

  useEffect(() => {
    if (!canViewCrm && !canViewInventory) return;
    let mounted = true;
    const assignedTo = user && !hasPermission(member, "leads.readAll") ? user.uid : undefined;
    const branchId = effectiveBranchId(member, activeBranchId);
    const crmRequest = canViewCrm ? getDashboardMetrics(activeOrganizationId, { assignedTo, branchId }) : Promise.resolve(null);
    const inventoryRequest = canViewInventory ? Promise.all([
      listInventoryItems(activeOrganizationId, member),
      listInventoryBalances(activeOrganizationId, member),
      listInventoryMovements(activeOrganizationId, member),
    ]) : Promise.resolve([[], [], []] as [Offering[], InventoryBalance[], InventoryMovement[]]);
    const salesRequest = canViewPos ? listPosSales(activeOrganizationId, member) : Promise.resolve([]);
    Promise.all([crmRequest, inventoryRequest, salesRequest])
      .then(([nextCrm, [nextItems, nextBalances, nextMovements], nextSales]) => {
        if (!mounted) return;
        const partner = memberRoles(member).includes("brandPartner");
        setCrm(nextCrm);
        setItems(nextItems);
        setBalances(partner ? nextBalances : nextBalances.filter((balance) => balance.branchId === activeBranchId));
        setMovements(partner ? nextMovements : nextMovements.filter((movement) => [movement.branchId, movement.fromBranchId, movement.toBranchId].includes(activeBranchId)).slice(0, 8));
        setSales(partner ? [] : nextSales.filter((sale) => sale.branchId === activeBranchId));
      })
      .catch((nextError) => mounted && setError(nextError instanceof Error ? nextError.message : "Unable to load dashboard."))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [activeBranchId, activeOrganizationId, canViewCrm, canViewInventory, canViewPos, member, user]);

  const inventory = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const unitsOnHand = balances.reduce((sum, balance) => sum + Number(balance.quantityOnHand ?? 0), 0);
    const reserved = balances.reduce((sum, balance) => sum + Number(balance.quantityReserved ?? 0), 0);
    const value = balances.reduce((sum, balance) => sum + Number(balance.quantityOnHand ?? 0) * Number(itemMap.get(balance.offeringId)?.costPrice ?? 0), 0);
    const grouped = new Map<string, { brand: string; units: number; value: number }>();
    balances.forEach((balance) => {
      const current = grouped.get(balance.brandId) ?? { brand: balance.brandName || "Unbranded", units: 0, value: 0 };
      current.units += Number(balance.quantityOnHand ?? 0);
      current.value += Number(balance.quantityOnHand ?? 0) * Number(itemMap.get(balance.offeringId)?.costPrice ?? 0);
      grouped.set(balance.brandId, current);
    });
    const lowStockIds = new Set(balances.filter((balance) => {
      const available = Number(balance.quantityOnHand ?? 0) - Number(balance.quantityReserved ?? 0);
      const reorder = itemMap.get(balance.offeringId)?.reorderLevel;
      return reorder !== undefined && available <= Number(reorder);
    }).map((balance) => balance.offeringId));
    return { unitsOnHand, reserved, available: unitsOnHand - reserved, value, lowStock: lowStockIds.size, brands: [...grouped.values()].sort((a, b) => b.value - a.value).slice(0, 8) };
  }, [balances, items]);
  const completedSales = sales.filter((sale) => sale.saleStatus === "completed");
  const soldUnits = movements.filter((movement) => movement.movementType === "issue" && movement.movementPurpose === "sale").reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const firstName = String(member?.displayName ?? user?.displayName ?? user?.email ?? "there").trim().split(/\s+/)[0] || "there";

  if (!canViewCrm && !canViewInventory) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading operational dashboard" />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="grid min-w-0 gap-5 md:gap-6">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div><p className="text-sm font-medium text-primary">Operations control</p><h1 className="mt-1 text-xl font-semibold md:text-2xl">Welcome, {firstName}</h1><p className="mt-1 text-sm text-muted-foreground">Inventory-first snapshot for {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.</p></div>
        <div className="mt-4 flex flex-wrap gap-2 md:mt-0">{canViewPos && hasPermission(member, "pos.sell") ? <ButtonLink href="/pos"><ShoppingCart className="h-4 w-4" />New sale</ButtonLink> : null}{canViewInventory ? <ButtonLink href="/inventory" variant="outline"><Warehouse className="h-4 w-4" />Open inventory</ButtonLink> : null}</div>
      </div>

      {canViewInventory ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { icon: Boxes, label: "Units on hand", value: inventory.unitsOnHand.toLocaleString() },
            { icon: PackageCheck, label: "Available", value: inventory.available.toLocaleString() },
            { icon: Warehouse, label: "Reserved", value: inventory.reserved.toLocaleString() },
            { icon: AlertTriangle, label: "Low-stock items", value: inventory.lowStock.toLocaleString() },
            { icon: ArrowUpFromLine, label: "Units sold", value: soldUnits.toLocaleString() },
            { icon: ShoppingCart, label: "Inventory value", value: formatCurrency(inventory.value) },
          ].map(({ icon: Icon, label, value }) => <Card key={label}><CardContent className="p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card><CardHeader><CardTitle>Stock by brand</CardTitle></CardHeader><CardContent>{inventory.brands.length ? <ResponsiveContainer height={300} width="100%"><BarChart data={inventory.brands}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="brand" /><YAxis allowDecimals={false} /><Tooltip formatter={(value, name) => name === "value" ? formatCurrency(Number(value ?? 0)) : Number(value ?? 0).toLocaleString()} /><Bar dataKey="units" fill="#14550f" name="Units" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-72 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No branch inventory has been recorded.</div>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Recent stock activity</CardTitle></CardHeader><CardContent className="grid gap-2">{movements.slice(0, 7).map((movement) => <Link className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted" href="/inventory" key={movement.id}><span className="flex min-w-0 items-center gap-3">{["receipt", "adjustmentIn", "returnIn"].includes(movement.movementType) ? <ArrowDownToLine className="h-4 w-4 shrink-0 text-primary" /> : <ArrowUpFromLine className="h-4 w-4 shrink-0 text-amber-700" />}<span className="min-w-0"><strong className="block truncate text-sm">{movement.offeringName}</strong><span className="text-xs text-muted-foreground">{formatDate(movement.occurredAt)} · {movement.referenceNumber}</span></span></span><span className="shrink-0 text-right"><strong className="block">{movement.quantity}</strong><Badge tone="muted">{titleCase(movement.movementType)}</Badge></span></Link>)}{!movements.length ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No stock movements yet.</div> : null}</CardContent></Card>
        </div>
      </> : null}

      {canViewPos ? <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Sales performance</CardTitle><ButtonLink href="/pos" size="sm" variant="outline">View POS</ButtonLink></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Completed sales</p><p className="mt-1 text-2xl font-semibold">{completedSales.length}</p></div><div><p className="text-sm text-muted-foreground">Sales value</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(completedSales.reduce((sum, sale) => sum + sale.totalAmount, 0))}</p></div><div><p className="text-sm text-muted-foreground">Outstanding invoices</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(completedSales.reduce((sum, sale) => sum + sale.balanceDue, 0))}</p></div></CardContent></Card> : null}

      {canViewCrm && crm && !isPartner ? <Card><CardHeader><CardTitle>CRM pipeline</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Total leads", value: crm.totalLeads }, { label: "Qualified leads", value: crm.qualifiedLeads }, { label: "Active deals", value: crm.activeDeals }, { label: "Pipeline value", value: formatCurrency(crm.pipelineValue) }].map((metric) => <div className="rounded-md border p-4" key={metric.label}><p className="text-sm text-muted-foreground">{metric.label}</p><p className="mt-1 text-xl font-semibold">{metric.value}</p></div>)}</CardContent></Card> : null}
    </section>
  );
}
