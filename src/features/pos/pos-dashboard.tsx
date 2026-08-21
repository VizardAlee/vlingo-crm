"use client";

import Link from "next/link";
import { Banknote, FileText, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { listInventoryBalances, listInventoryItems } from "@/services/inventory";
import { createPosSale, listPosSales, recordPosSalePayment } from "@/services/pos";
import type { InventoryBalance, Offering, PosSale, RentalPaymentMethod } from "@/types/crm";

type CartLine = { offeringId: string; quantity: number; discountAmount: number };
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
  { target: "pos-payment", title: "Receive payment", body: "Enter nothing for an unpaid invoice, or record a full or partial payment and its method. A receipt is created whenever money is received." },
  { target: "pos-history", title: "Invoices and receipts", body: "Use Sales history to print documents and collect outstanding invoice balances later." },
];

function paymentTone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "partPaid") return "warning" as const;
  return "danger" as const;
}

export function PosDashboard() {
  const { activeBranchId, activeOrganizationId, member } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"checkout" | "sales">("checkout");
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
  const [payment, setPayment] = useState({ amountPaid: 0, method: "cash" as RentalPaymentMethod, reference: "", taxRate: 0 });
  const [paymentForm, setPaymentForm] = useState({ saleId: "", amount: 0, method: "cash" as RentalPaymentMethod, reference: "" });
  const canSell = hasPermission(member, "pos.sell");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextItems, nextBalances, nextSales] = await Promise.all([
        listInventoryItems(activeOrganizationId, member),
        listInventoryBalances(activeOrganizationId, member),
        listPosSales(activeOrganizationId, member),
      ]);
      setItems(nextItems.filter((item) => item.status === "active" && Boolean(item.brandId)));
      setBalances(nextBalances.filter((balance) => balance.branchId === activeBranchId && balance.locationId === activeBranchId));
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
    const gross = Number(item.sellingPrice ?? 0) * line.quantity;
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
      return [...current, { offeringId, quantity: 1, discountAmount: 0 }];
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

  async function submitSale(event: React.FormEvent) {
    event.preventDefault();
    if (!cart.length) return;
    if (cartDetails.some((line) => line.quantity <= 0 || line.quantity > line.available || line.discountAmount > line.gross)) {
      toast({ title: "Review the cart", description: "A quantity or discount is outside the allowed range.", variant: "error" });
      return;
    }
    setSaving("sale");
    try {
      const result = await createPosSale({
        organizationId: activeOrganizationId,
        branchId: activeBranchId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerAddress: customer.address,
        notes: customer.notes,
        lines: cart.map((line) => ({ offeringId: line.offeringId, quantity: line.quantity, discountAmount: line.discountAmount })),
        taxRate: Number(payment.taxRate || 0),
        amountPaid: Number(payment.amountPaid || 0),
        paymentMethod: payment.method,
        paymentReference: payment.reference,
        soldAt: new Date().toISOString(),
      });
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "", notes: "" });
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
    setSaving(`payment:${paymentForm.saleId}`);
    try {
      const result = await recordPosSalePayment({
        organizationId: activeOrganizationId,
        saleId: paymentForm.saleId,
        amount: Number(paymentForm.amount),
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
        <div className="mt-4 flex flex-wrap items-end justify-end gap-2 md:mt-0">
          <GuidedTour storageKey="vlingo-tour:pos-v1" steps={posTourSteps} />
          <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border bg-white px-3 py-2"><p className="text-xs text-muted-foreground">Today</p><strong>{todaySales.length}</strong></div>
          <div className="rounded-md border bg-white px-3 py-2"><p className="text-xs text-muted-foreground">Revenue</p><strong>{formatCurrency(todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0))}</strong></div>
          <div className="rounded-md border bg-white px-3 py-2"><p className="text-xs text-muted-foreground">Due</p><strong>{formatCurrency(sales.reduce((sum, sale) => sum + sale.balanceDue, 0))}</strong></div></div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setTab("checkout")} variant={tab === "checkout" ? "primary" : "outline"}><ShoppingCart className="h-4 w-4" />New sale</Button>
        <Button data-tour="pos-history" onClick={() => setTab("sales")} variant={tab === "sales" ? "primary" : "outline"}><FileText className="h-4 w-4" />Sales history</Button>
      </div>

      {tab === "checkout" ? (
        canSell ? <form className="grid items-start gap-4 xl:grid-cols-[1fr_420px]" onSubmit={submitSale}>
          <div className="grid gap-4">
            <Card data-tour="pos-products">
              <CardHeader><CardTitle>Find products</CardTitle></CardHeader>
              <CardContent>
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input autoFocus className="pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Search by product, SKU, barcode, or brand" value={search} /></div>
                <div className="mt-4 grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2">
                  {searchableItems.map((item) => (
                    <button className="flex items-center justify-between gap-3 rounded-md border p-3 text-left transition hover:border-primary hover:bg-primary/5" key={item.id} onClick={() => addToCart(item.id)} type="button">
                      <span className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="block truncate text-xs text-muted-foreground">{item.brandName} · {item.sku || "No SKU"} · {stock.get(item.id)} available</span></span>
                      <span className="shrink-0 text-sm font-semibold">{formatCurrency(item.sellingPrice)}</span>
                    </button>
                  ))}
                  {!searchableItems.length ? <div className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No saleable stock matches this search in the active branch.</div> : null}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer name"><Input onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} placeholder="Walk-in customer if blank" value={customer.name} /></Field>
                <Field label="Phone"><Input onChange={(event) => setCustomer((value) => ({ ...value, phone: event.target.value }))} value={customer.phone} /></Field>
                <Field label="Email"><Input onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} type="email" value={customer.email} /></Field>
                <Field label="Address"><Input onChange={(event) => setCustomer((value) => ({ ...value, address: event.target.value }))} value={customer.address} /></Field>
                <Field className="sm:col-span-2" label="Sale notes"><Textarea onChange={(event) => setCustomer((value) => ({ ...value, notes: event.target.value }))} value={customer.notes} /></Field>
              </CardContent>
            </Card>
          </div>

          <Card className="xl:sticky xl:top-4" data-tour="pos-cart">
            <CardHeader><CardTitle>Current sale ({cart.length})</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid max-h-[400px] gap-3 overflow-y-auto">
                {cartDetails.map((line) => (
                  <div className="rounded-md border p-3" key={line.offeringId}>
                    <div className="flex justify-between gap-3"><div><strong className="text-sm">{line.item.name}</strong><p className="text-xs text-muted-foreground">{formatCurrency(line.item.sellingPrice)} each · {line.available} available</p></div><Button aria-label="Remove product" onClick={() => setCart((value) => value.filter((entry) => entry.offeringId !== line.offeringId))} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button></div>
                    <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2"><Button disabled={line.quantity <= 1} onClick={() => stepQuantity(line.offeringId, line.quantity - 1)} size="icon" type="button" variant="outline"><Minus className="h-4 w-4" /></Button><Input aria-label="Quantity" inputMode="numeric" max={line.available} min="1" onBlur={() => finishQuantity(line.offeringId, line.available)} onChange={(event) => typeQuantity(line.offeringId, event.target.value)} onFocus={(event) => event.currentTarget.select()} step="1" type="number" value={quantityDrafts[line.offeringId] ?? String(line.quantity)} /><Button disabled={line.quantity >= line.available} onClick={() => stepQuantity(line.offeringId, line.quantity + 1)} size="icon" type="button" variant="outline"><Plus className="h-4 w-4" /></Button></div>
                    <Field className="mt-3" label="Line discount"><Input max={line.gross} min="0" onChange={(event) => updateCart(line.offeringId, { discountAmount: Math.max(0, Number(event.target.value)) })} type="number" value={line.discountAmount} /></Field>
                    <p className="mt-3 text-right text-sm font-semibold">{formatCurrency(line.total)}</p>
                  </div>
                ))}
                {!cart.length ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Select products to begin a sale.</div> : null}
              </div>
              <div className="grid gap-2 border-y py-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>-{formatCurrency(discount)}</strong></div><div className="flex items-center justify-between gap-4"><span>Tax rate</span><Input className="w-24" max="100" min="0" onChange={(event) => setPayment((value) => ({ ...value, taxRate: Number(event.target.value) }))} type="number" value={payment.taxRate} /></div><div className="flex justify-between text-lg"><strong>Total</strong><strong>{formatCurrency(total)}</strong></div></div>
              <Field label="Amount received"><Input data-tour="pos-payment" max={total} min="0" onChange={(event) => setPayment((value) => ({ ...value, amountPaid: Number(event.target.value) }))} type="number" value={payment.amountPaid} /></Field>
              {payment.amountPaid > 0 ? <><Field label="Payment method"><Select onChange={(event) => setPayment((value) => ({ ...value, method: event.target.value as RentalPaymentMethod }))} value={payment.method}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select></Field><Field label="Payment reference"><Input onChange={(event) => setPayment((value) => ({ ...value, reference: event.target.value }))} placeholder="Optional" value={payment.reference} /></Field></> : null}
              <div className="rounded-md bg-muted p-3 text-sm"><div className="flex justify-between"><span>Balance due</span><strong>{formatCurrency(Math.max(0, total - payment.amountPaid))}</strong></div><p className="mt-1 text-xs text-muted-foreground">Every sale generates an invoice. A receipt is generated for any payment received.</p></div>
              <Button className="h-12" disabled={!cart.length || saving === "sale"} type="submit"><Banknote className="h-5 w-5" />{saving === "sale" ? "Completing sale…" : "Complete sale"}</Button>
            </CardContent>
          </Card>
        </form> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Your role can review sales but cannot process a checkout.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Sales history</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {sales.map((sale) => (
              <div className="rounded-md border p-4" key={sale.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><strong>{sale.invoiceNumber}</strong><Badge tone={paymentTone(sale.paymentStatus)}>{titleCase(sale.paymentStatus)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{sale.customerName} · {formatDate(sale.soldAt)} · {sale.lines.length} product line(s)</p></div>
                  <div className="md:text-right"><strong className="text-lg">{formatCurrency(sale.totalAmount)}</strong><p className="text-xs text-muted-foreground">{formatCurrency(sale.balanceDue)} due</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/invoice`}><FileText className="h-4 w-4" />Invoice</Link>{(sale.paymentHistory ?? []).map((entry, index) => <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/receipt/${encodeURIComponent(entry.receiptNumber)}`} key={entry.receiptNumber}><Printer className="h-4 w-4" />Receipt {index + 1}</Link>)}{sale.amountPaid > 0 && !sale.paymentHistory?.length ? <Link className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium" href={`/pos/sales/${sale.id}/receipt`}><Printer className="h-4 w-4" />Receipt</Link> : null}{canSell && sale.balanceDue > 0 ? <Button onClick={() => setPaymentForm({ saleId: sale.id, amount: sale.balanceDue, method: "cash", reference: "" })} size="sm" type="button" variant="secondary">Record payment</Button> : null}</div>
                {paymentForm.saleId === sale.id ? <form className="mt-4 grid gap-3 rounded-md bg-muted p-4 sm:grid-cols-4" onSubmit={submitPayment}><Field label="Amount"><Input max={sale.balanceDue} min="0.01" onChange={(event) => setPaymentForm((value) => ({ ...value, amount: Number(event.target.value) }))} required type="number" value={paymentForm.amount} /></Field><Field label="Method"><Select onChange={(event) => setPaymentForm((value) => ({ ...value, method: event.target.value as RentalPaymentMethod }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select></Field><Field label="Reference"><Input onChange={(event) => setPaymentForm((value) => ({ ...value, reference: event.target.value }))} value={paymentForm.reference} /></Field><div className="flex items-end gap-2"><Button disabled={saving === `payment:${sale.id}`} type="submit">Save payment</Button><Button onClick={() => setPaymentForm((value) => ({ ...value, saleId: "" }))} type="button" variant="ghost">Cancel</Button></div></form> : null}
              </div>
            ))}
            {!sales.length ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No POS sales have been recorded in this branch.</div> : null}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
