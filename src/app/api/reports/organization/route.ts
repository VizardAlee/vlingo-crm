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
  inventoryAvailabilityStatus,
  inventoryMovementDelta,
  normalizeReportScopeFilter,
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
    const brandId = normalizeReportScopeFilter(url.searchParams.get("brandId"));
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
    const scopedAllMovements = movements.filter(
      (record) =>
        branchMatches(record, branchId) &&
        (!brandId || record.brandId === brandId),
    );
    const scopedMovements = scopedAllMovements.filter((record) =>
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
    const inventoryItemRows = Array.from(
      scopedBalances.reduce<
        Map<string, OrganizationReport["rows"]["inventoryItems"][number]>
      >((rows, balance) => {
        const id = String(balance.offeringId);
        const offering = offeringById.get(id);
        const row = rows.get(id) ?? {
          available: 0,
          brand: String(
            balance.brandName ??
              brandName.get(String(balance.brandId)) ??
              offering?.brandName ??
              "Unbranded",
          ),
          category: String(offering?.category ?? "Not set"),
          costPrice: Number(offering?.costPrice ?? 0),
          label: String(
            balance.offeringName ?? offering?.name ?? "Inventory item",
          ),
          onHand: 0,
          reorderLevel:
            offering?.reorderLevel === undefined ||
            offering?.reorderLevel === null ||
            offering?.reorderLevel === ""
              ? null
              : Number(offering.reorderLevel),
          reserved: 0,
          sku: String(balance.sku ?? offering?.sku ?? ""),
          status: "inStock" as const,
          stockValue: 0,
          unitOfMeasure: String(offering?.unitOfMeasure ?? "unit"),
        };
        const onHand = Number(balance.quantityOnHand ?? 0);
        const reserved = Number(balance.quantityReserved ?? 0);
        row.onHand += onHand;
        row.reserved += reserved;
        row.available += onHand - reserved;
        row.stockValue += onHand * row.costPrice;
        rows.set(id, row);
        return rows;
      }, new Map()).values(),
    )
      .map((row) => ({
        ...row,
        status: inventoryAvailabilityStatus(row.available, row.reorderLevel),
      }))
      .sort(
        (left, right) =>
          ({ outOfStock: 0, lowStock: 1, inStock: 2 })[left.status] -
            ({ outOfStock: 0, lowStock: 1, inStock: 2 })[right.status] ||
          left.label.localeCompare(right.label),
      );
    const inventoryLocationRows = Array.from(
      scopedBalances.reduce<
        Map<
          string,
          OrganizationReport["rows"]["inventoryLocations"][number] & {
            itemIds: Set<string>;
          }
        >
      >((rows, balance) => {
        const locationId = String(balance.locationId ?? balance.branchId ?? "unknown");
        const offeringId = String(balance.offeringId);
        const offering = offeringById.get(offeringId);
        const onHand = Number(balance.quantityOnHand ?? 0);
        const reserved = Number(balance.quantityReserved ?? 0);
        const available = onHand - reserved;
        const row = rows.get(locationId) ?? {
          available: 0,
          branch: branchName.get(String(balance.branchId)) ?? String(balance.branchId),
          itemCount: 0,
          itemIds: new Set<string>(),
          label: String(balance.locationName ?? "Stock location"),
          lowStockItems: 0,
          onHand: 0,
          reserved: 0,
          stockValue: 0,
        };
        row.itemIds.add(offeringId);
        row.itemCount = row.itemIds.size;
        row.onHand += onHand;
        row.reserved += reserved;
        row.available += available;
        row.stockValue += onHand * Number(offering?.costPrice ?? 0);
        if (
          inventoryAvailabilityStatus(available, offering?.reorderLevel) !==
          "inStock"
        )
          row.lowStockItems += 1;
        rows.set(locationId, row);
        return rows;
      }, new Map()).values(),
    )
      .map((row) => ({
        available: row.available,
        branch: row.branch,
        itemCount: row.itemCount,
        label: row.label,
        lowStockItems: row.lowStockItems,
        onHand: row.onHand,
        reserved: row.reserved,
        stockValue: row.stockValue,
      }))
      .sort((left, right) => left.branch.localeCompare(right.branch));
    const inventoryMovementRows = [...scopedMovements]
      .sort((left, right) => {
        const leftDate = dateValue(left.occurredAt) ?? dateValue(left.createdAt);
        const rightDate = dateValue(right.occurredAt) ?? dateValue(right.createdAt);
        return Number(rightDate) - Number(leftDate);
      })
      .map((movement) => ({
        destination: String(movement.toLocationName ?? "-"),
        label: String(movement.offeringName ?? "Inventory item"),
        occurredAt:
          (dateValue(movement.occurredAt) ?? dateValue(movement.createdAt))?.toISOString() ??
          "",
        purpose: String(movement.movementPurpose ?? "other"),
        quantity: Number(movement.quantity ?? 0),
        referenceNumber: String(movement.referenceNumber ?? movement.id),
        source: String(movement.fromLocationName ?? "-"),
        type: String(movement.movementType ?? "movement"),
      }));
    const currentQuantityByOffering = scopedBalances.reduce<Record<string, number>>(
      (result, balance) => {
        const id = String(balance.offeringId);
        result[id] = (result[id] ?? 0) + Number(balance.quantityOnHand ?? 0);
        return result;
      },
      {},
    );
    const movementDate = (movement: RecordData) =>
      dateValue(movement.occurredAt) ?? dateValue(movement.createdAt);
    const futureMovements = scopedAllMovements.filter((movement) => {
      const date = movementDate(movement);
      return Boolean(date && date > end);
    });
    const reportOfferingIds = new Set<string>([
      ...Object.keys(currentQuantityByOffering),
      ...scopedAllMovements.map((movement) => String(movement.offeringId ?? "")),
      ...scopedSales.flatMap((entry) =>
        entry.scoped.lines.map((line) => String(line.offeringId ?? "")),
      ),
    ].filter(Boolean));
    const unitForOffering = (offeringId: string) =>
      String(offeringById.get(offeringId)?.unitOfMeasure ?? "unit");
    const labelForOffering = (offeringId: string) => {
      const movement = scopedAllMovements.find(
        (item) => String(item.offeringId) === offeringId,
      );
      return String(
        offeringById.get(offeringId)?.name ??
          movement?.offeringName ??
          "Inventory item",
      );
    };
    const brandForOffering = (offeringId: string) => {
      const movement = scopedAllMovements.find(
        (item) => String(item.offeringId) === offeringId,
      );
      const offering = offeringById.get(offeringId);
      return String(
        offering?.brandName ??
          movement?.brandName ??
          brandName.get(String(offering?.brandId ?? movement?.brandId)) ??
          "Unbranded",
      );
    };
    const movementsForOffering = (offeringId: string) =>
      scopedMovements.filter(
        (movement) => String(movement.offeringId) === offeringId,
      );
    const inventoryReconciliationRows = Array.from(reportOfferingIds)
      .map((offeringId) => {
        const period = movementsForOffering(offeringId);
        const periodDelta = period.reduce(
          (total, movement) => total + inventoryMovementDelta(movement, branchId),
          0,
        );
        const futureDelta = futureMovements
          .filter((movement) => String(movement.offeringId) === offeringId)
          .reduce(
            (total, movement) => total + inventoryMovementDelta(movement, branchId),
            0,
          );
        const closingQuantity =
          Number(currentQuantityByOffering[offeringId] ?? 0) - futureDelta;
        const openingQuantity = closingQuantity - periodDelta;
        let receipts = 0;
        let sales = 0;
        let transferIn = 0;
        let transferOut = 0;
        let adjustmentIn = 0;
        let adjustmentOut = 0;
        period.forEach((movement) => {
          const quantity = Number(movement.quantity ?? 0);
          const type = String(movement.movementType ?? "");
          const delta = inventoryMovementDelta(movement, branchId);
          if (type === "transfer") {
            if (!branchId) {
              transferIn += quantity;
              transferOut += quantity;
            } else {
              if (delta > 0) transferIn += delta;
              if (delta < 0) transferOut += Math.abs(delta);
            }
            return;
          }
          if (type === "receipt") receipts += Math.max(0, delta);
          else if (type === "issue" && movement.movementPurpose === "sale")
            sales += Math.abs(Math.min(0, delta || -quantity));
          else if (delta > 0) adjustmentIn += delta;
          else if (delta < 0) adjustmentOut += Math.abs(delta);
        });
        return {
          adjustmentIn,
          adjustmentOut,
          brand: brandForOffering(offeringId),
          closingQuantity,
          label: labelForOffering(offeringId),
          openingQuantity,
          receipts,
          sales,
          sku: String(offeringById.get(offeringId)?.sku ?? ""),
          transferIn,
          transferOut,
          unitOfMeasure: unitForOffering(offeringId),
        };
      })
      .filter((row) =>
        [
          row.openingQuantity,
          row.receipts,
          row.sales,
          row.transferIn,
          row.transferOut,
          row.adjustmentIn,
          row.adjustmentOut,
          row.closingQuantity,
        ].some((value) => Math.abs(value) > 0.000001),
      )
      .sort((left, right) => left.label.localeCompare(right.label));
    const inventoryOpeningStockRows = inventoryReconciliationRows
      .filter((row) => Math.abs(row.openingQuantity) > 0.000001)
      .map((row) => ({
        brand: row.brand,
        label: row.label,
        openingQuantity: row.openingQuantity,
        sku: row.sku,
        unitOfMeasure: row.unitOfMeasure,
      }));
    const inventoryReceiptRows = scopedMovements
      .filter((movement) => ["receipt", "adjustmentIn", "returnIn"].includes(String(movement.movementType)))
      .map((movement) => ({
        date: movementDate(movement)?.toISOString() ?? "",
        label: String(movement.offeringName ?? labelForOffering(String(movement.offeringId))),
        quantity: Number(movement.quantity ?? 0),
        referenceNumber: String(movement.externalReference ?? movement.referenceNumber ?? movement.id),
        source: String(movement.notes ?? movement.fromLocationName ?? "Direct receipt"),
        type: String(movement.movementType ?? "receipt"),
        unitOfMeasure: unitForOffering(String(movement.offeringId)),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
    const posSaleReferences = new Set(
      scopedSales.flatMap((entry) => [
        String(entry.sale.id),
        String(entry.sale.referenceNumber ?? ""),
        String(entry.sale.invoiceNumber ?? ""),
      ]),
    );
    const inventorySalesRows = [
      ...scopedSales
      .flatMap((entry) => {
        const soldAt =
          (dateValue(entry.sale.soldAt) ?? dateValue(entry.sale.createdAt))?.toISOString() ??
          "";
        return entry.scoped.lines.map((line) => ({
          customer: String(entry.sale.customerName ?? "Walk-in customer"),
          date: soldAt,
          label: String(line.offeringName ?? "Inventory item"),
          lineTotal: saleLineAmount(line),
          quantity: Number(line.quantity ?? 0),
          referenceNumber: String(
            entry.sale.invoiceNumber ?? entry.sale.referenceNumber ?? entry.sale.id,
          ),
          salesperson: String(
            entry.sale.createdByName ?? entry.sale.createdByEmail ?? "Not recorded",
          ),
          unitPrice: Number(line.unitPrice ?? 0),
        }));
      }),
      ...scopedMovements
        .filter(
          (movement) =>
            movement.movementType === "issue" &&
            movement.movementPurpose === "sale" &&
            !posSaleReferences.has(String(movement.externalReference ?? "")),
        )
        .map((movement) => ({
          customer: "Not recorded",
          date: movementDate(movement)?.toISOString() ?? "",
          label: String(movement.offeringName ?? "Inventory item"),
          lineTotal: null,
          quantity: Number(movement.quantity ?? 0),
          referenceNumber: String(
            movement.externalReference ?? movement.referenceNumber ?? movement.id,
          ),
          salesperson: String(
            movement.createdByName ?? movement.createdByEmail ?? "Not recorded",
          ),
          unitPrice: null,
        })),
    ]
      .sort((left, right) => left.date.localeCompare(right.date));
    const inventoryTransferRows = scopedMovements
      .filter((movement) => movement.movementType === "transfer")
      .map((movement) => ({
        date: movementDate(movement)?.toISOString() ?? "",
        destination: String(
          movement.toLocationName ?? branchName.get(String(movement.toBranchId)) ?? "Not recorded",
        ),
        label: String(movement.offeringName ?? labelForOffering(String(movement.offeringId))),
        quantity: Number(movement.quantity ?? 0),
        referenceNumber: String(movement.externalReference ?? movement.referenceNumber ?? movement.id),
        source: String(
          movement.fromLocationName ?? branchName.get(String(movement.fromBranchId)) ?? "Not recorded",
        ),
        unitOfMeasure: unitForOffering(String(movement.offeringId)),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
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
        inventoryMovementsByType: countRows(scopedMovements, "movementType"),
        inventoryValueByBrand: labelTotals(
          scopedBalances.map((balance) => ({
            label: String(
              balance.brandName ??
                brandName.get(String(balance.brandId)) ??
                "Unbranded",
            ),
            value:
              Number(balance.quantityOnHand ?? 0) *
              Number(
                offeringById.get(String(balance.offeringId))?.costPrice ?? 0,
              ),
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
        "Opening and closing quantities are reconstructed from the audited inventory movement ledger and the current system balance. Transfers net to zero when all branches are selected, but remain listed for audit.",
        "The closing reconciliation is: opening stock + receipts + transfers in + other stock in - sales - transfers out - other stock out.",
        "Selling prices and salesperson names come from completed POS sales. Manual inventory issues marked as sales remain in the stock reconciliation but may not have a selling price unless they are linked to a POS sale.",
        "Current availability and valuation are shown separately from the selected-period reconciliation. Historical values depend on complete movement dates and product cost records.",
        "Stock value is calculated as current on-hand quantity multiplied by the product cost price. Products without a cost price contribute zero until their cost is recorded.",
        "Low-stock status compares available quantity (on hand less reserved) with the product reorder level. Products without a reorder level are not flagged as low stock.",
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
        inventoryItems: inventoryItemRows,
        inventoryLocations: inventoryLocationRows,
        inventoryMovements: inventoryMovementRows,
        inventoryOpeningStock: inventoryOpeningStockRows,
        inventoryReceipts: inventoryReceiptRows,
        inventoryReconciliation: inventoryReconciliationRows,
        inventorySales: inventorySalesRows,
        inventoryTransfers: inventoryTransferRows,
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
        inventoryAdjustmentIn: inventoryReconciliationRows.reduce(
          (total, item) => total + item.adjustmentIn,
          0,
        ),
        inventoryAdjustmentOut: inventoryReconciliationRows.reduce(
          (total, item) => total + item.adjustmentOut,
          0,
        ),
        inventoryClosingQuantity: inventoryReconciliationRows.reduce(
          (total, item) => total + item.closingQuantity,
          0,
        ),
        inventoryLowStockItems: Object.entries(availableByOffering).filter(
          ([id, available]) => {
            const reorder = Number(offeringById.get(id)?.reorderLevel ?? 0);
            return reorder > 0 && available <= reorder;
          },
        ).length,
        inventoryMovements: scopedMovements.length,
        inventoryOnHand,
        inventoryOpeningQuantity: inventoryReconciliationRows.reduce(
          (total, item) => total + item.openingQuantity,
          0,
        ),
        inventoryOutOfStockItems: inventoryItemRows.filter(
          (item) => item.status === "outOfStock",
        ).length,
        inventoryReceivedQuantity: inventoryReconciliationRows.reduce(
          (total, item) => total + item.receipts,
          0,
        ),
        inventoryReserved,
        inventorySoldQuantity: inventoryReconciliationRows.reduce(
          (total, item) => total + item.sales,
          0,
        ),
        inventoryTrackedItems: inventoryItemRows.length,
        inventoryTransferredIn: inventoryReconciliationRows.reduce(
          (total, item) => total + item.transferIn,
          0,
        ),
        inventoryTransferredOut: inventoryReconciliationRows.reduce(
          (total, item) => total + item.transferOut,
          0,
        ),
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
