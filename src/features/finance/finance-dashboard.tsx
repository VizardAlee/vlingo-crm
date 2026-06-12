"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, CalendarClock, CheckCircle2, FileText, Receipt, Scale, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPermission } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, statusTone, titleCase } from "@/lib/utils";
import { listOrgRecords } from "@/services/repository";
import type { Property, PropertyUnit, RentalPaymentRecord, RentalTenancy } from "@/types/crm";

type FinanceRental = RentalTenancy & { id: string };
type FinanceProperty = Property & { id: string };
type FinanceUnit = PropertyUnit & { id: string };

interface ReceiptRow {
  amount: number;
  at: string;
  method: string;
  reference: string;
  tenancyId: string;
  tenancyReference: string;
  tenantName: string;
}

function parseDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function displayDate(value: unknown) {
  const date = parseDate(value);
  return date ? formatDate(date) : "Not set";
}

function daysUntil(value: unknown) {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function paymentTotal(rental: FinanceRental) {
  return Array.isArray(rental.paymentHistory)
    ? rental.paymentHistory.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    : 0;
}

function paymentBalance(rental: FinanceRental) {
  return Math.max(Number(rental.rentAmount ?? 0) - paymentTotal(rental), 0);
}

function isOpenRental(rental: FinanceRental) {
  return !["terminated", "movedOut"].includes(String(rental.status ?? ""));
}

function isOverdue(rental: FinanceRental) {
  const dueDays = daysUntil(rental.nextRentDueDate);
  return String(rental.paymentStatus ?? "") === "overdue" || (dueDays !== null && dueDays < 0 && paymentBalance(rental) > 0);
}

function sortByDateDesc(a: string, b: string) {
  return (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0);
}

async function safeList<T extends { id: string }>(organizationId: string, collectionName: Parameters<typeof listOrgRecords<T>>[1]) {
  try {
    return await listOrgRecords<T>(organizationId, collectionName);
  } catch {
    return [];
  }
}

export function FinanceDashboard() {
  const { activeOrganizationId, member } = useAuth();
  const [rentals, setRentals] = useState<FinanceRental[]>([]);
  const [properties, setProperties] = useState<FinanceProperty[]>([]);
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRentals, nextProperties, nextUnits] = await Promise.all([
        safeList<FinanceRental>(activeOrganizationId, "rentalTenancies"),
        safeList<FinanceProperty>(activeOrganizationId, "properties"),
        safeList<FinanceUnit>(activeOrganizationId, "propertyUnits"),
      ]);
      setRentals(nextRentals);
      setProperties(nextProperties);
      setUnits(nextUnits);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load finance workspace.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFinance();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadFinance]);

  const finance = useMemo(() => {
    const activeRentals = rentals.filter(isOpenRental);
    const overdueRentals = activeRentals.filter(isOverdue);
    const upcomingRentals = activeRentals
      .filter((rental) => {
        const dueDays = daysUntil(rental.nextRentDueDate);
        return dueDays !== null && dueDays >= 0 && dueDays <= 30 && paymentBalance(rental) > 0;
      })
      .sort((a, b) => (daysUntil(a.nextRentDueDate) ?? 9999) - (daysUntil(b.nextRentDueDate) ?? 9999));

    const receipts = rentals
      .flatMap((rental) => (Array.isArray(rental.paymentHistory) ? rental.paymentHistory : []).map((payment: RentalPaymentRecord) => ({
        amount: Number(payment.amount ?? 0),
        at: String(payment.at ?? ""),
        method: String(payment.method ?? "payment"),
        reference: String(payment.reference ?? ""),
        tenancyId: rental.id,
        tenancyReference: String(rental.referenceNumber ?? "Draft"),
        tenantName: String(rental.tenantName ?? "Tenant"),
      } satisfies ReceiptRow)))
      .sort((a, b) => sortByDateDesc(a.at, b.at));

    const rentalReceivable = activeRentals.reduce((sum, rental) => sum + Number(rental.rentAmount ?? 0), 0);
    const collected = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const outstanding = activeRentals.reduce((sum, rental) => sum + paymentBalance(rental), 0);
    const overdue = overdueRentals.reduce((sum, rental) => sum + paymentBalance(rental), 0);
    const rentalFees = rentals.reduce((sum, rental) => sum + Number(rental.agencyFee ?? 0), 0);
    const propertyCommissions = properties.reduce((sum, property) => sum + Number(property.commissionAmount ?? 0), 0);

    return {
      activeRentals,
      collected,
      commissionExposure: rentalFees + propertyCommissions,
      overdue,
      overdueRentals: overdueRentals.sort((a, b) => (daysUntil(a.nextRentDueDate) ?? 0) - (daysUntil(b.nextRentDueDate) ?? 0)),
      receipts,
      rentalReceivable,
      outstanding,
      upcomingRentals,
    };
  }, [properties, rentals]);

  if (!hasPermission(member, "reports.viewFinancial")) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading finance workspace" />;
  }

  const metricCards = [
    { icon: Banknote, label: "Rent receivable", tone: "text-primary", value: formatCurrency(finance.rentalReceivable) },
    { icon: CheckCircle2, label: "Collected", tone: "text-success", value: formatCurrency(finance.collected) },
    { icon: AlertTriangle, label: "Overdue balance", tone: "text-destructive", value: formatCurrency(finance.overdue) },
    { icon: ShieldCheck, label: "Commission exposure", tone: "text-warning", value: formatCurrency(finance.commissionExposure) },
  ];

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track rent receivables, overdue balances, receipts, and commission exposure.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:mt-0 md:flex">
          <ButtonLink href="/rentals" variant="outline">Rental ledger</ButtonLink>
          <ButtonLink href="/reports" variant="secondary">Reports</ButtonLink>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                  </div>
                  <Icon className={cn("h-5 w-5", item.tone)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Payment Queue</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Overdue and next-30-day rent items that need finance follow-up.</p>
            </div>
            <Badge tone={finance.overdueRentals.length ? "danger" : "success"}>{finance.overdueRentals.length} overdue</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[...finance.overdueRentals, ...finance.upcomingRentals].slice(0, 8).map((rental) => {
              const dueDays = daysUntil(rental.nextRentDueDate);
              const overdue = isOverdue(rental);
              return (
                <div className="rounded-md border p-3" key={rental.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <Link className="font-semibold text-primary hover:underline" href={`/rentals/${rental.id}`}>{String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}</Link>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{String(rental.unitName ?? rental.propertyName ?? "No property linked")}</p>
                    </div>
                    <div className="grid gap-1 text-sm lg:text-right">
                      <span className="font-semibold">{formatCurrency(paymentBalance(rental))}</span>
                      <span className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                        {displayDate(rental.nextRentDueDate)}{dueDays === null ? "" : dueDays < 0 ? ` · ${Math.abs(dueDays)} days overdue` : ` · ${dueDays} days left`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(String(rental.paymentStatus ?? "notInvoiced"))}>{titleCase(String(rental.paymentStatus ?? "notInvoiced"))}</Badge>
                    <Badge tone={statusTone(String(rental.status ?? "draft"))}>{titleCase(String(rental.status ?? "draft"))}</Badge>
                    <ButtonLink href={`/rentals/${rental.id}`} size="sm" variant="outline">Open record</ButtonLink>
                  </div>
                </div>
              );
            })}
            {!finance.overdueRentals.length && !finance.upcomingRentals.length ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No overdue or upcoming rent payments in the next 30 days.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finance Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[
              { icon: Receipt, label: "Receipt source", value: "Receipts are generated from rental payment history." },
              { icon: Scale, label: "Verification", value: "Payment recording remains on rental records with audit logging." },
              { icon: FileText, label: "Coverage", value: `${finance.activeRentals.length} active tenancies, ${finance.receipts.length} payment receipts.` },
              { icon: CalendarClock, label: "Attention", value: `${finance.upcomingRentals.length} rent items due within 30 days.` },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="flex gap-3 rounded-md border p-3" key={item.label}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Receipts</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {finance.receipts.slice(0, 8).map((receipt) => (
              <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/rentals/${receipt.tenancyId}`} key={`${receipt.tenancyId}-${receipt.at}-${receipt.reference}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{formatCurrency(receipt.amount)}</span>
                  <span className="text-xs text-muted-foreground">{displayDate(receipt.at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{receipt.tenantName} · {titleCase(receipt.method)}{receipt.reference ? ` · ${receipt.reference}` : ""}</p>
                <p className="mt-1 text-xs font-medium text-primary">{receipt.tenancyReference}</p>
              </Link>
            ))}
            {!finance.receipts.length ? <div className="rounded-md border border-dashed p-4 text-muted-foreground">No receipts yet. Record payments from rental records.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commission Snapshot</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[
              { label: "Rental agency fees", value: rentals.reduce((sum, rental) => sum + Number(rental.agencyFee ?? 0), 0) },
              { label: "Property commissions", value: properties.reduce((sum, property) => sum + Number(property.commissionAmount ?? 0), 0) },
              { label: "Priced unit inventory", value: units.reduce((sum, unit) => sum + Number(unit.askingPrice ?? unit.rentAmount ?? 0), 0) },
            ].map((item) => (
              <div className="flex items-center justify-between gap-4 rounded-md border p-3" key={item.label}>
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground">
              Commission values are calculated from existing property, unit, and rental records. Payout approval can be added as a protected workflow in the next finance pass.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
