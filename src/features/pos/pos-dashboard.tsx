"use client";

import Link from "next/link";
import { Banknote, Ban, FileText, Minus, Pencil, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { useAuth } from "@/features/auth/auth-provider";
import { branchInventoryCatalog } from "@/features/inventory/inventory-catalog-scope";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { listInventoryBalances, listInventoryItems } from "@/services/inventory";
import { adjustPosSale, createPosSale, listPosSales, recordPosSalePayment, searchPosCustomers, voidPosSale, type PosCustomerSearchResult } from "@/services/pos";
import type { InventoryBalance, Offering, PosDocumentBrand, PosSale, RentalPaymentMethod } from "@/types/crm";

type CartLine = { offeringId: string; quantity: number; unitPrice: number; discountAmount: number };
type SaleAdjustmentDraft = {
  saleId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  notes: string;
  reason: string;
  taxRate: number;
  lines: Array<{ offeringId: string; offeringName: string; quantity: number; unitPrice: number; discountAmount: number }>;
};
const paymentMethods: Array<{ value: RentalPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "pos", label: "Card / POS terminal" },
  { value: "bankTransfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "onlinePayment", label: "Online payment" },
  { value: "other", label: "Other" },
];
const posTourSteps: GuidedTourStep[] = [
  { target: "pos-products", title: "Choose products", body: "Search the active branch's available stock by product, SKU, barcode, or brand, then add products to the cart." },
  { target: "pos-cart", title: "Build the sale", body: "Confirm quantities, apply any line discount and tax, and review the total. Reserved stock is excluded automatically." },
  { target: "pos-document-brand", title: "Choose the document brand", body: "Select Vlingo Systems or Kada Builders Mart. The choice controls the invoice and every receipt created for this sale." },
  { target: "pos-payment", title: "Receive payment", body: "Enter nothing for an unpaid invoice, or record a full or partial payment and its method. A receipt is created whenever money is received." },
  { target: "pos-history", title: "Invoices and receipts", body: "Use Sales history to print documents and collect outstanding invoice balances later." },
];
const documentBrandOptions: Array<{ value: PosDocumentBrand; label: string }> = [
  { value: "vlingoSystems", label: "Vlingo Systems" },
  { value: "kadaBuildersMart", label: "Kada Builders Mart" },
];

function documentBrandLabel(value: PosDocumentBrand | undefined) {
  return value === "kadaBuildersMart" ? "Kada Builders Mart" : "Vlingo Systems";
}

function paymentTone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "partPaid") return "warning" as const;
  return "danger" as const;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function PosDashboard() {
  const { activeBranchId, activeOrganizationId, member } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"checkout" | "sales">("checkout");
  const [mobileStep, setMobileStep] = useState<"products" | "customer" | "checkout">("products");
  const [items, setItems] = useState<Offering[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [customerMode, setCustomerMode] = useState<"walkIn" | "existing" | "new">("walkIn");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<PosCustomerSearchResult[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [saveNewCustomer, setSaveNewCustomer] = useState(true);
  const [payment, setPayment] = useState({ amountPaid: 0, method: "cash" as RentalPaymentMethod, reference: "", taxRate: 0 });
  const [documentBrand, setDocumentBrand] = useState<PosDocumentBrand>("vlingoSystems");
  const [paymentForm, setPaymentForm] = useState({ saleId: "", amount: 0, method: "cash" as RentalPaymentMethod, reference: "" });
  const [adjustmentForm, setAdjustmentForm] = useState<SaleAdjustmentDraft | null>(null);
  const [voidForm, setVoidForm] = useState({ saleId: "", reason: "" });
  const canSell = hasPermission(member, "pos.sell");
  const canManageSales = hasPermission(member, "pos.manageSales");
  const canReadCustomers = hasPermission(member, "clients.read");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextItems, nextBalances, nextSales] = await Promise.all([
        listInventoryItems(activeOrganizationId, member),
        listInventoryBalances(activeOrganizationId, member),
        listPosSales(activeOrganizationId, member),
      ]);
      const branchBalances = nextBalances.filter((balance) => balance.branchId === activeBranchId && balance.locationId === activeBranchId);
      setItems(branchInventoryCatalog(nextItems, branchBalances, activeBranchId).filter((item) => item.status === "active"));
      setBalances(branchBalances);
      setSales(nextSales.filter((sale) => sale.branchId === activeBranchId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load point of sale.");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, activeOrganizationId, member]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (customerMode !== "existing") return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setCustomerSearchLoading(true);
      void searchPosCustomers({ organizationId: activeOrganizationId, branchId: activeBranchId, search: customerSearch })
        .then((result) => { if (active) setCustomerResults(result.customers); })
        .catch((nextError) => {
          if (active) toast({ title: "Unable to search customers", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
        })
        .finally(() => { if (active) setCustomerSearchLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [activeBranchId, activeOrganizationId, customerMode, customerSearch, toast]);

  const stock = useMemo(() => new Map(items.map((item) => {
    const itemBalances = balances.filter((balance) => balance.offeringId === item.id);
    return [item.id, itemBalances.reduce((sum, balance) => sum + Number(balance.quantityOnHand ?? 0) - Number(balance.quantityReserved ?? 0), 0)];
  })), [balances, items]);
  const searchableItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter((item) => Number(stock.get(item.id) ?? 0) > 0)
      .filter((item) => item.trackingMode !== "batch")
      .filter((item) => !needle || [item.name, item.sku, item.barcode, item.brandName].some((value) => String(value ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, stock]);
  const cartDetails = useMemo(() => cart.flatMap((line) => {
    const item = items.find((entry) => entry.id === line.offeringId);
    if (!item) return [];
    const gross = line.unitPrice * line.quantity;
    return [{ ...line, item, gross, total: Math.max(0, gross - line.discountAmount), available: Number(stock.get(item.id) ?? 0) }];
  }), [cart, items, stock]);
  const subtotal = cartDetails.reduce((sum, line) => sum + line.gross, 0);
  const discount = cartDetails.reduce((sum, line) => sum + line.discountAmount, 0);
  const tax = (subtotal - discount) * Number(payment.taxRate || 0) / 100;
  const total = subtotal - discount + tax;
  const todaySales = sales.filter((sale) => new Date(String(sale.soldAt)).toDateString() === new Date().toDateString() && sale.saleStatus === "completed");

  function addToCart(offeringId: string) {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[offeringId];
      return next;
    });
    setCart((current) => {
      const existing = current.find((line) => line.offeringId === offeringId);
      const available = Number(stock.get(offeringId) ?? 0);
      if (existing) return current.map((line) => line.offeringId === offeringId ? { ...line, quantity: Math.min(available, line.quantity + 1) } : line);
      return [...current, { offeringId, quantity: 1, unitPrice: Number(items.find((item) => item.id === offeringId)?.sellingPrice ?? 0), discountAmount: 0 }];
    });
  }

  function updateCart(offeringId: string, changes: Partial<CartLine>) {
    setCart((current) => current.map((line) => line.offeringId === offeringId ? { ...line, ...changes } : line));
  }

  function stepQuantity(offeringId: string, quantity: number) {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[offeringId];
      return next;
    });
    updateCart(offeringId, { quantity });
  }

  function typeQuantity(offeringId: string, rawValue: string) {
    setQuantityDrafts((current) => ({ ...current, [offeringId]: rawValue }));
    if (/^\d+$/.test(rawValue) && Number(rawValue) > 0) {
      updateCart(offeringId, { quantity: Number(rawValue) });
    }
  }

  function finishQuantity(offeringId: string, available: number) {
    const rawValue = quantityDrafts[offeringId];
    if (rawValue === undefined) return;
    const typed = Number(rawValue);
    const quantity = Number.isInteger(typed) && typed > 0
      ? Math.min(typed, available)
      : 1;
    stepQuantity(offeringId, quantity);
  }

  function changeCustomerMode(mode: "walkIn" | "existing" | "new") {
    setCustomerMode(mode);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setCustomerResults([]);
    setCustomer((value) => ({ name: "", phone: "", email: "", address: "", notes: value.notes }));
  }

  function selectExistingCustomer(customerId: string) {
    setSelectedCustomerId(customerId);
    const selected = customerResults.find((entry) => entry.id === customerId);
    if (selected) {
      setCustomer((value) => ({
        ...value,
        name: selected.fullName,
        phone: selected.phoneNumber,
        email: selected.email ?? "",
        address: selected.address ?? "",
      }));
    }
  }

  async function submitSale(event: React.FormEvent) {
    event.preventDefault();
    if (!cart.length) return;
    if (cartDetails.some((line) => line.quantity <= 0 || line.quantity > line.available || line.discountAmount > line.gross)) {
      toast({ title: "Review the cart", description: "A quantity or discount is outside the allowed range.", variant: "error" });
      return;
    }
    if (customerMode === "existing" && !selectedCustomerId) {
      toast({ title: "Select a customer", description: "Choose a matching customer from the customer database.", variant: "error" });
      setMobileStep("customer");
      return;
    }
    if (customerMode === "new" && (customer.name.trim().length < 2 || customer.phone.replace(/\D/g, "").length < 7)) {
      toast({ title: "Customer details required", description: "Enter the new customer's name and valid phone number.", variant: "error" });
      setMobileStep("customer");
      return;
    }
    setSaving("sale");
    try {
      const result = await createPosSale({
        organizationId: activeOrganizationId,
        branchId: activeBranchId,
        customerSource: customerMode,
        customerId: selectedCustomerId || undefined,
        saveNewCustomer: customerMode === "new" && saveNewCustomer,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerAddress: customer.address,
        documentBrand,
        notes: customer.notes,
        lines: cart.map((line) => ({ offeringId: line.offeringId, quantity: line.quantity, unitPrice: line.unitPrice, discountAmount: line.discountAmount })),
        taxRate: Number(payment.taxRate || 0),
        amountPaid: Number(payment.amountPaid || 0),
        paymentMethod: payment.method,
        paymentReference: payment.reference,
        soldAt: new Date().toISOString(),
      });
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "", notes: "" });
      setCustomerMode("walkIn");
      setSelectedCustomerId("");
      setCustomerSearch("");
      setPayment({ amountPaid: 0, method: "cash", reference: "", taxRate: 0 });
      toast({ title: "Sale completed", description: `${result.invoiceNumber} created and inventory updated.`, variant: "success" });
      await load();
      window.location.assign(`/pos/sales/${result.saleId}/${result.receiptNumber ? "receipt" : "invoice"}`);
    } catch (nextError) {
      toast({ title: "Unable to complete sale", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    const sale = sales.find((entry) => entry.id === paymentForm.saleId);
    const amount = money(Number(paymentForm.amount));
    const balanceDue = money(Number(sale?.balanceDue ?? 0));
    if (!sale || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Unable to record payment", description: "Enter a positive payment amount.", variant: "error" });
      return;
    }
    if (amount > balanceDue) {
      toast({ title: "Unable to record payment", description: `Only ${formatCurrency(balanceDue)} remains due on this invoice.`, variant: "error" });
      return;
    }
    setSaving(`payment:${paymentForm.saleId}`);
    try {
      const result = await recordPosSalePayment({
        organizationId: activeOrganizationId,
        saleId: paymentForm.saleId,
        amount,
        paymentMethod: paymentForm.method,
        paymentReference: paymentForm.reference,
      });
      toast({ title: "Payment recorded", description: `${result.receiptNumber} created.`, variant: "success" });
      const saleId = paymentForm.saleId;
      setPaymentForm({ saleId: "", amount: 0, method: "cash", reference: "" });
      await load();
      window.location.assign(`/pos/sales/${saleId}/receipt`);
    } catch (nextError) {
      toast({ title: "Unable to record payment", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  function beginAdjustment(sale: PosSale) {
    setVoidForm({ saleId: "", reason: "" });
    setAdjustmentForm({
      saleId: sale.id,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone ?? "",
      customerEmail: sale.customerEmail ?? "",
      customerAddress: sale.customerAddress ?? "",
      notes: sale.notes ?? "",
      reason: "",
      taxRate: Number(sale.taxRate ?? 0),
      lines: sale.lines.map((line) => ({
        offeringId: line.offeringId,
        offeringName: line.offeringName,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountAmount: Number(line.discountAmount ?? 0),
      })),
    });
  }

  function updateAdjustmentLine(offeringId: string, changes: Partial<SaleAdjustmentDraft["lines"][number]>) {
    setAdjustmentForm((current) => current ? {
      ...current,
      lines: current.lines.map((line) => line.offeringId === offeringId ? { ...line, ...changes } : line),
    } : current);
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!adjustmentForm || adjustmentForm.reason.trim().length < 5) {
      toast({ title: "Reason required", description: "Explain the correction in at least 5 characters.", variant: "error" });
      return;
    }
    if (adjustmentForm.lines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0 || line.unitPrice < 0 || line.discountAmount < 0 || line.discountAmount > line.quantity * line.unitPrice)) {
      toast({ title: "Review the adjustment", description: "Quantities, prices, or discounts are invalid.", variant: "error" });
      return;
    }
    setSaving(`adjust:${adjustmentForm.saleId}`);
    try {
      const result = await adjustPosSale({
        organizationId: activeOrganizationId,
        saleId: adjustmentForm.saleId,
        reason: adjustmentForm.reason,
        customerName: adjustmentForm.customerName,
        customerPhone: adjustmentForm.customerPhone,
        customerEmail: adjustmentForm.customerEmail,
        customerAddress: adjustmentForm.customerAddress,
        notes: adjustmentForm.notes,
        taxRate: adjustmentForm.taxRate,
        lines: adjustmentForm.lines.map(({ offeringId, quantity, unitPrice, discountAmount }) => ({ offeringId, quantity, unitPrice, discountAmount })),
      });
      toast({ title: "Sale adjusted", description: `Revision ${result.revision} saved. Inventory and balance due were reconciled.`, variant: "success" });
      setAdjustmentForm(null);
      await load();
    } catch (nextError) {
      toast({ title: "Unable to adjust sale", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function submitVoid(event: React.FormEvent) {
    event.preventDefault();
    const sale = sales.find((entry) => entry.id === voidForm.saleId);
    if (!sale || voidForm.reason.trim().length < 5) {
      toast({ title: "Reason required", description: "Explain why the sale is being voided in at least 5 characters.", variant: "error" });
      return;
    }
    if (!window.confirm(`Void ${sale.invoiceNumber}? Stock will be restored and linked payments will be reversed. This cannot be undone.`)) return;
    setSaving(`void:${sale.id}`);
    try {
      await voidPosSale({ organizationId: activeOrganizationId, saleId: sale.id, reason: voidForm.reason });
      toast({ title: "Sale voided", description: `${sale.invoiceNumber} was retained for audit; its stock and finance effects were reversed.`, variant: "success" });
      setVoidForm({ saleId: "", reason: "" });
      await load();
    } catch (nextError) {
      toast({ title: "Unable to void sale", description: nextError instanceof Error ? nextError.message : "Try again.", variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  if (!hasPermission(member, "pos.read")) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading point of sale" />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <p className="text-sm font-medium text-primary">Sales desk</p>
          <h1 className="mt-1 text-2xl font-semibold">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sell from the active branch, update stock instantly, and issue numbered documents.</p>
        </div>
        <div className="mt-4 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:items-end">
          <GuidedTour storageKey="vlingo-tour:pos-v1" steps={posTourSteps} />
          <div className="grid w-full grid-cols-3 gap-2 text-center md:w-auto">
          <div className="min-w-0 rounded-md border bg-white px-2 py-2 sm:px-3"><p className="text-xs text-muted-foreground">Today</p><strong>{todaySales.length}</strong></div>
          <div className="min-w-0 rounded-md border bg-white px-2 py-2 sm:px-3"><p className="text-xs text-muted-foreground">Revenue</p><strong className="block truncate text-xs sm:text-sm">{formatCurrency(todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0))}</strong></div>
          <div className="min-w-0 rounded-md border bg-white px-2 py-2 sm:px-3"><p className="text-xs text-muted-foreground">Due</p><strong className="block truncate text-xs sm:text-sm">{formatCurrency(sales.reduce((sum, sale) => sum + sale.balanceDue, 0))}</strong></div></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button className="w-full sm:w-auto" onClick={() => setTab("checkout")} variant={tab === "checkout" ? "primary" : "outline"}><ShoppingCart className="h-4 w-4" />New sale</Button>
        <Button className="w-full sm:w-auto" data-tour="pos-history" onClick={() => setTab("sales")} variant={tab === "sales" ? "primary" : "outline"}><FileText className="h-4 w-4" />Sales history</Button>
      </div>

      {tab === "checkout" ? (
        canSell ? <form className="grid items-start gap-4 xl:grid-cols-[1fr_420px]" onSubmit={submitSale}>
          <nav aria-label="Sale steps" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 xl:hidden">
            {([
              ["products", "1. Products"],
              ["customer", "2. Customer"],
              ["checkout", `3. Pay (${cart.length})`],
            ] as const).map(([value, label]) => (
              <button
                aria-current={mobileStep === value ? "step" : undefined}
                className={`min-h-11 rounded-md px-2 py-2 text-xs font-semibold transition sm:text-sm ${mobileStep === value ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
                key={value}
                onClick={() => setMobileStep(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="contents xl:grid xl:gap-4">
            <div className={mobileStep === "products" ? "block" : "hidden xl:block"}>
            <Card data-tour="pos-products">
              <CardHeader><CardTitle>Find products</CardTitle></CardHeader>
              <CardContent>
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input autoFocus className="pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Search by product, SKU, barcode, or brand" value={search} /></div>
                <div className="mt-4 grid max-h-[52vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:max-h-[420px]">
                  {searchableItems.map((item) => (
                    <button className="flex min-h-16 items-center justify-between gap-3 rounded-md border p-3 text-left transition active:scale-[0.99] hover:border-primary hover:bg-primary/5" key={item.id} onClick={() => addToCart(item.id)} type="button">
                      <span className="min-w-0"><strong className="block text-sm">{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.brandName} · {item.sku || "No SKU"} · {stock.get(item.id)} available</span>{cart.find((line) => line.offeringId === item.id) ? <Badge className="mt-2" tone="success">{cart.find((line) => line.offeringId === item.id)?.quantity} in cart</Badge> : null}</span>
                      <span className="shrink-0 text-right text-sm font-semibold"><span className="block">{formatCurrency(item.sellingPrice)}</span>{item.wholesalePrice !== undefined ? <span className="block text-xs font-normal text-muted-foreground">Wholesale {formatCurrency(item.wholesalePrice)}</span> : null}<span className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></span></span>
                    </button>
                  ))}
                  {!searchableItems.length ? <div className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No saleable stock matches this search in the active branch.</div> : null}
                </div>
                <Button className="mt-4 w-full xl:hidden" disabled={!cart.length} onClick={() => setMobileStep("customer")} type="button">
                  Continue with {cart.length} product{cart.length === 1 ? "" : "s"}
                </Button>
              </CardContent>
            </Card>
            </div>
            <div className={mobileStep === "customer" ? "block" : "hidden xl:block"}>
            <Card>
              <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid grid-cols-3 gap-2 sm:col-span-2" role="group" aria-label="Customer type"><Button onClick={() => changeCustomerMode("walkIn")} type="button" variant={customerMode === "walkIn" ? "primary" : "outline"}>Walk-in</Button><Button onClick={() => changeCustomerMode("existing")} type="button" variant={customerMode === "existing" ? "primary" : "outline"}>Existing</Button><Button onClick={() => changeCustomerMode("new")} type="button" variant={customerMode === "new" ? "primary" : "outline"}>New</Button></div>
                {customerMode === "walkIn" ? <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground sm:col-span-2"><strong className="block text-foreground">Walk-in customer</strong>No customer record will be created or linked. Choose Existing for a repeat customer or New to save a reusable customer profile.</div> : null}
                {customerMode === "existing" ? <>
                  <Field className="sm:col-span-2" label="Search organization customers"><Input autoFocus onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, phone, email, or customer number" value={customerSearch} /><span className="text-xs text-muted-foreground">{customerSearchLoading ? "Searching…" : `${customerResults.length} matching customer${customerResults.length === 1 ? "" : "s"}`}</span></Field>
                  <Field className="sm:col-span-2" label="Select customer"><Select onChange={(event) => selectExistingCustomer(event.target.value)} value={selectedCustomerId}><option value="">Choose a matching customer</option>{customerResults.map((entry) => <option key={entry.id} value={entry.id}>{entry.fullName}{entry.companyName ? ` · ${entry.companyName}` : ""} · {entry.phoneNumber || "No phone"}{entry.referenceNumber ? ` · ${entry.referenceNumber}` : ""}</option>)}</Select></Field>
                  {selectedCustomerId ? <div className="grid gap-1 rounded-md border bg-primary/5 p-4 text-sm sm:col-span-2"><strong>{customer.name}</strong><span>{customer.phone || "No phone number"}</span>{customer.email ? <span>{customer.email}</span> : null}{customer.address ? <span>{customer.address}</span> : null}<span className="mt-1 text-xs text-muted-foreground">Linked to customer ID {selectedCustomerId}. Details are taken from the customer database to prevent mismatches.</span></div> : null}
                </> : null}
                {customerMode === "new" ? <>
                  <Field label="Customer name"><Input autoComplete="name" onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} required value={customer.name} /></Field>
                  <Field label="Phone"><Input autoComplete="tel" inputMode="tel" onChange={(event) => setCustomer((value) => ({ ...value, phone: event.target.value }))} required value={customer.phone} /></Field>
                  <Field label="Email"><Input autoComplete="email" inputMode="email" onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} type="email" value={customer.email} /></Field>
                  <Field label="Address"><Input onChange={(event) => setCustomer((value) => ({ ...value, address: event.target.value }))} value={customer.address} /></Field>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border bg-white px-3 text-sm sm:col-span-2"><input checked={saveNewCustomer} className="h-4 w-4 accent-primary" onChange={(event) => setSaveNewCustomer(event.target.checked)} type="checkbox" /><span><strong className="block">Save to customer database</strong><span className="text-xs text-muted-foreground">Recommended so future sales use the same verified details and customer history.</span></span></label>
                </> : null}
                <Field className="sm:col-span-2" label="Sale notes"><Textarea onChange={(event) => setCustomer((value) => ({ ...value, notes: event.target.value }))} value={customer.notes} /></Field>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:hidden"><Button onClick={() => setMobileStep("products")} type="button" variant="outline">Back</Button><Button onClick={() => setMobileStep("checkout")} type="button">Review sale</Button></div>
              </CardContent>
            </Card>
            </div>
          </div>

          <Card className={`${mobileStep === "checkout" ? "block" : "hidden xl:block"} xl:sticky xl:top-4`} data-tour="pos-cart">
            <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Current sale ({cart.length})</CardTitle><Button className="xl:hidden" onClick={() => setMobileStep("products")} size="sm" type="button" variant="ghost">Add items</Button></div></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid max-h-[400px] gap-3 overflow-y-auto">
                {cartDetails.map((line) => (
                  <div className="rounded-md border p-3" key={line.offeringId}>
                    <div className="flex justify-between gap-3"><div><strong className="text-sm">{line.item.name}</strong><p className="text-xs text-muted-foreground">Retail {formatCurrency(line.item.sellingPrice)}{line.item.wholesalePrice !== undefined ? ` · Wholesale ${formatCurrency(line.item.wholesalePrice)}` : ""} · {line.available} available</p></div><Button aria-label="Remove product" onClick={() => setCart((value) => value.filter((entry) => entry.offeringId !== line.offeringId))} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button></div>
                    <div className="mt-3 grid grid-cols-[48px_1fr_48px] items-center gap-2"><Button className="h-12 w-12" disabled={line.quantity <= 1} onClick={() => stepQuantity(line.offeringId, line.quantity - 1)} size="icon" type="button" variant="outline"><Minus className="h-4 w-4" /></Button><Input aria-label="Quantity" className="h-12 text-center text-base font-semibold" inputMode="numeric" max={line.available} min="1" onBlur={() => finishQuantity(line.offeringId, line.available)} onChange={(event) => typeQuantity(line.offeringId, event.target.value)} onFocus={(event) => event.currentTarget.select()} step="1" type="number" value={quantityDrafts[line.offeringId] ?? String(line.quantity)} /><Button className="h-12 w-12" disabled={line.quantity >= line.available} onClick={() => stepQuantity(line.offeringId, line.quantity + 1)} size="icon" type="button" variant="outline"><Plus className="h-4 w-4" /></Button></div>
                    <Field className="mt-3" label="Unit selling price">
                      <Input aria-label="Unit selling price" inputMode="decimal" min="0" onChange={(event) => updateCart(line.offeringId, { unitPrice: Math.max(0, Number(event.target.value)) })} onFocus={(event) => event.currentTarget.select()} step="0.01" type="number" value={line.unitPrice} />
                      <span className="flex flex-wrap gap-2 pt-1">
                        <Button onClick={() => updateCart(line.offeringId, { unitPrice: Number(line.item.sellingPrice ?? 0) })} size="sm" type="button" variant="outline">Use retail</Button>
                        {line.item.wholesalePrice !== undefined ? <Button onClick={() => updateCart(line.offeringId, { unitPrice: Number(line.item.wholesalePrice) })} size="sm" type="button" variant="outline">Use wholesale</Button> : null}
                      </span>
                    </Field>
                    <Field className="mt-3" label="Line discount"><Input max={line.gross} min="0" onChange={(event) => updateCart(line.offeringId, { discountAmount: Math.max(0, Number(event.target.value)) })} type="number" value={line.discountAmount} /></Field>
                    <p className="mt-3 text-right text-sm font-semibold">{formatCurrency(line.total)}</p>
                  </div>
                ))}
                {!cart.length ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Select products to begin a sale.</div> : null}
              </div>
              <div className="grid gap-2 border-y py-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>-{formatCurrency(discount)}</strong></div><div className="flex items-center justify-between gap-4"><span>Tax rate</span><Input className="w-24" max="100" min="0" onChange={(event) => setPayment((value) => ({ ...value, taxRate: Number(event.target.value) }))} type="number" value={payment.taxRate} /></div><div className="flex justify-between text-lg"><strong>Total</strong><strong>{formatCurrency(total)}</strong></div></div>
              <Field label="Invoice and receipt brand"><Select data-tour="pos-document-brand" onChange={(event) => setDocumentBrand(event.target.value as PosDocumentBrand)} value={documentBrand}>{documentBrandOptions.map((brand) => <option key={brand.value} value={brand.value}>{brand.label}</option>)}</Select></Field>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><strong className="block text-sm text-foreground">{documentBrandLabel(documentBrand)} documents</strong><span>The invoice and every receipt for this sale will use this brand’s logo, colours, numbering, and business wording.</span></div>
              <Field label="Amount received"><Input data-tour="pos-payment" max={money(total)} min="0" onChange={(event) => setPayment((value) => ({ ...value, amountPaid: Number(event.target.value) }))} step="0.01" type="number" value={payment.amountPaid} /></Field>
              {payment.amountPaid > 0 ? <><Field label="Payment method"><Select onChange={(event) => setPayment((value) => ({ ...value, method: event.target.value as RentalPaymentMethod }))} value={payment.method}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select></Field><Field label="Payment reference"><Input onChange={(event) => setPayment((value) => ({ ...value, reference: event.target.value }))} placeholder="Optional" value={payment.reference} /></Field></> : null}
              <div className="rounded-md bg-muted p-3 text-sm"><div className="flex justify-between"><span>Balance due</span><strong>{formatCurrency(Math.max(0, total - payment.amountPaid))}</strong></div><p className="mt-1 text-xs text-muted-foreground">Every sale generates an invoice. A receipt is generated for any payment received.</p></div>
              <Button className="h-12 w-full" disabled={!cart.length || saving === "sale"} type="submit"><Banknote className="h-5 w-5" />{saving === "sale" ? "Completing sale…" : `Complete sale · ${formatCurrency(total)}`}</Button>
            </CardContent>
          </Card>
        </form> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Your role can review sales but cannot process a checkout.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Sales history</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {sales.map((sale) => {
              const editing = adjustmentForm?.saleId === sale.id ? adjustmentForm : null;
              const revisedSubtotal = editing?.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) ?? 0;
              const revisedDiscount = editing?.lines.reduce((sum, line) => sum + line.discountAmount, 0) ?? 0;
              const revisedTotal = money(revisedSubtotal - revisedDiscount + (revisedSubtotal - revisedDiscount) * Number(editing?.taxRate ?? 0) / 100);
              return (
              <div className={`rounded-md border p-4 ${sale.saleStatus === "void" ? "border-red-200 bg-red-50/50" : ""}`} key={sale.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><strong>{sale.invoiceNumber}</strong>{sale.saleStatus === "void" ? <Badge tone="danger">Void</Badge> : <Badge tone={paymentTone(sale.paymentStatus)}>{titleCase(sale.paymentStatus)}</Badge>}<Badge tone="muted">{documentBrandLabel(sale.documentBrand)}</Badge>{sale.customerId ? <Badge tone="info">Linked customer</Badge> : null}{sale.revision ? <Badge tone="warning">Revision {sale.revision}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{sale.customerId && canReadCustomers ? <Link className="font-medium text-primary hover:underline" href={`/clients/${sale.customerId}`}>{sale.customerName}</Link> : sale.customerName} · {formatDate(sale.soldAt)} · {sale.lines.length} product line(s)</p>{sale.saleStatus === "void" && sale.voidReason ? <p className="mt-1 text-xs font-medium text-red-700">Void reason: {sale.voidReason}</p> : null}</div>
                  <div className="md:text-right"><strong className="text-lg">{formatCurrency(sale.totalAmount)}</strong><p className="text-xs text-muted-foreground">{formatCurrency(sale.balanceDue)} due</p></div>
                </div>
                {(sale.adjustmentHistory?.length ?? 0) > 0 ? <details className="mt-3 rounded-md bg-muted/60 p-3 text-xs"><summary className="cursor-pointer font-semibold">View adjustment history ({sale.adjustmentHistory?.length})</summary><div className="mt-2 grid gap-2">{sale.adjustmentHistory?.slice().reverse().map((entry) => <div className="flex flex-col gap-1 border-t pt-2 sm:flex-row sm:items-center sm:justify-between" key={`${entry.revision}-${String(entry.adjustedAt)}`}><span>Revision {entry.revision}: {entry.reason}</span><span className="text-muted-foreground">{formatCurrency(entry.previousTotal)} → {formatCurrency(entry.revisedTotal)} · {entry.adjustedByName || "Authorized user"} · {formatDate(entry.adjustedAt)}</span></div>)}</div></details> : null}
                <div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/invoice`}><FileText className="h-4 w-4" />Invoice</Link>{(sale.paymentHistory ?? []).map((entry, index) => <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/receipt/${encodeURIComponent(entry.receiptNumber)}`} key={entry.receiptNumber}><Printer className="h-4 w-4" />Receipt {index + 1}</Link>)}{sale.amountPaid > 0 && !sale.paymentHistory?.length ? <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/receipt`}><Printer className="h-4 w-4" />Receipt</Link> : null}{canSell && sale.saleStatus === "completed" && sale.balanceDue > 0 ? <Button onClick={() => setPaymentForm({ saleId: sale.id, amount: money(sale.balanceDue), method: "cash", reference: "" })} size="sm" type="button" variant="secondary">Record payment</Button> : null}{canManageSales && sale.saleStatus === "completed" ? <><Button onClick={() => beginAdjustment(sale)} size="sm" type="button" variant="outline"><Pencil className="h-4 w-4" />Adjust</Button><Button onClick={() => { setAdjustmentForm(null); setVoidForm({ saleId: sale.id, reason: "" }); }} size="sm" type="button" variant="danger"><Ban className="h-4 w-4" />Void</Button></> : null}</div>
                {paymentForm.saleId === sale.id ? <form className="mt-4 grid gap-3 rounded-md bg-muted p-4 sm:grid-cols-4" onSubmit={submitPayment}><Field label="Amount (part or full)"><Input max={money(sale.balanceDue)} min="0.01" onChange={(event) => setPaymentForm((value) => ({ ...value, amount: Number(event.target.value) }))} required step="0.01" type="number" value={paymentForm.amount} /><button className="mt-1 text-left text-xs font-medium text-primary hover:underline" onClick={() => setPaymentForm((value) => ({ ...value, amount: money(sale.balanceDue) }))} type="button">Use full balance: {formatCurrency(money(sale.balanceDue))}</button></Field><Field label="Method"><Select onChange={(event) => setPaymentForm((value) => ({ ...value, method: event.target.value as RentalPaymentMethod }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select></Field><Field label="Reference"><Input onChange={(event) => setPaymentForm((value) => ({ ...value, reference: event.target.value }))} value={paymentForm.reference} /></Field><div className="flex items-end gap-2"><Button disabled={saving === `payment:${sale.id}`} type="submit">{saving === `payment:${sale.id}` ? "Saving…" : "Save payment"}</Button><Button disabled={saving === `payment:${sale.id}`} onClick={() => setPaymentForm((value) => ({ ...value, saleId: "" }))} type="button" variant="ghost">Cancel</Button></div></form> : null}
                {editing ? <form className="mt-4 grid gap-4 rounded-md border border-amber-200 bg-amber-50/60 p-4" onSubmit={submitAdjustment}>
                  <div><strong>Adjust sale</strong><p className="mt-1 text-xs text-muted-foreground">The original invoice number and receipts remain in the audit trail. Stock changes are posted as separate correction movements.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Customer name"><Input onChange={(event) => setAdjustmentForm((value) => value ? { ...value, customerName: event.target.value } : value)} value={editing.customerName} /></Field><Field label="Phone"><Input inputMode="tel" onChange={(event) => setAdjustmentForm((value) => value ? { ...value, customerPhone: event.target.value } : value)} value={editing.customerPhone} /></Field><Field label="Email"><Input type="email" onChange={(event) => setAdjustmentForm((value) => value ? { ...value, customerEmail: event.target.value } : value)} value={editing.customerEmail} /></Field><Field label="Address"><Input onChange={(event) => setAdjustmentForm((value) => value ? { ...value, customerAddress: event.target.value } : value)} value={editing.customerAddress} /></Field></div>
                  <div className="grid gap-3">{editing.lines.map((line) => <div className="grid gap-3 rounded-md border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_100px_140px_140px] sm:items-end" key={line.offeringId}><div><p className="text-sm font-semibold">{line.offeringName}</p><p className="text-xs text-muted-foreground">Product cannot be replaced during an adjustment.</p></div><Field label="Quantity"><Input min="1" onChange={(event) => updateAdjustmentLine(line.offeringId, { quantity: Number(event.target.value) })} step="1" type="number" value={line.quantity} /></Field><Field label="Unit price"><Input min="0" onChange={(event) => updateAdjustmentLine(line.offeringId, { unitPrice: Number(event.target.value) })} step="0.01" type="number" value={line.unitPrice} /></Field><Field label="Discount"><Input min="0" onChange={(event) => updateAdjustmentLine(line.offeringId, { discountAmount: Number(event.target.value) })} step="0.01" type="number" value={line.discountAmount} /></Field></div>)}</div>
                  <div className="grid gap-3 sm:grid-cols-2"><Field label="Tax rate"><Input max="100" min="0" onChange={(event) => setAdjustmentForm((value) => value ? { ...value, taxRate: Number(event.target.value) } : value)} step="0.01" type="number" value={editing.taxRate} /></Field><Field label="Revised total"><Input readOnly value={formatCurrency(revisedTotal)} /></Field><Field className="sm:col-span-2" label="Sale notes"><Textarea onChange={(event) => setAdjustmentForm((value) => value ? { ...value, notes: event.target.value } : value)} value={editing.notes} /></Field><Field className="sm:col-span-2" label="Correction reason"><Textarea maxLength={500} minLength={5} onChange={(event) => setAdjustmentForm((value) => value ? { ...value, reason: event.target.value } : value)} placeholder="Required for the permanent audit trail" required value={editing.reason} /></Field></div>
                  {revisedTotal < sale.amountPaid ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">The revised total is below the amount already received. Void the sale and record the refund separately.</p> : null}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={saving === `adjust:${sale.id}`} onClick={() => setAdjustmentForm(null)} type="button" variant="ghost">Cancel</Button><Button disabled={saving === `adjust:${sale.id}` || revisedTotal < sale.amountPaid} type="submit">{saving === `adjust:${sale.id}` ? "Saving revision…" : "Save audited revision"}</Button></div>
                </form> : null}
                {voidForm.saleId === sale.id ? <form className="mt-4 grid gap-3 rounded-md border border-red-200 bg-red-50 p-4" onSubmit={submitVoid}><div><strong className="text-red-800">Void {sale.invoiceNumber}</strong><p className="mt-1 text-xs text-red-700">This keeps the sale visible, restores all quantities to this branch, and reverses its linked finance payments.</p></div><Field label="Void reason"><Textarea maxLength={500} minLength={5} onChange={(event) => setVoidForm((value) => ({ ...value, reason: event.target.value }))} placeholder="Required for the permanent audit trail" required value={voidForm.reason} /></Field><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={saving === `void:${sale.id}`} onClick={() => setVoidForm({ saleId: "", reason: "" })} type="button" variant="ghost">Cancel</Button><Button disabled={saving === `void:${sale.id}`} type="submit" variant="danger">{saving === `void:${sale.id}` ? "Voiding sale…" : "Confirm void and reverse"}</Button></div></form> : null}
              </div>
              );
            })}
            {!sales.length ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No POS sales have been recorded in this branch.</div> : null}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
