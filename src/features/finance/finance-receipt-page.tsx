"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import { approvalTone } from "@/features/finance/finance-utils";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { getOrgRecord } from "@/services/repository";
import type { FinancePayment } from "@/types/crm";

function displayDate(value: string) {
  return value ? formatDate(value) : "Not set";
}

export function FinanceReceiptPage({ paymentId }: { paymentId: string }) {
  const { activeOrganizationId, member } = useAuth();
  const [payment, setPayment] = useState<FinancePayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayment(await getOrgRecord<FinancePayment>(activeOrganizationId, "financePayments", paymentId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, paymentId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPayment();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadPayment]);

  if (!hasPermission(member, "reports.viewFinancial")) {
    return <PermissionDenied />;
  }

  if (loading) {
    return <LoadingState label="Loading receipt" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!payment) {
    return <ErrorState message="Receipt was not found." />;
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary" href="/finance">
          <ArrowLeft className="h-4 w-4" />
          Back to finance
        </Link>
        <Button onClick={() => window.print()} type="button">
          <Printer className="h-4 w-4" />
          Print receipt
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-3xl print:border-0 print:shadow-none">
        <CardContent className="grid gap-8 p-6 sm:p-8">
          <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Payment Receipt</p>
              <h1 className="mt-2 text-3xl font-semibold">{payment.receiptNumber}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{payment.referenceNumber}</p>
            </div>
            <Badge className="w-fit" tone={approvalTone(payment.verificationStatus)}>{titleCase(payment.verificationStatus)}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Received from</p>
              <p className="mt-2 text-lg font-semibold">{payment.payerName ?? payment.tenantName ?? "Payer"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{payment.propertyName || "Property not set"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{titleCase(payment.sourceType ?? "rental")} · {payment.sourceReference || payment.tenancyReference || payment.tenancyId || payment.sourceId}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Amount</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(Number(payment.amount ?? 0))}</p>
              <p className="mt-1 text-sm text-muted-foreground">{displayDate(payment.at)}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">Method</p>
              <p className="mt-1 text-muted-foreground">{titleCase(payment.method)}</p>
            </div>
            <div>
              <p className="font-medium">Reference</p>
              <p className="mt-1 text-muted-foreground">{payment.paymentReference || "Not provided"}</p>
            </div>
            <div>
              <p className="font-medium">Revenue source</p>
              <p className="mt-1 text-muted-foreground">{titleCase(payment.sourceType ?? "rental")}</p>
            </div>
            <div>
              <p className="font-medium">Verification</p>
              <p className="mt-1 text-muted-foreground">{titleCase(payment.verificationStatus)}</p>
            </div>
            <div>
              <p className="font-medium">Verified by</p>
              <p className="mt-1 text-muted-foreground">{payment.verifiedBy || "Pending"}</p>
            </div>
          </div>

          {payment.note ? (
            <div>
              <p className="text-sm font-medium">Note</p>
              <p className="mt-2 rounded-md border p-4 text-sm text-muted-foreground">{payment.note}</p>
            </div>
          ) : null}

          <div className="border-t pt-6 text-xs text-muted-foreground">
            This receipt was generated from Beacon Ops CRM finance records and is valid with the verification status shown above.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
