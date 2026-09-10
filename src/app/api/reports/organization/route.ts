import { NextResponse } from "next/server";
import { canAccessAllBranches, hasOrganizationReportAccess } from "@/lib/permissions";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { firebaseAdminRecovery } from "@/lib/firebase/admin-errors";
import type { Member } from "@/types/crm";
import type {
  OrganizationReport,
  ReportBreakdownRow,
} from "@/features/reports/organization-report-types";
import {
  saleLineAmount,
  scopePurchase,
  scopeSale,
} from "@/features/reports/organization-report-utils";

export const runtime = "nodejs";

type RecordData = FirebaseFirestore.DocumentData & { id: string };

function requestToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function reportDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+01:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate() as Date;
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function withinRange(
  record: RecordData,
  start: Date,
  end: Date,
  fields: string[],
) {
  const date = fields
    .map((field) => dateValue(record[field]))
    .find((value): value is Date => Boolean(value));
  return Boolean(date && date >= start && date <= end);
}

async function activeRecords(organizationId: string, collectionName: string) {
  const snapshot = await adminDb
    .collection(`organizations/${organizationId}/${collectionName}`)
    .get();
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as RecordData)
    .filter((item) => item.isDeleted !== true);
}

function branchMatches(record: RecordData, branchId: string) {
  if (!branchId) return true;
  return [record.branchId, record.fromBranchId, record.toBranchId].includes(
    branchId,
  );
}

function countRows(records: RecordData[], field: string): ReportBreakdownRow[] {
  const totals = records.reduce<Record<string, number>>((result, record) => {
    const label = String(record[field] ?? "Not set");
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function sum(records: RecordData[], field: string) {
  return records.reduce((total, record) => total + Number(record[field] ?? 0), 0);
}

function labelTotals(values: Array<{ label: string; value: number }>) {
  const totals = values.reduce<Record<string, number>>((result, item) => {
    result[item.label] = (result[item.label] ?? 0) + item.value;
    return result;
  }, {});
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function GET(request: Request) {
  try {
    const token = requestToken(request);
    if (!token)
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 },
      );
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    const dateFrom = url.searchParams.get("from") ?? "";
    const dateTo = url.searchParams.get("to") ?? "";
    const requestedBranchId = url.searchParams.get("branchId")?.trim() ?? "";
    const brandId = url.searchParams.get("brandId")?.trim() ?? "";
    const start = reportDate(dateFrom);
    const end = reportDate(dateTo, true);
    if (!organizationId || !start || !end || start > end)
      return NextResponse.json(
        { error: "Organization and a valid report date range are required." },
        { status: 400 },
      );

    const decoded = await adminAuth.verifyIdToken(token);
    const memberSnapshot = await adminDb
      .doc(`organizations/${organizationId}/members/${decoded.uid}`)
      .get();
    const member = memberSnapshot.exists
      ? ({ id: memberSnapshot.id, ...memberSnapshot.data() } as Member)
      : null;
    if (!member || member.status !== "active" || !hasOrganizationReportAccess(member))
      return NextResponse.json(
        { error: "Your role does not include organization reporting." },
        { status: 403 },
      );

    const allBranchAccess = canAccessAllBranches(member);
    if (
      requestedBranchId &&
      requestedBranchId !== "all" &&
      !allBranchAccess &&
      requestedBranchId !== member.branchId
    )
      return NextResponse.json(
        { error: "You cannot report on that branch." },
        { status: 403 },
      );
    const branchId =
      requestedBranchId === "all" && allBranchAccess
        ? ""
        : requestedBranchId && requestedBranchId !== "all"
          ? requestedBranchId
          : member.branchId;

    const [
      branches,
      brands,
      offerings,
      balances,
      movements,
      sales,
      purchases,
      payments,
      expenses,
      projects,
      leads,
      clients,
      deals,
      tasks,
    ] = await Promise.all([
      activeRecords(organizationId, "branches"),
      activeRecords(organizationId, "inventoryBrands"),
      activeRecords(organizationId, "offerings"),
      activeRecords(organizationId, "inventoryBalances"),
      activeRecords(organizationId, "inventoryMovements"),
      activeRecords(organizationId, "posSales"),
      activeRecords(organizationId, "inventoryPurchaseOrders"),
      activeRecords(organizationId, "financePayments"),
      activeRecords(organizationId, "financeExpenses"),
      activeRecords(organizationId, "installationProjects"),
      activeRecords(organizationId, "leads"),
      activeRecords(organizationId, "clients"),
      activeRecords(organizationId, "deals"),
      activeRecords(organizationId, "tasks"),
    ]);

    const branchName = new Map(
      branches.map((branch) => [branch.id, String(branch.name ?? branch.id)]),
    );
    const brandName = new Map(
      brands.map((brand) => [brand.id, String(brand.name ?? brand.id)]),
    );
    const offeringById = new Map(offerings.map((item) => [item.id, item]));
    const scopedBalances = balances.filter(
      (record) => branchMatches(record, branchId) && (!brandId || record.brandId === brandId),
    );
    const scopedMovements = movements.filter(
      (record) =>
        branchMatches(record, branchId) &&
        (!brandId || record.brandId === brandId) &&
        withinRange(record, start, end, ["occurredAt", "createdAt"]),
    );
    const scopedSales = sales
      .filter(
        (record) =>
          record.saleStatus === "completed" &&
          branchMatches(record, branchId) &&
          withinRange(record, start, end, ["soldAt", "createdAt"]),
      )
      .map((sale) => ({ sale, scoped: scopeSale(sale, brandId) }))
      .filter((entry) => Boolean(entry.scoped)) as Array<{
      sale: RecordData;
      scoped: NonNullable<ReturnType<typeof scopeSale>>;
    }>;
    const scopedPurchases = purchases
      .filter(
        (record) =>
          !["cancelled", "rejected"].includes(String(record.approvalStatus)) &&
          branchMatches(record, branchId) &&
          withinRange(record, start, end, ["createdAt"]),
      )
      .map((order) => ({ order, scoped: scopePurchase(order, brandId) }))
      .filter((entry) => Boolean(entry.scoped)) as Array<{
      order: RecordData;
      scoped: NonNullable<ReturnType<typeof scopePurchase>>;
    }>;
    const scopedPayments = payments.filter(
      (record) =>
        record.verificationStatus === "verified" &&
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["at", "createdAt"]),
    );
    const scopedExpenses = expenses.filter(
      (record) =>
        ["approved", "paid"].includes(String(record.approvalStatus)) &&
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["date", "createdAt"]),
    );
    const scopedProjects = projects.filter(
      (record) =>
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["startDate", "createdAt"]) &&
        (!brandId ||
          (Array.isArray(record.materials) &&
            record.materials.some(
              (line: RecordData) => line.brandId === brandId,
            ))),
    );
    const scopedLeads = leads.filter(
      (record) =>
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["createdAt"]),
    );
    const scopedClients = clients.filter(
      (record) =>
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["createdAt"]),
    );
    const scopedDeals = deals.filter(
      (record) =>
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["createdAt"]),
    );
    const scopedTasks = tasks.filter(
      (record) =>
        branchMatches(record, branchId) &&
        withinRange(record, start, end, ["completedAt", "updatedAt", "createdAt"]),
    );

    const salesRevenue = scopedSales.reduce(
      (total, entry) => total + entry.scoped.revenue,
      0,
    );
    const salesCost = scopedSales.reduce(
      (total, entry) => total + entry.scoped.cost,
      0,
    );
    const unitsSold = scopedSales.reduce(
      (total, entry) =>
        total +
        entry.scoped.lines.reduce(
          (lineTotal, line) => lineTotal + Number(line.quantity ?? 0),
          0,
        ),
      0,
    );
    const inventoryOnHand = sum(scopedBalances, "quantityOnHand");
    const inventoryReserved = sum(scopedBalances, "quantityReserved");
    const inventoryValue = scopedBalances.reduce((total, balance) => {
      const offering = offeringById.get(String(balance.offeringId));
      return (
        total +
        Number(balance.quantityOnHand ?? 0) * Number(offering?.costPrice ?? 0)
      );
    }, 0);
    const availableByOffering = scopedBalances.reduce<Record<string, number>>(
      (result, balance) => {
        const id = String(balance.offeringId);
        result[id] =
          (result[id] ?? 0) +
          Number(balance.quantityOnHand ?? 0) -
          Number(balance.quantityReserved ?? 0);
        return result;
      },
      {},
    );
    const purchaseValue = scopedPurchases.reduce(
      (total, entry) => total + entry.scoped.amount,
      0,
    );
    const purchasePaid = scopedPurchases.reduce(
      (total, entry) => total + entry.scoped.paid,
      0,
    );
    const supplierRows = new Map<
      string,
      OrganizationReport["rows"]["suppliers"][number]
    >();
    for (const entry of scopedPurchases) {
      const label = String(entry.order.supplierName ?? "Supplier");
      const row = supplierRows.get(label) ?? {
        label,
        orderValue: 0,
        outstanding: 0,
        paid: 0,
      };
      row.orderValue += entry.scoped.amount;
      row.paid += entry.scoped.paid;
      row.outstanding += Math.max(0, entry.scoped.amount - entry.scoped.paid);
      supplierRows.set(label, row);
    }
    const productRows = new Map<
      string,
      OrganizationReport["rows"]["topProducts"][number]
    >();
    for (const entry of scopedSales) {
      const scopedLineValue = entry.scoped.lines.reduce(
        (total, line) => total + saleLineAmount(line),
        0,
      );
      for (const line of entry.scoped.lines) {
        const id = String(line.offeringId ?? line.offeringName ?? "Product");
        const row = productRows.get(id) ?? {
          label: String(line.offeringName ?? "Product"),
          quantity: 0,
          revenue: 0,
        };
        row.quantity += Number(line.quantity ?? 0);
        row.revenue +=
          entry.scoped.revenue *
          (scopedLineValue > 0 ? saleLineAmount(line) / scopedLineValue : 0);
        productRows.set(id, row);
      }
    }
    const projectRows = scopedProjects.map((project) => {
      const materialCost = (Array.isArray(project.materials)
        ? project.materials
        : []
      ).reduce(
        (total: number, line: RecordData) =>
          total +
          Number(line.quantityRequired ?? 0) *
            Number(line.estimatedUnitCost ?? 0),
        0,
      );
      const otherCost = (Array.isArray(project.costLines)
        ? project.costLines
        : []
      ).reduce(
        (total: number, line: RecordData) =>
          total +
          Number(
            line.actualAmount ??
              Number(line.quantity ?? 0) * Number(line.estimatedUnitCost ?? 0),
          ),
        0,
      );
      const contractValue = Number(project.contractValue ?? 0);
      const estimatedCost = materialCost + otherCost;
      return {
        contractValue,
        estimatedCost,
        label: String(project.name ?? project.referenceNumber ?? "Project"),
        margin: contractValue - estimatedCost,
        received: Number(project.amountReceived ?? 0),
        status: String(project.status ?? "notSet"),
      };
    });
    const paidExpenses = scopedExpenses
      .filter((record) => record.approvalStatus === "paid")
      .reduce((total, record) => total + Number(record.amount ?? 0), 0);
    const cashCollected = sum(scopedPayments, "amount");
    const now = new Date();

    const report: OrganizationReport = {
      breakdowns: {
        crmStatus: countRows(scopedLeads, "status"),
        documentBrandSales: labelTotals(
          scopedSales.map((entry) => ({
            label:
              entry.sale.documentBrand === "kadaBuildersMart"
                ? "Kada Builders Mart"
                : "Vlingo Systems",
            value: entry.scoped.revenue,
          })),
        ),
        inventoryByBrand: labelTotals(
          scopedBalances.map((balance) => ({
            label: String(
              balance.brandName ?? brandName.get(String(balance.brandId)) ?? "Unbranded",
            ),
            value: Number(balance.quantityOnHand ?? 0),
          })),
        ),
        projectStatus: countRows(scopedProjects, "status"),
        purchasePaymentStatus: labelTotals(
          scopedPurchases.map((entry) => ({
            label: String(entry.order.paymentStatus ?? "unpaid"),
            value: entry.scoped.amount,
          })),
        ),
        purchaseReceivingStatus: countRows(
          scopedPurchases.map((entry) => entry.order),
          "receivingStatus",
        ),
        salesByBrand: labelTotals(
          scopedSales.flatMap((entry) => {
            const scopedLineValue = entry.scoped.lines.reduce(
              (total, line) => total + saleLineAmount(line),
              0,
            );
            return entry.scoped.lines.map((line) => ({
              label: String(
                line.brandName ?? brandName.get(String(line.brandId)) ?? "Unbranded",
              ),
              value:
                entry.scoped.revenue *
                (scopedLineValue > 0
                  ? saleLineAmount(line) / scopedLineValue
                  : 0),
            }));
          }),
        ),
      },
      filters: {
        branchId: branchId || "all",
        brandId: brandId || "all",
        dateFrom,
        dateTo,
      },
      generatedAt: new Date().toISOString(),
      limitations: [
        "Inventory balances and valuation are the current position; the selected dates apply to movements and other activity.",
        ...(brandId
          ? [
              "Finance, CRM, and whole-project totals remain branch-and-date scoped because those records are not consistently tagged by product brand. A linked installation project's full contract and cost are included when it contains the selected brand.",
            ]
          : []),
      ],
      rows: {
        branches: (branchId
          ? branches.filter((branch) => branch.id === branchId)
          : branches
        )
          .filter((branch) => branch.status !== "closed")
          .map((branch) => {
            const id = branch.id;
            return {
              cashCollected: scopedPayments
                .filter((item) => item.branchId === id)
                .reduce((total, item) => total + Number(item.amount ?? 0), 0),
              inventoryOnHand: scopedBalances
                .filter((item) => item.branchId === id)
                .reduce(
                  (total, item) => total + Number(item.quantityOnHand ?? 0),
                  0,
                ),
              label: branchName.get(id) ?? id,
              purchaseValue: scopedPurchases
                .filter((item) => item.order.branchId === id)
                .reduce((total, item) => total + item.scoped.amount, 0),
              salesRevenue: scopedSales
                .filter((item) => item.sale.branchId === id)
                .reduce((total, item) => total + item.scoped.revenue, 0),
            };
          }),
        projects: projectRows.sort((a, b) => b.contractValue - a.contractValue),
        suppliers: Array.from(supplierRows.values()).sort(
          (a, b) => b.outstanding - a.outstanding,
        ),
        topProducts: Array.from(productRows.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
      },
      scopeLabel: `${
        branchId ? branchName.get(branchId) ?? "Selected branch" : "All branches"
      } · ${brandId ? brandName.get(brandId) ?? "Selected brand" : "All brands"}`,
      summary: {
        activeClients: scopedClients.filter((item) => item.status === "active").length,
        cashCollected,
        completedTasks: scopedTasks.filter((item) => item.status === "completed").length,
        completedProjects: scopedProjects.filter((item) => item.status === "completed").length,
        financeExpenses: sum(scopedExpenses, "amount"),
        grossProfit: salesRevenue - salesCost,
        inventoryAvailable: inventoryOnHand - inventoryReserved,
        inventoryLowStockItems: Object.entries(availableByOffering).filter(
          ([id, available]) => {
            const reorder = Number(offeringById.get(id)?.reorderLevel ?? 0);
            return reorder > 0 && available <= reorder;
          },
        ).length,
        inventoryMovements: scopedMovements.length,
        inventoryOnHand,
        inventoryReserved,
        inventoryValue,
        netCashFlow: cashCollected - paidExpenses,
        openPipelineValue: scopedDeals
          .filter((item) => !["won", "lost"].includes(String(item.status)))
          .reduce(
            (total, item) =>
              total +
              Number(item.agreedAmount ?? item.quoteTotal ?? item.offerAmount ?? 0),
            0,
          ),
        outstandingSales: scopedSales.reduce(
          (total, entry) =>
            total +
            Number(entry.sale.balanceDue ?? 0) *
              (Number(entry.sale.totalAmount ?? 0) > 0
                ? entry.scoped.revenue / Number(entry.sale.totalAmount)
                : 0),
          0,
        ),
        overdueSupplierBalance: scopedPurchases
          .filter((entry) => {
            const due = dateValue(entry.order.paymentDueAt);
            return due && due < now && entry.scoped.amount > entry.scoped.paid;
          })
          .reduce(
            (total, entry) => total + entry.scoped.amount - entry.scoped.paid,
            0,
          ),
        paidExpenses,
        projectContractValue: projectRows.reduce(
          (total, item) => total + item.contractValue,
          0,
        ),
        projectEstimatedCost: projectRows.reduce(
          (total, item) => total + item.estimatedCost,
          0,
        ),
        projectEstimatedMargin: projectRows.reduce(
          (total, item) => total + item.margin,
          0,
        ),
        purchaseCount: scopedPurchases.length,
        purchaseOutstanding: Math.max(0, purchaseValue - purchasePaid),
        purchaseValue,
        salesCount: scopedSales.length,
        salesRevenue,
        unitsSold,
      },
    };
    return NextResponse.json(report);
  } catch (error) {
    const recovery = firebaseAdminRecovery(error, "Organization reports");
    if (recovery) return NextResponse.json(recovery, { status: 503 });
    console.error("[Organization report failed]", error);
    return NextResponse.json(
      { error: "Unable to generate organization reports right now." },
      { status: 503 },
    );
  }
}
