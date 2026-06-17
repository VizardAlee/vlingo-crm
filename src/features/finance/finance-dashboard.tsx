"use client";

import Link from "next/link";
import { Banknote, CheckCircle2, ClipboardCheck, FileText, Printer, Receipt, Scale, ShieldCheck, WalletCards } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { approvalTone, createReceiptNumber, dealPaymentSummary, dealTargetAmount, paymentStatusForAmount, paymentTotal, rentalBalance } from "@/features/finance/finance-utils";
import { hasPermission } from "@/lib/permissions";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { createOrgRecord, listOrgRecords, updateOrgRecord, writeAuditLog } from "@/services/repository";
import type { Deal, FinanceApprovalStatus, FinanceCommission, FinanceExpense, FinancePayment, FinancePaymentSourceType, Lead, PaymentVerificationStatus, Property, PropertyUnit, RentalPaymentMethod, RentalPaymentRecord, RentalTenancy } from "@/types/crm";

type FinanceRental = RentalTenancy & { id: string };
type FinanceProperty = Property & { id: string };
type FinanceUnit = PropertyUnit & { id: string };
type FinanceLead = Lead & { id: string };
type FinanceDeal = Deal & { id: string };
type FinanceActionCollection = "financeCommissions" | "financeExpenses" | "financePayments";
type RevenueSource = {
  amount: number;
  label: string;
  payerName: string;
  propertyName: string;
  reference: string;
  sourceId: string;
  sourceType: FinancePaymentSourceType;
  value: string;
};

const paymentMethods: RentalPaymentMethod[] = ["bankTransfer", "cash", "pos", "cheque", "onlinePayment", "other"];
const expenseCategories = ["Repairs", "Utilities", "Marketing", "Legal", "Agency", "Inspection", "Office", "Transport", "Other"];
const relatedEntityTypes = ["office", "deal", "property", "unit", "tenancy", "development", "marketing", "other"];

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

function sortByDateDesc(a: string, b: string) {
  return (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0);
}

function isOpenRental(rental: FinanceRental) {
  return !["terminated", "movedOut"].includes(String(rental.status ?? ""));
}

function isOverdue(rental: FinanceRental) {
  const dueDays = daysUntil(rental.nextRentDueDate);
  return String(rental.paymentStatus ?? "") === "overdue" || (dueDays !== null && dueDays < 0 && rentalBalance(rental) > 0);
}

async function safeList<T extends { id: string }>(organizationId: string, collectionName: Parameters<typeof listOrgRecords<T>>[1]) {
  try {
    return await listOrgRecords<T>(organizationId, collectionName);
  } catch {
    return [];
  }
}

function buildRevenueSources(deals: FinanceDeal[], leads: FinanceLead[], rentals: FinanceRental[], properties: FinanceProperty[], units: FinanceUnit[]): RevenueSource[] {
  return [
    ...deals
      .filter((deal) => !["lost", "dormant"].includes(String(deal.status ?? "")))
      .map((deal) => {
        const targetAmount = dealTargetAmount(deal);
        const recordedAmount = Number(deal.paidAmount ?? 0) + Number(deal.pendingPaymentAmount ?? 0);

        return {
          amount: Math.max(targetAmount - recordedAmount, 0) || targetAmount,
          label: `Deal: ${deal.title ?? deal.referenceNumber ?? "Deal"} (${titleCase(String(deal.financeStatus ?? deal.status ?? "new"))})`,
          payerName: deal.clientName ?? deal.leadName ?? "",
          propertyName: [deal.unitName, deal.propertyName].filter(Boolean).join(" · "),
          reference: deal.referenceNumber ?? "",
          sourceId: deal.id,
          sourceType: "deal" as const,
          value: `deal:${deal.id}`,
        };
      }),
    ...leads
      .filter((lead) => !["lost", "dormant"].includes(String(lead.status ?? "")))
      .map((lead) => ({
        amount: Number(lead.budgetMaximum ?? lead.budgetMinimum ?? 0),
        label: `Deal: ${lead.fullName ?? lead.referenceNumber ?? "Lead"} (${titleCase(String(lead.status ?? "new"))})`,
        payerName: lead.fullName ?? "",
        propertyName: [lead.preferredPropertyCategory ?? lead.propertyType, lead.preferredLocation ?? lead.preferredCity].filter(Boolean).join(" · "),
        reference: lead.referenceNumber ?? "",
        sourceId: lead.id,
        sourceType: "lead" as const,
        value: `lead:${lead.id}`,
      })),
    ...rentals.map((rental) => ({
      amount: Number(rental.rentAmount ?? rental.totalInitialPayment ?? 0),
      label: `Rent: ${rental.tenantName ?? rental.referenceNumber ?? "Tenant"} (${rental.referenceNumber ?? "Tenancy"})`,
      payerName: rental.tenantName ?? "",
      propertyName: String(rental.unitName ?? rental.propertyName ?? ""),
      reference: rental.referenceNumber ?? "",
      sourceId: rental.id,
      sourceType: "rental" as const,
      value: `rental:${rental.id}`,
    })),
    ...properties.map((property) => ({
      amount: Number(property.askingPrice ?? property.minimumAcceptablePrice ?? property.rentAmount ?? 0),
      label: `Property sale: ${property.name} (${property.referenceNumber ?? "Property"})`,
      payerName: "",
      propertyName: property.name,
      reference: property.referenceNumber ?? "",
      sourceId: property.id,
      sourceType: "property" as const,
      value: `property:${property.id}`,
    })),
    ...units.map((unit) => ({
      amount: Number(unit.askingPrice ?? unit.rentAmount ?? 0),
      label: `Unit sale: ${unit.unitNumber} (${unit.referenceNumber ?? unit.propertyName ?? "Unit"})`,
      payerName: "",
      propertyName: String(unit.propertyName ?? unit.unitNumber ?? ""),
      reference: unit.referenceNumber ?? "",
      sourceId: unit.id,
      sourceType: "unit" as const,
      value: `unit:${unit.id}`,
    })),
    {
      amount: 0,
      label: "Other income",
      payerName: "",
      propertyName: "",
      reference: "Other income",
      sourceId: "other",
      sourceType: "other" as const,
      value: "other:other",
    },
  ];
}

function approvalLabel(status: FinanceApprovalStatus | PaymentVerificationStatus) {
  return titleCase(status === "pending" ? "pendingVerification" : status);
}

export function FinanceDashboard({ initialSource }: { initialSource?: string }) {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [deals, setDeals] = useState<FinanceDeal[]>([]);
  const [leads, setLeads] = useState<FinanceLead[]>([]);
  const [rentals, setRentals] = useState<FinanceRental[]>([]);
  const [properties, setProperties] = useState<FinanceProperty[]>([]);
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [commissions, setCommissions] = useState<FinanceCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    at: new Date().toISOString().slice(0, 10),
    method: "bankTransfer" as RentalPaymentMethod,
    note: "",
    payerName: "",
    paymentReference: "",
    source: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "Repairs",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    method: "bankTransfer" as RentalPaymentMethod,
    paymentReference: "",
    relatedEntityId: "",
    relatedEntityType: "office",
    vendor: "",
  });
  const [commissionForm, setCommissionForm] = useState({
    amount: "",
    basis: "",
    beneficiaryName: "",
    dueAt: new Date().toISOString().slice(0, 10),
    source: "",
  });

  const context = user ? { branchId: activeBranchId, organizationId: activeOrganizationId, userId: user.uid } : null;
  const canReadFinance = hasPermission(member, "reports.viewFinancial");
  const canCreateFinance = hasPermission(member, "finance.create");
  const canApproveFinance = hasPermission(member, "finance.approve");
  const canUpdateDeal = hasPermission(member, "deals.update") || hasPermission(member, "finance.update") || hasPermission(member, "finance.approve");
  const canUpdateRental = hasPermission(member, "rentals.update");
  const canCreateActivity = hasPermission(member, "activities.create");

  useEffect(() => {
    if (success) {
      toast({ title: "Finance updated", description: success, variant: "success" });
    }
  }, [success, toast]);

  useEffect(() => {
    if (error) {
      toast({ title: "Finance action failed", description: error, variant: "error" });
    }
  }, [error, toast]);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextDeals, nextLeads, nextRentals, nextProperties, nextUnits, nextPayments, nextExpenses, nextCommissions] = await Promise.all([
        safeList<FinanceDeal>(activeOrganizationId, "deals"),
        safeList<FinanceLead>(activeOrganizationId, "leads"),
        safeList<FinanceRental>(activeOrganizationId, "rentalTenancies"),
        safeList<FinanceProperty>(activeOrganizationId, "properties"),
        safeList<FinanceUnit>(activeOrganizationId, "propertyUnits"),
        safeList<FinancePayment>(activeOrganizationId, "financePayments"),
        safeList<FinanceExpense>(activeOrganizationId, "financeExpenses"),
        safeList<FinanceCommission>(activeOrganizationId, "financeCommissions"),
      ]);
      setDeals(nextDeals);
      setLeads(nextLeads);
      setRentals(nextRentals);
      setProperties(nextProperties);
      setUnits(nextUnits);
      setPayments(nextPayments);
      setExpenses(nextExpenses);
      setCommissions(nextCommissions);
      if (initialSource) {
        const source = buildRevenueSources(nextDeals, nextLeads, nextRentals, nextProperties, nextUnits).find((item) => item.value === initialSource);
        if (source) {
          setPaymentForm((current) => current.source ? current : {
            ...current,
            amount: source.amount ? String(source.amount) : current.amount,
            payerName: source.payerName,
            source: source.value,
          });
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load finance workspace.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, initialSource]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFinance();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadFinance]);

  const revenueSources = useMemo<RevenueSource[]>(() => buildRevenueSources(deals, leads, rentals, properties, units), [deals, leads, properties, rentals, units]);

  const commissionSources = useMemo(() => [
    ...deals.map((deal) => ({
      amount: Number(deal.commissionAmount ?? 0),
      label: `${deal.title} (${deal.referenceNumber ?? "Deal"})`,
      reference: deal.referenceNumber,
      type: "deal" as const,
      value: `deal:${deal.id}`,
    })),
    ...properties.map((property) => ({
      amount: Number(property.commissionAmount ?? 0),
      label: `${property.name} (${property.referenceNumber ?? "Property"})`,
      reference: property.referenceNumber,
      type: "property" as const,
      value: `property:${property.id}`,
    })),
    ...units.map((unit) => ({
      amount: Number(unit.askingPrice ?? unit.rentAmount ?? 0),
      label: `${unit.unitNumber} (${unit.referenceNumber ?? unit.propertyName ?? "Unit"})`,
      reference: unit.referenceNumber,
      type: "unit" as const,
      value: `unit:${unit.id}`,
    })),
    ...rentals.map((rental) => ({
      amount: Number(rental.agencyFee ?? 0),
      label: `${rental.tenantName ?? rental.referenceNumber ?? "Rental"} (${rental.referenceNumber ?? "Tenancy"})`,
      reference: rental.referenceNumber,
      type: "rental" as const,
      value: `rental:${rental.id}`,
    })),
  ], [deals, properties, rentals, units]);

  const finance = useMemo(() => {
    const activeRentals = rentals.filter(isOpenRental);
    const overdueRentals = activeRentals.filter(isOverdue).sort((a, b) => (daysUntil(a.nextRentDueDate) ?? 0) - (daysUntil(b.nextRentDueDate) ?? 0));
    const upcomingRentals = activeRentals
      .filter((rental) => {
        const dueDays = daysUntil(rental.nextRentDueDate);
        return dueDays !== null && dueDays >= 0 && dueDays <= 30 && rentalBalance(rental) > 0;
      })
      .sort((a, b) => (daysUntil(a.nextRentDueDate) ?? 9999) - (daysUntil(b.nextRentDueDate) ?? 9999));
    const sortedPayments = payments.slice().sort((a, b) => sortByDateDesc(a.at, b.at));
    const sortedExpenses = expenses.slice().sort((a, b) => sortByDateDesc(a.date, b.date));
    const sortedCommissions = commissions.slice().sort((a, b) => sortByDateDesc(a.dueAt ?? "", b.dueAt ?? ""));
    const verifiedPayments = sortedPayments.filter((payment) => payment.verificationStatus === "verified");
    const verifiedCollected = verifiedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const dealCollected = verifiedPayments
      .filter((payment) => payment.sourceType === "deal" || payment.sourceType === "lead")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const rentCollected = verifiedPayments
      .filter((payment) => payment.sourceType === "rental" || (!payment.sourceType && payment.tenancyId))
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const salesCollected = verifiedPayments
      .filter((payment) => payment.sourceType === "property" || payment.sourceType === "unit")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const otherCollected = verifiedPayments
      .filter((payment) => payment.sourceType === "other")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const pendingCollected = sortedPayments.filter((payment) => payment.verificationStatus === "pending").reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const approvedExpenses = sortedExpenses.filter((expense) => ["approved", "paid"].includes(expense.approvalStatus)).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const pendingApprovals = [
      ...sortedPayments.filter((payment) => payment.verificationStatus === "pending"),
      ...sortedExpenses.filter((expense) => expense.approvalStatus === "pendingApproval"),
      ...sortedCommissions.filter((commission) => commission.approvalStatus === "pendingApproval"),
    ].length;

    return {
      activeRentals,
      approvedExpenses,
      commissionPayable: sortedCommissions.filter((commission) => ["approved", "paid"].includes(commission.approvalStatus)).reduce((sum, commission) => sum + Number(commission.amount ?? 0), 0),
      dealCollected,
      inventorySalesValue: properties.reduce((sum, property) => sum + Number(property.askingPrice ?? 0), 0) + units.reduce((sum, unit) => sum + Number(unit.askingPrice ?? 0), 0),
      overdue: overdueRentals.reduce((sum, rental) => sum + rentalBalance(rental), 0),
      overdueRentals,
      otherCollected,
      pendingApprovals,
      pendingCollected,
      rentCollected,
      rentalReceivable: activeRentals.reduce((sum, rental) => sum + Number(rental.rentAmount ?? 0), 0),
      salesCollected,
      sortedCommissions,
      sortedExpenses,
      sortedPayments,
      upcomingRentals,
      verifiedCollected,
    };
  }, [commissions, expenses, payments, properties, rentals, units]);

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to record payments.");
      return;
    }

    const source = revenueSources.find((item) => item.value === paymentForm.source);
    const amount = Number(paymentForm.amount);
    if (!source) {
      setError("Select a revenue source before recording payment.");
      return;
    }

    if (source.sourceType === "rental" && !canUpdateRental) {
      setError("You need rental update permission to record rent against a tenancy.");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    const receiptNumber = createReceiptNumber();
    const rental = source.sourceType === "rental" ? rentals.find((item) => item.id === source.sourceId) : null;
    const existingHistory = rental && Array.isArray(rental.paymentHistory) ? rental.paymentHistory : [];
    const paymentStatus = rental ? paymentStatusForAmount(amount, rental) : null;
    setSaving("payment");
    setError(null);
    setSuccess(null);
    try {
      const paymentId = await createOrgRecord("financePayments", {
        amount,
        at: paymentForm.at,
        method: paymentForm.method,
        note: paymentForm.note.trim(),
        payerName: paymentForm.payerName.trim() || source.payerName || "Payer",
        paymentReference: paymentForm.paymentReference.trim(),
        propertyName: source.propertyName,
        receiptNumber,
        sourceId: source.sourceId,
        sourceReference: source.reference,
        sourceType: source.sourceType,
        status: "active",
        tenancyId: rental?.id ?? "",
        tenancyReference: rental?.referenceNumber ?? "",
        tenantName: rental?.tenantName ?? "",
        verificationStatus: "pending",
      }, context, "PAY");
      const createdPayment = {
        amount,
        at: paymentForm.at,
        id: paymentId,
        method: paymentForm.method,
        payerName: paymentForm.payerName.trim() || source.payerName || "Payer",
        paymentReference: paymentForm.paymentReference.trim(),
        propertyName: source.propertyName,
        receiptNumber,
        referenceNumber: receiptNumber,
        sourceId: source.sourceId,
        sourceReference: source.reference,
        sourceType: source.sourceType,
        verificationStatus: "pending" as const,
      } as FinancePayment;

      if (rental && paymentStatus) {
        const paymentEntry: RentalPaymentRecord = {
          amount,
          at: paymentForm.at,
          method: paymentForm.method,
          note: paymentForm.note.trim(),
          paymentId,
          receiptNumber,
          reference: paymentForm.paymentReference.trim(),
          userId: context.userId,
          verificationStatus: "pending",
        };

        await updateOrgRecord("rentalTenancies", rental.id, {
          lastPaymentAmount: amount,
          lastPaymentAt: paymentEntry.at,
          paymentHistory: [...existingHistory, paymentEntry],
          paymentStatus,
          status: String(rental.status ?? "draft") === "draft" ? "active" : rental.status,
        }, context);
      }

      if (source.sourceType === "deal") {
        await syncDealPaymentSummary(source.sourceId, [...payments, createdPayment]);
      }

      if (canCreateActivity) {
        const relatedEntityType = source.sourceType === "rental" ? "tenancy" : source.sourceType === "other" ? undefined : source.sourceType;
        const activityId = await createOrgRecord("activities", {
          body: paymentForm.note.trim() || `Receipt ${receiptNumber} created for ${titleCase(source.sourceType)} revenue. Verification is pending.`,
          relatedEntityId: source.sourceType === "other" ? "" : source.sourceId,
          relatedEntityType,
          status: "completed",
          subject: `Payment receipt created: ${formatCurrency(amount)}`,
          type: "internalNote",
        }, context, "ACT");
        await writeAuditLog(context, "activity.create", "activities", activityId, { receiptNumber, relatedEntityId: source.sourceId, sourceType: source.sourceType });
      }

      await writeAuditLog(context, "finance.payment.create", "financePayments", paymentId, { amount, receiptNumber, sourceId: source.sourceId, sourceType: source.sourceType });
      setPaymentForm((current) => ({ ...current, amount: "", note: "", payerName: "", paymentReference: "" }));
      setSuccess(`Receipt ${receiptNumber} created and queued for verification.`);
      await loadFinance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to record payment.");
    } finally {
      setSaving(null);
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to record expenses.");
      return;
    }

    const amount = Number(expenseForm.amount);
    if (!amount || amount <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    setSaving("expense");
    setError(null);
    setSuccess(null);
    try {
      const expenseId = await createOrgRecord("financeExpenses", {
        amount,
        approvalStatus: "pendingApproval",
        category: expenseForm.category,
        date: expenseForm.date,
        description: expenseForm.description.trim(),
        method: expenseForm.method,
        paymentReference: expenseForm.paymentReference.trim(),
        relatedEntityId: expenseForm.relatedEntityId.trim(),
        relatedEntityType: expenseForm.relatedEntityType,
        status: "active",
        vendor: expenseForm.vendor.trim(),
      }, context, "EXP");
      await writeAuditLog(context, "finance.expense.create", "financeExpenses", expenseId, { amount, category: expenseForm.category });
      setExpenseForm((current) => ({ ...current, amount: "", description: "", paymentReference: "", relatedEntityId: "", vendor: "" }));
      setSuccess("Expense recorded and queued for approval.");
      await loadFinance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to record expense.");
    } finally {
      setSaving(null);
    }
  }

  async function submitCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) {
      setError("You must be signed in to record commissions.");
      return;
    }

    const source = commissionSources.find((item) => item.value === commissionForm.source);
    const amount = Number(commissionForm.amount);
    if (!source) {
      setError("Select a commission source.");
      return;
    }

    if (!commissionForm.beneficiaryName.trim()) {
      setError("Enter the beneficiary name.");
      return;
    }

    if (!amount || amount <= 0) {
      setError("Enter a valid commission amount.");
      return;
    }

    const [, sourceId] = commissionForm.source.split(":");
    setSaving("commission");
    setError(null);
    setSuccess(null);
    try {
      const commissionId = await createOrgRecord("financeCommissions", {
        amount,
        approvalStatus: "pendingApproval",
        basis: commissionForm.basis.trim(),
        beneficiaryName: commissionForm.beneficiaryName.trim(),
        dueAt: commissionForm.dueAt,
        sourceId,
        sourceReference: source.reference ?? "",
        sourceType: source.type,
        status: "active",
      }, context, "COM");
      await writeAuditLog(context, "finance.commission.create", "financeCommissions", commissionId, { amount, sourceId, sourceType: source.type });
      setCommissionForm((current) => ({ ...current, amount: "", basis: "", beneficiaryName: "" }));
      setSuccess("Commission recorded and queued for approval.");
      await loadFinance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to record commission.");
    } finally {
      setSaving(null);
    }
  }

  async function syncRentalPaymentVerification(payment: FinancePayment, verificationStatus: PaymentVerificationStatus) {
    const rental = rentals.find((item) => item.id === payment.tenancyId);
    if (!rental || !context) {
      return;
    }

    const paymentHistory = Array.isArray(rental.paymentHistory) ? rental.paymentHistory : [];
    const nextHistory = paymentHistory.map((entry) => {
      if (entry.paymentId === payment.id || entry.receiptNumber === payment.receiptNumber) {
        return { ...entry, verificationStatus };
      }
      return entry;
    });
    const nextTotal = paymentTotal(nextHistory);
    const nextPaymentStatus = nextTotal <= 0 ? "notInvoiced" : nextTotal >= Number(rental.rentAmount ?? 0) ? "paid" : "partPaid";
    await updateOrgRecord("rentalTenancies", rental.id, { paymentHistory: nextHistory, paymentStatus: nextPaymentStatus }, context);
  }

  async function syncDealPaymentSummary(dealId: string, nextPayments: FinancePayment[]) {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal || !context || !canUpdateDeal) {
      return;
    }

    const dealPayments = nextPayments.filter((payment) => payment.sourceType === "deal" && payment.sourceId === dealId);
    const summary = dealPaymentSummary(dealTargetAmount(deal), dealPayments);
    const latestPayment = dealPayments
      .slice()
      .sort((a, b) => sortByDateDesc(a.at, b.at))[0];

    await updateOrgRecord("deals", deal.id, {
      balanceAmount: summary.balanceAmount,
      financeStatus: summary.financeStatus,
      lastPaymentAmount: latestPayment ? Number(latestPayment.amount ?? 0) : 0,
      lastPaymentAt: latestPayment?.at ?? "",
      lastReceiptNumber: latestPayment?.receiptNumber ?? "",
      paidAmount: summary.paidAmount,
      pendingPaymentAmount: summary.pendingPaymentAmount,
    }, context);
  }

  async function updateFinanceAction(collectionName: FinanceActionCollection, id: string, payload: Record<string, unknown>, label: string) {
    if (!context) {
      setError("You must be signed in to update finance records.");
      return;
    }

    setSaving(`${collectionName}:${id}`);
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord(collectionName, id, payload, context);
      await writeAuditLog(context, `finance.${collectionName}.update`, collectionName, id, payload);
      setSuccess(label);
      await loadFinance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update finance record.");
    } finally {
      setSaving(null);
    }
  }

  async function verifyPayment(payment: FinancePayment, verificationStatus: PaymentVerificationStatus) {
    if (!context) {
      setError("You must be signed in to verify payments.");
      return;
    }

    const payload: Record<string, unknown> = verificationStatus === "verified"
      ? { verificationStatus, verifiedAt: new Date().toISOString(), verifiedBy: context.userId }
      : { rejectionReason: "Rejected from finance workspace.", rejectedAt: new Date().toISOString(), rejectedBy: context.userId, verificationStatus };
    setSaving(`financePayments:${payment.id}`);
    setError(null);
    setSuccess(null);
    try {
      await updateOrgRecord("financePayments", payment.id, payload, context);
      await writeAuditLog(context, "finance.financePayments.update", "financePayments", payment.id, payload);
      const nextPayment = { ...payment, ...payload };
      const nextPayments = payments.map((item) => (item.id === payment.id ? nextPayment : item));
      await syncRentalPaymentVerification(nextPayment, verificationStatus);
      if (payment.sourceType === "deal") {
        await syncDealPaymentSummary(payment.sourceId, nextPayments);
      }
      setSuccess(`Receipt ${payment.receiptNumber} ${verificationStatus}.`);
      await loadFinance();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update finance record.");
    } finally {
      setSaving(null);
    }
  }

  async function setApproval(collectionName: "financeExpenses" | "financeCommissions", id: string, status: FinanceApprovalStatus) {
    if (!context) {
      setError("You must be signed in to update approvals.");
      return;
    }

    const timestamp = new Date().toISOString();
    const payload = status === "approved"
      ? { approvalStatus: status, approvedAt: timestamp, approvedBy: context.userId }
      : status === "paid"
        ? { approvalStatus: status, paidAt: timestamp, paidBy: context.userId }
        : { approvalStatus: status, rejectedAt: timestamp, rejectedBy: context.userId, rejectionReason: "Rejected from finance workspace." };
    await updateFinanceAction(collectionName, id, payload, `Finance record marked ${approvalLabel(status)}.`);
  }

  if (!canReadFinance) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading finance workspace" />;
  }

  const metricCards = [
    { icon: CheckCircle2, label: "Total verified revenue", tone: "text-success", value: formatCurrency(finance.verifiedCollected) },
    { icon: Receipt, label: "Pipeline receipts", tone: "text-warning", value: formatCurrency(finance.dealCollected) },
    { icon: Banknote, label: "Rent collected", tone: "text-primary", value: formatCurrency(finance.rentCollected) },
    { icon: WalletCards, label: "Sales collected", tone: "text-info", value: formatCurrency(finance.salesCollected) },
    { icon: ShieldCheck, label: "Pending approvals", tone: "text-warning", value: String(finance.pendingApprovals) },
  ];

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Finance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify rent, property sale, unit sale, and other income receipts alongside expenses and commissions.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:mt-0 md:flex">
          <ButtonLink href="/rentals" variant="outline">Rental ledger</ButtonLink>
          <ButtonLink href="/reports" variant="secondary">Reports</ButtonLink>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {success ? <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">{success}</div> : null}

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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Create Payment Receipt</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitPayment}>
              <Field label="Revenue source">
                <Select disabled={!canCreateFinance} value={paymentForm.source} onChange={(event) => {
                  const source = revenueSources.find((item) => item.value === event.target.value);
                  setPaymentForm((current) => ({
                    ...current,
                    amount: source?.amount ? String(source.amount) : current.amount,
                    payerName: source?.payerName ?? current.payerName,
                    source: event.target.value,
                  }));
                }}>
                  <option value="">Select revenue source</option>
                  {revenueSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </Select>
              </Field>
              <Field label="Payer name">
                <Input disabled={!canCreateFinance} value={paymentForm.payerName} onChange={(event) => setPaymentForm((current) => ({ ...current, payerName: event.target.value }))} />
              </Field>
              <Field label="Amount">
                <Input disabled={!canCreateFinance} min={0} type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
              </Field>
              <Field label="Payment date">
                <Input disabled={!canCreateFinance} type="date" value={paymentForm.at} onChange={(event) => setPaymentForm((current) => ({ ...current, at: event.target.value }))} />
              </Field>
              <Field label="Method">
                <Select disabled={!canCreateFinance} value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as RentalPaymentMethod }))}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{titleCase(method)}</option>)}
                </Select>
              </Field>
              <Field label="Bank/reference">
                <Input disabled={!canCreateFinance} value={paymentForm.paymentReference} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentReference: event.target.value }))} />
              </Field>
              <Field label="Note">
                <Textarea disabled={!canCreateFinance} value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} />
              </Field>
              <Button className="h-11" disabled={!canCreateFinance || saving === "payment"} type="submit">
                <Receipt className="h-4 w-4" />
                {saving === "payment" ? "Creating" : "Create receipt"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Record Expense</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitExpense}>
              <Field label="Category">
                <Select disabled={!canCreateFinance} value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}>
                  {expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </Select>
              </Field>
              <Field label="Amount">
                <Input disabled={!canCreateFinance} min={0} type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} />
              </Field>
              <Field label="Date">
                <Input disabled={!canCreateFinance} type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))} />
              </Field>
              <Field label="Vendor">
                <Input disabled={!canCreateFinance} value={expenseForm.vendor} onChange={(event) => setExpenseForm((current) => ({ ...current, vendor: event.target.value }))} />
              </Field>
              <Field label="Related type">
                <Select disabled={!canCreateFinance} value={expenseForm.relatedEntityType} onChange={(event) => setExpenseForm((current) => ({ ...current, relatedEntityType: event.target.value }))}>
                  {relatedEntityTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </Select>
              </Field>
              <Field label="Related record ID">
                <Input disabled={!canCreateFinance} value={expenseForm.relatedEntityId} onChange={(event) => setExpenseForm((current) => ({ ...current, relatedEntityId: event.target.value }))} />
              </Field>
              <Field label="Description">
                <Textarea disabled={!canCreateFinance} value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Button className="h-11" disabled={!canCreateFinance || saving === "expense"} type="submit" variant="secondary">
                <WalletCards className="h-4 w-4" />
                {saving === "expense" ? "Recording" : "Record expense"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Track Commission</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitCommission}>
              <Field label="Source">
                <Select disabled={!canCreateFinance} value={commissionForm.source} onChange={(event) => {
                  const source = commissionSources.find((item) => item.value === event.target.value);
                  setCommissionForm((current) => ({ ...current, amount: source?.amount ? String(source.amount) : current.amount, source: event.target.value }));
                }}>
                  <option value="">Select source</option>
                  {commissionSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </Select>
              </Field>
              <Field label="Beneficiary">
                <Input disabled={!canCreateFinance} value={commissionForm.beneficiaryName} onChange={(event) => setCommissionForm((current) => ({ ...current, beneficiaryName: event.target.value }))} />
              </Field>
              <Field label="Amount">
                <Input disabled={!canCreateFinance} min={0} type="number" value={commissionForm.amount} onChange={(event) => setCommissionForm((current) => ({ ...current, amount: event.target.value }))} />
              </Field>
              <Field label="Due date">
                <Input disabled={!canCreateFinance} type="date" value={commissionForm.dueAt} onChange={(event) => setCommissionForm((current) => ({ ...current, dueAt: event.target.value }))} />
              </Field>
              <Field label="Basis">
                <Textarea disabled={!canCreateFinance} value={commissionForm.basis} onChange={(event) => setCommissionForm((current) => ({ ...current, basis: event.target.value }))} />
              </Field>
              <Button className="h-11" disabled={!canCreateFinance || saving === "commission"} type="submit" variant="outline">
                <Scale className="h-4 w-4" />
                {saving === "commission" ? "Recording" : "Record commission"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Payment Verification</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Receipts are numbered and remain pending until finance approval verifies the payment.</p>
            </div>
            <Badge tone={finance.pendingCollected ? "warning" : "success"}>{formatCurrency(finance.pendingCollected)} pending</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {finance.sortedPayments.slice(0, 8).map((payment) => (
              <div className="rounded-md border p-3" key={payment.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <Link className="font-semibold text-primary hover:underline" href={`/finance/receipts/${payment.id}`}>{payment.receiptNumber}</Link>
                    <p className="mt-1 text-muted-foreground">{payment.payerName ?? payment.tenantName ?? "Payer"} · {displayDate(payment.at)} · {titleCase(payment.method)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{titleCase(payment.sourceType ?? "rental")} · {payment.sourceReference || payment.tenancyReference || payment.tenancyId || payment.sourceId}{payment.paymentReference ? ` · ${payment.paymentReference}` : ""}</p>
                  </div>
                  <div className="grid gap-1 lg:text-right">
                    <span className="font-semibold">{formatCurrency(Number(payment.amount ?? 0))}</span>
                    <Badge tone={approvalTone(payment.verificationStatus)}>{approvalLabel(payment.verificationStatus)}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={`/finance/receipts/${payment.id}`} size="sm" variant="outline"><Printer className="h-4 w-4" />Print</ButtonLink>
                  {canApproveFinance && payment.verificationStatus === "pending" ? (
                    <>
                      <Button disabled={saving === `financePayments:${payment.id}`} onClick={() => void verifyPayment(payment, "verified")} size="sm" type="button" variant="secondary">
                        <ClipboardCheck className="h-4 w-4" />Verify
                      </Button>
                      <Button disabled={saving === `financePayments:${payment.id}`} onClick={() => void verifyPayment(payment, "rejected")} size="sm" type="button" variant="danger">
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!finance.sortedPayments.length ? <div className="rounded-md border border-dashed p-4 text-muted-foreground">No finance receipts yet.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment Queue</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[...finance.overdueRentals, ...finance.upcomingRentals].slice(0, 8).map((rental) => {
              const dueDays = daysUntil(rental.nextRentDueDate);
              const overdue = isOverdue(rental);
              return (
                <Link className="rounded-md border p-3 text-foreground hover:bg-muted" href={`/rentals/${rental.id}`} key={rental.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{String(rental.tenantName ?? rental.referenceNumber ?? "Tenant")}</p>
                      <p className="mt-1 truncate text-muted-foreground">{String(rental.unitName ?? rental.propertyName ?? "No property linked")}</p>
                    </div>
                    <span className="font-semibold">{formatCurrency(rentalBalance(rental))}</span>
                  </div>
                  <p className={cn("mt-2 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                    {displayDate(rental.nextRentDueDate)}{dueDays === null ? "" : dueDays < 0 ? ` · ${Math.abs(dueDays)} days overdue` : ` · ${dueDays} days left`}
                  </p>
                </Link>
              );
            })}
            {!finance.overdueRentals.length && !finance.upcomingRentals.length ? <div className="rounded-md border border-dashed p-4 text-muted-foreground">No overdue or upcoming rent payments in the next 30 days.</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Expense Approvals</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {finance.sortedExpenses.slice(0, 8).map((expense) => (
              <div className="rounded-md border p-3" key={expense.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{expense.category}{expense.vendor ? ` · ${expense.vendor}` : ""}</p>
                    <p className="mt-1 text-muted-foreground">{displayDate(expense.date)}{expense.description ? ` · ${expense.description}` : ""}</p>
                  </div>
                  <div className="grid gap-1 sm:text-right">
                    <span className="font-semibold">{formatCurrency(Number(expense.amount ?? 0))}</span>
                    <Badge tone={approvalTone(expense.approvalStatus)}>{approvalLabel(expense.approvalStatus)}</Badge>
                  </div>
                </div>
                {canApproveFinance && expense.approvalStatus === "pendingApproval" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={saving === `financeExpenses:${expense.id}`} onClick={() => void setApproval("financeExpenses", expense.id, "approved")} size="sm" type="button" variant="secondary">Approve</Button>
                    <Button disabled={saving === `financeExpenses:${expense.id}`} onClick={() => void setApproval("financeExpenses", expense.id, "rejected")} size="sm" type="button" variant="danger">Reject</Button>
                  </div>
                ) : canApproveFinance && expense.approvalStatus === "approved" ? (
                  <div className="mt-3"><Button disabled={saving === `financeExpenses:${expense.id}`} onClick={() => void setApproval("financeExpenses", expense.id, "paid")} size="sm" type="button" variant="outline">Mark paid</Button></div>
                ) : null}
              </div>
            ))}
            {!finance.sortedExpenses.length ? <div className="rounded-md border border-dashed p-4 text-muted-foreground">No expenses have been recorded.</div> : null}
            <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground">Approved expenses: {formatCurrency(finance.approvedExpenses)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Commission Approvals</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {finance.sortedCommissions.slice(0, 8).map((commission) => (
              <div className="rounded-md border p-3" key={commission.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{commission.beneficiaryName}</p>
                    <p className="mt-1 text-muted-foreground">{titleCase(commission.sourceType)} · {commission.sourceReference || commission.sourceId}</p>
                    {commission.basis ? <p className="mt-1 text-muted-foreground">{commission.basis}</p> : null}
                  </div>
                  <div className="grid gap-1 sm:text-right">
                    <span className="font-semibold">{formatCurrency(Number(commission.amount ?? 0))}</span>
                    <Badge tone={approvalTone(commission.approvalStatus)}>{approvalLabel(commission.approvalStatus)}</Badge>
                  </div>
                </div>
                {canApproveFinance && commission.approvalStatus === "pendingApproval" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={saving === `financeCommissions:${commission.id}`} onClick={() => void setApproval("financeCommissions", commission.id, "approved")} size="sm" type="button" variant="secondary">Approve</Button>
                    <Button disabled={saving === `financeCommissions:${commission.id}`} onClick={() => void setApproval("financeCommissions", commission.id, "rejected")} size="sm" type="button" variant="danger">Reject</Button>
                  </div>
                ) : canApproveFinance && commission.approvalStatus === "approved" ? (
                  <div className="mt-3"><Button disabled={saving === `financeCommissions:${commission.id}`} onClick={() => void setApproval("financeCommissions", commission.id, "paid")} size="sm" type="button" variant="outline">Mark paid</Button></div>
                ) : null}
              </div>
            ))}
            {!finance.sortedCommissions.length ? <div className="rounded-md border border-dashed p-4 text-muted-foreground">No commissions have been tracked.</div> : null}
            <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground">Approved commission payable: {formatCurrency(finance.commissionPayable)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Finance Controls</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            {[
            { icon: Receipt, label: "Receipts", value: `${finance.sortedPayments.length} numbered receipts across rent, sales, and other income.` },
            { icon: FileText, label: "Expenses", value: `${finance.sortedExpenses.length} expenses, ${formatCurrency(finance.approvedExpenses)} approved.` },
            { icon: Scale, label: "Commissions", value: `${finance.sortedCommissions.length} commission records, ${formatCurrency(finance.commissionPayable)} payable.` },
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
    </section>
  );
}
