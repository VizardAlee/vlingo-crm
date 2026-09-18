"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  Download,
  MessageSquare,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  ErrorState,
  LoadingState,
  PermissionDenied,
} from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { PrintAction } from "@/components/print-action";
import { useAuth } from "@/features/auth/auth-provider";
import { BarcodeScanner } from "@/features/inventory/barcode-scanner";
import {
  branchInventoryCatalog,
  filterInventoryMovementItems,
  organizationInventoryCatalog,
} from "@/features/inventory/inventory-catalog-scope";
import {
  InventoryEnterprisePanel,
  type InventoryEnterpriseMode,
} from "@/features/inventory/inventory-enterprise-panel";
import {
  hasAnyPermission,
  hasPermission,
  memberRoles,
} from "@/lib/permissions";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import {
  addInventoryComment,
  archiveInventoryBrand,
  archiveInventoryOffering,
  createInventoryBrand,
  listInventoryBalances,
  listInventoryBrands,
  listInventoryComments,
  listInventoryItems,
  listInventoryLocations,
  listInventoryMovements,
  listInventoryTransferDestinations,
  recordInventoryMovement,
  updateInventoryBrand,
} from "@/services/inventory";
import type {
  InventoryBalance,
  InventoryBrand,
  InventoryComment,
  InventoryLocation,
  InventoryMovement,
  InventoryMovementPurpose,
  InventoryMovementType,
  Offering,
  Permission,
} from "@/types/crm";

type Tab =
  | "overview"
  | "movements"
  | "comments"
  | "setup"
  | InventoryEnterpriseMode;

const movementOptions: Array<{
  type: InventoryMovementType;
  permission: Permission;
  label: string;
  help: string;
}> = [
  {
    type: "adjustmentIn",
    permission: "inventory.adjust",
    label: "Enter existing / opening stock",
    help: "Use this once to bring stock already owned by the business into the system.",
  },
  {
    type: "receipt",
    permission: "inventory.receive",
    label: "Receive stock without a purchase order",
    help: "Use for a direct delivery that is not being received from a purchase order.",
  },
  {
    type: "issue",
    permission: "inventory.issue",
    label: "Record stock leaving",
    help: "Use for a sale, project, internal use, or another issue.",
  },
  {
    type: "transfer",
    permission: "inventory.transfer",
    label: "Transfer between locations",
    help: "Move stock between warehouses, stores, sites, or vehicles.",
  },
  {
    type: "returnIn",
    permission: "inventory.receive",
    label: "Record a customer / site return",
    help: "Bring previously issued stock back into inventory.",
  },
  {
    type: "returnOut",
    permission: "inventory.issue",
    label: "Return stock to a supplier",
    help: "Remove stock being sent back to a supplier.",
  },
  {
    type: "adjustmentOut",
    permission: "inventory.adjust",
    label: "Correct excess system stock",
    help: "Use only for an audited correction when the system quantity is too high.",
  },
];

const tabLabels: Record<Tab, string> = {
  overview: "Overview",
  movements: "Add / move stock",
  procurement: "Purchasing",
  counts: "Stock counts",
  reservations: "Reservations",
  traceability: "Traceability",
  approvals: "Stock count approvals",
  comments: "Comments",
  setup: "Setup",
};

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function inventoryDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function InventoryDashboard() {
  const { activeBranchId, activeOrganizationId, member, user } = useAuth();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [transferDestinations, setTransferDestinations] = useState<
    InventoryLocation[]
  >([]);
  const [items, setItems] = useState<Offering[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [reportItems, setReportItems] = useState<Offering[]>([]);
  const [reportBalances, setReportBalances] = useState<InventoryBalance[]>([]);
  const [reportMovements, setReportMovements] = useState<InventoryMovement[]>([]);
  const [comments, setComments] = useState<InventoryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [archivingItemId, setArchivingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movement, setMovement] = useState({
    movementType: "receipt" as InventoryMovementType,
    movementPurpose: "other" as InventoryMovementPurpose,
    offeringId: "",
    quantity: 1,
    fromLocationId: "",
    toLocationId: "",
    externalReference: "",
    notes: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    batchNumber: "",
    expiryDate: "",
    serialNumbers: [] as string[],
  });
  const [brandForm, setBrandForm] = useState({
    name: "",
    code: "",
    description: "",
    contactName: "",
    contactEmail: "",
  });
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [archivingBrandId, setArchivingBrandId] = useState<string | null>(null);
  const [commentForm, setCommentForm] = useState({
    brandId: "",
    message: "",
    reportPeriod: new Date().toISOString().slice(0, 7),
  });
  const [reportFilters, setReportFilters] = useState({
    branchId: "all",
    brandId: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [movementItemFilters, setMovementItemFilters] = useState({
    search: "",
    brandId: "",
    productType: "",
    category: "",
    locationId: "",
  });
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(25);
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(12);
  const isPartner = memberRoles(member).includes("brandPartner");
  const canMoveStock = hasAnyPermission(member, [
    "inventory.receive",
    "inventory.issue",
    "inventory.adjust",
    "inventory.transfer",
  ]);
  const canSetup = hasPermission(member, "inventory.manageCatalog");
  const canEditItems = hasPermission(member, "offerings.update");
  const canProcure = hasAnyPermission(member, [
    "inventory.procure",
    "inventory.receive",
    "inventory.approve",
  ]);
  const canCount = hasAnyPermission(member, [
    "inventory.count",
    "inventory.approve",
  ]);
  const canReserve = hasPermission(member, "inventory.reserve");
  const canApprove = hasPermission(member, "inventory.approve");

  useEffect(() => {
    if (searchParams.get("tab") === "procurement" && canProcure) {
      const timeout = window.setTimeout(() => setTab("procurement"), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [canProcure, searchParams]);
  const availableMovementOptions = useMemo(
    () =>
      movementOptions.filter((option) =>
        hasPermission(member, option.permission),
      ),
    [member],
  );
  const inventoryTourSteps = useMemo<GuidedTourStep[]>(() => {
    const steps: GuidedTourStep[] = [
      {
        target: "inventory-heading",
        title: isPartner ? "Your brand inventory" : "Inventory workspace",
        body: isPartner
          ? "This read-only dashboard shows your assigned brands across every branch."
          : "Use this workspace to monitor stock and carry out the inventory actions allowed by your role and branch.",
      },
      {
        target: "inventory-tab-overview",
        title: "Stock overview",
        body: isPartner
          ? "Review on-hand, reserved, and available quantities, low-stock items, branch/location balances, and recorded product sales."
          : "Review on-hand, reserved, and available quantities, inventory value, low-stock items, and balances by location.",
      },
      {
        target: "inventory-tab-movements",
        title: isPartner ? "Movement ledger" : "Add or move stock",
        body: isPartner
          ? "Review the receipt, transfer, issue, return, and adjustment history for your permitted brands."
          : "Enter existing stock, receive direct deliveries, record issues and returns, or transfer stock. Only actions permitted for your role are shown.",
      },
    ];
    if (!isPartner)
      steps.push({
        target: "inventory-tab-traceability",
        title: "Traceability",
        body: "Scan or search the batch/lot and serial registers to locate controlled stock and review its status.",
      });
    if (canProcure)
      steps.push({
        target: "inventory-tab-procurement",
        title: "Purchasing",
        body: "Create paid, part-paid, or credit purchases, receive deliveries, record supplier payments, and track the complete audit trail.",
      });
    if (canCount)
      steps.push({
        target: "inventory-tab-counts",
        title: "Stock counts",
        body: "Submit physical counts for approval and post approved variances without reducing stock below existing reservations.",
      });
    if (canReserve)
      steps.push({
        target: "inventory-tab-reservations",
        title: "Reservations",
        body: "Hold available stock for a deal, project, or work order, then release it or fulfill it as an inventory issue.",
      });
    if (canApprove)
      steps.push({
        target: "inventory-tab-approvals",
        title: "Approval queue",
        body: "Approve or reject stock-count variances created by another user. Creators cannot approve their own submissions.",
      });
    steps.push(
      {
        target: "inventory-tab-comments",
        title: "Report collaboration",
        body: "Post comments against a brand and reporting period. Brand partners can collaborate here without changing stock.",
      },
      {
        target: "inventory-export",
        title: "Export or print the report",
        body: "Filter by a permitted branch, brand, and movement date range, then download the current stock as CSV or print the full stock and movement report.",
      },
    );
    if (canSetup)
      steps.push({
        target: "inventory-tab-setup",
        title: "Inventory setup",
        body: "Create brands here. Stock locations come from active locations configured by administrators under Settings > Branches.",
      });
    return steps;
  }, [canApprove, canCount, canProcure, canReserve, canSetup, isPartner]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        nextBrands,
        nextItems,
        nextBalances,
        nextMovements,
        nextComments,
        nextLocations,
        nextTransferDestinations,
      ] = await Promise.all([
        listInventoryBrands(activeOrganizationId, member),
        listInventoryItems(activeOrganizationId, member),
        listInventoryBalances(activeOrganizationId, member),
        listInventoryMovements(activeOrganizationId, member),
        listInventoryComments(activeOrganizationId, member),
        isPartner
          ? Promise.resolve([])
          : listInventoryLocations(activeOrganizationId, member),
        !isPartner && hasPermission(member, "inventory.transfer")
          ? listInventoryTransferDestinations(activeOrganizationId)
          : Promise.resolve([]),
      ]);
      const activeOfferingIds = new Set(nextItems.map((item) => item.id));
      const activeBalances = nextBalances.filter((balance) =>
        activeOfferingIds.has(balance.offeringId),
      );
      const branchBalances = isPartner
        ? activeBalances
        : activeBalances.filter((balance) => balance.branchId === activeBranchId);
      const organizationItems = organizationInventoryCatalog(nextItems);
      const branchItems = isPartner
        ? organizationItems
        : branchInventoryCatalog(nextItems, activeBalances, activeBranchId);
      const selectableMovementItems = isPartner
        ? branchItems
        : organizationItems;
      const branchMovements = isPartner
        ? nextMovements
        : nextMovements.filter((movement) =>
            [
              movement.branchId,
              movement.fromBranchId,
              movement.toBranchId,
            ].includes(activeBranchId),
          );
      const branchComments = isPartner
        ? nextComments
        : nextComments.filter((comment) => comment.branchId === activeBranchId);
      setBrands(nextBrands);
      setReportItems(organizationItems);
      setReportBalances(activeBalances);
      setReportMovements(nextMovements);
      setItems(branchItems);
      setBalances(branchBalances);
      setMovements(branchMovements);
      setComments(branchComments);
      setLocations(nextLocations);
      setTransferDestinations(nextTransferDestinations);
      setCommentForm((value) => ({
        ...value,
        brandId: value.brandId || nextBrands[0]?.id || "",
      }));
      setMovement((value) => ({
        ...value,
        offeringId:
          selectableMovementItems.some((item) => item.id === value.offeringId)
            ? value.offeringId
            : selectableMovementItems[0]?.id || "",
      }));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load inventory.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, activeOrganizationId, isPartner, member]);

  async function archiveItem(item: Offering) {
    const confirmed = window.confirm(
      `Delete ${item.name} from active inventory? Its movement and sales history will be preserved. This is allowed only after its stock and reservations reach zero.`,
    );
    if (!confirmed) return;

    setArchivingItemId(item.id);
    setError(null);
    try {
      await archiveInventoryOffering({
        offeringId: item.id,
        organizationId: activeOrganizationId,
      });
      toast({
        title: "Inventory item deleted",
        description: `${item.name} was archived. Its audit and movement history remain available.`,
        variant: "success",
      });
      await load();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to delete this inventory item.";
      setError(message);
      toast({ title: "Unable to delete inventory item", description: message, variant: "error" });
    } finally {
      setArchivingItemId(null);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const itemTotals = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        quantity: balances
          .filter((balance) => balance.offeringId === item.id)
          .reduce(
            (sum, balance) => sum + Number(balance.quantityOnHand || 0),
            0,
          ),
        reserved: balances
          .filter((balance) => balance.offeringId === item.id)
          .reduce(
            (sum, balance) => sum + Number(balance.quantityReserved || 0),
            0,
          ),
      })),
    [balances, items],
  );
  const overviewPageCount = Math.max(
    1,
    Math.ceil(itemTotals.length / overviewPageSize),
  );
  const currentOverviewPage = Math.min(overviewPage, overviewPageCount);
  const paginatedItemTotals = useMemo(
    () =>
      itemTotals.slice(
        (currentOverviewPage - 1) * overviewPageSize,
        currentOverviewPage * overviewPageSize,
      ),
    [currentOverviewPage, itemTotals, overviewPageSize],
  );
  const sortedBalances = useMemo(
    () =>
      [...balances].sort(
        (left, right) =>
          left.locationName.localeCompare(right.locationName) ||
          left.offeringName.localeCompare(right.offeringName),
      ),
    [balances],
  );
  const balancePageCount = Math.max(
    1,
    Math.ceil(sortedBalances.length / balancePageSize),
  );
  const currentBalancePage = Math.min(balancePage, balancePageCount);
  const paginatedBalances = useMemo(
    () =>
      sortedBalances.slice(
        (currentBalancePage - 1) * balancePageSize,
        currentBalancePage * balancePageSize,
      ),
    [balancePageSize, currentBalancePage, sortedBalances],
  );
  const totalUnits = itemTotals.reduce((sum, item) => sum + item.quantity, 0);
  const inventoryValue = itemTotals.reduce(
    (sum, item) => sum + item.quantity * Number(item.costPrice ?? 0),
    0,
  );
  const lowStock = itemTotals.filter(
    (item) =>
      item.reorderLevel !== undefined &&
      item.quantity - item.reserved <= Number(item.reorderLevel),
  ).length;
  const effectiveMovementType = availableMovementOptions.some(
    (option) => option.type === movement.movementType,
  )
    ? movement.movementType
    : (availableMovementOptions[0]?.type ?? movement.movementType);
  const canonicalLocations = useMemo(
    () => locations.filter((location) => !location.isLegacy),
    [locations],
  );
  const currentBranchLocations = useMemo(
    () =>
      canonicalLocations.filter(
        (location) => location.branchId === activeBranchId,
      ),
    [activeBranchId, canonicalLocations],
  );
  const sourceLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.branchId === activeBranchId &&
          (!location.isLegacy ||
            balances.some(
              (balance) =>
                balance.locationId === location.id &&
                Number(balance.quantityOnHand || 0) > 0,
            )),
      ),
    [activeBranchId, balances, locations],
  );
  const destinationLocations =
    effectiveMovementType === "transfer"
      ? transferDestinations.filter(
          (location) => location.id !== movement.fromLocationId,
        )
      : currentBranchLocations;
  const needsFrom = [
    "issue",
    "adjustmentOut",
    "transfer",
    "returnOut",
  ].includes(effectiveMovementType);
  const needsTo = ["receipt", "adjustmentIn", "transfer", "returnIn"].includes(
    effectiveMovementType,
  );
  const movementItems = isPartner ? items : reportItems;
  const filteredMovementItems = useMemo(
    () =>
      filterInventoryMovementItems(
        movementItems,
        reportBalances,
        movementItemFilters,
      ),
    [movementItemFilters, movementItems, reportBalances],
  );
  const movementProductTypes = useMemo(
    () =>
      Array.from(new Set(movementItems.map((item) => item.type).filter(Boolean))).sort(),
    [movementItems],
  );
  const movementCategories = useMemo(
    () =>
      Array.from(new Set(movementItems.map((item) => item.category).filter(Boolean))).sort(),
    [movementItems],
  );
  const hasMovementItemFilters = Object.values(movementItemFilters).some(Boolean);
  const selectedMovementItem = filteredMovementItems.find(
    (item) => item.id === movement.offeringId,
  );
  const selectedMovementOption = movementOptions.find(
    (option) => option.type === effectiveMovementType,
  );
  const salesMovements = movements.filter(
    (entry) =>
      entry.movementType === "issue" && entry.movementPurpose === "sale",
  );
  const unitsSold = salesMovements.reduce(
    (sum, entry) => sum + Number(entry.quantity),
    0,
  );
  const reportBranchOptions = useMemo(() => {
    const options = new Map<string, string>();
    reportBalances.forEach((balance) => {
      if (balance.branchId) options.set(balance.branchId, balance.locationName || titleCase(balance.branchId));
    });
    reportMovements.forEach((entry) => {
      if (entry.branchId && !options.has(entry.branchId)) options.set(entry.branchId, titleCase(entry.branchId));
      if (entry.fromBranchId && !options.has(entry.fromBranchId)) options.set(entry.fromBranchId, entry.fromLocationName || titleCase(entry.fromBranchId));
      if (entry.toBranchId && !options.has(entry.toBranchId)) options.set(entry.toBranchId, entry.toLocationName || titleCase(entry.toBranchId));
    });
    return [...options.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reportBalances, reportMovements]);
  const filteredReportBalances = useMemo(
    () => reportBalances.filter((balance) =>
      (reportFilters.branchId === "all" || balance.branchId === reportFilters.branchId)
      && (reportFilters.brandId === "all" || balance.brandId === reportFilters.brandId)),
    [reportBalances, reportFilters.branchId, reportFilters.brandId],
  );
  const filteredReportMovements = useMemo(() => {
    const from = reportFilters.dateFrom ? new Date(`${reportFilters.dateFrom}T00:00:00`) : null;
    const to = reportFilters.dateTo ? new Date(`${reportFilters.dateTo}T23:59:59.999`) : null;
    return reportMovements.filter((entry) => {
      const occurredAt = inventoryDate(entry.occurredAt);
      return (reportFilters.branchId === "all" || [entry.branchId, entry.fromBranchId, entry.toBranchId].includes(reportFilters.branchId))
        && (reportFilters.brandId === "all" || entry.brandId === reportFilters.brandId)
        && (!from || Boolean(occurredAt && occurredAt >= from))
        && (!to || Boolean(occurredAt && occurredAt <= to));
    });
  }, [reportFilters, reportMovements]);
  const reportItemMap = useMemo(() => new Map(reportItems.map((item) => [item.id, item])), [reportItems]);
  const reportTotals = useMemo(() => filteredReportBalances.reduce((totals, balance) => {
    const onHand = Number(balance.quantityOnHand ?? 0);
    const reserved = Number(balance.quantityReserved ?? 0);
    totals.onHand += onHand;
    totals.reserved += reserved;
    totals.value += onHand * Number(reportItemMap.get(balance.offeringId)?.costPrice ?? 0);
    return totals;
  }, { onHand: 0, reserved: 0, value: 0 }), [filteredReportBalances, reportItemMap]);
  const selectedReportBranch = reportFilters.branchId === "all"
    ? "All permitted branches"
    : reportBranchOptions.find((branch) => branch.id === reportFilters.branchId)?.name ?? titleCase(reportFilters.branchId);
  const selectedReportBrand = reportFilters.brandId === "all"
    ? "All permitted brands"
    : brands.find((brand) => brand.id === reportFilters.brandId)?.name ?? "Selected brand";

  async function submitMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMovementItem) {
      toast({
        title: "Choose an inventory item",
        description: "Select one of the products matching the current filters.",
        variant: "error",
      });
      return;
    }
    setSaving("movement");
    try {
      const result = await recordInventoryMovement({
        ...movement,
        movementType: effectiveMovementType,
        organizationId: activeOrganizationId,
        branchId: activeBranchId,
      });
      toast({
        title: "Stock movement recorded",
        description: result.referenceNumber,
        variant: "success",
      });
      setMovement((value) => ({
        ...value,
        quantity: 1,
        externalReference: "",
        notes: "",
      }));
      await load();
    } catch (nextError) {
      toast({
        title: "Unable to record movement",
        description:
          nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  function startStockTask(movementType: InventoryMovementType) {
    setMovement((value) => ({
      ...value,
      movementType,
      movementPurpose:
        movementType === "issue" ? value.movementPurpose : "other",
      fromLocationId: "",
      toLocationId: "",
    }));
    setTab("movements");
  }

  async function submitBrand(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving("brand");
    try {
      if (editingBrandId) {
        await updateInventoryBrand({
          ...brandForm,
          brandId: editingBrandId,
          organizationId: activeOrganizationId,
        });
      } else {
        await createInventoryBrand(
          { ...brandForm, status: "active" },
          {
            organizationId: activeOrganizationId,
            branchId: activeBranchId,
            userId: user.uid,
            userEmail: member?.email,
            userName: member?.displayName,
          },
        );
      }
      setBrandForm({
        name: "",
        code: "",
        description: "",
        contactName: "",
        contactEmail: "",
      });
      setEditingBrandId(null);
      toast({ title: editingBrandId ? "Brand updated" : "Brand created", variant: "success" });
      await load();
    } catch (nextError) {
      toast({
        title: editingBrandId ? "Unable to update brand" : "Unable to create brand",
        description:
          nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  function startEditingBrand(brand: InventoryBrand) {
    setEditingBrandId(brand.id);
    setBrandForm({
      code: brand.code ?? "",
      contactEmail: brand.contactEmail ?? "",
      contactName: brand.contactName ?? "",
      description: brand.description ?? "",
      name: brand.name,
    });
  }

  function cancelEditingBrand() {
    setEditingBrandId(null);
    setBrandForm({ name: "", code: "", description: "", contactName: "", contactEmail: "" });
  }

  async function archiveBrand(brand: InventoryBrand) {
    const confirmed = window.confirm(
      `Delete ${brand.name} from active brands? Existing historical records will be preserved. Products, stock, open purchases, reservations, and Brand Representative assignments must be cleared first.`,
    );
    if (!confirmed) return;

    setArchivingBrandId(brand.id);
    setError(null);
    try {
      await archiveInventoryBrand({
        brandId: brand.id,
        organizationId: activeOrganizationId,
      });
      if (editingBrandId === brand.id) cancelEditingBrand();
      toast({
        title: "Brand deleted",
        description: `${brand.name} was removed from active brands while its history was preserved.`,
        variant: "success",
      });
      await load();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to delete this brand.";
      setError(message);
      toast({ title: "Unable to delete brand", description: message, variant: "error" });
    } finally {
      setArchivingBrandId(null);
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !commentForm.brandId || !commentForm.message.trim()) return;
    setSaving("comment");
    try {
      await addInventoryComment({
        ...commentForm,
        organizationId: activeOrganizationId,
        branchId: activeBranchId,
        userId: user.uid,
        userEmail: member?.email,
        userName: member?.displayName,
      });
      setCommentForm((value) => ({ ...value, message: "" }));
      toast({ title: "Comment posted", variant: "success" });
      await load();
    } catch (nextError) {
      toast({
        title: "Unable to post comment",
        description:
          nextError instanceof Error ? nextError.message : "Try again.",
        variant: "error",
      });
    } finally {
      setSaving(null);
    }
  }

  function downloadReport() {
    const baseHeader = [
      "Brand",
      "SKU",
      "Barcode",
      "Item",
      "Branch",
      "Location",
      "On hand",
      "Reserved",
      "Available",
      "Reorder level",
    ];
    const header = isPartner ? baseHeader : [...baseHeader, "Unit cost", "Stock value"];
    const rows = filteredReportBalances.map((balance) => {
      const item = reportItemMap.get(balance.offeringId);
      const reserved = Number(balance.quantityReserved ?? 0);
      const baseRow = [
        balance.brandName,
        balance.sku,
        item?.barcode ?? "",
        balance.offeringName,
        reportBranchOptions.find((branch) => branch.id === balance.branchId)?.name ?? balance.branchId,
        balance.locationName,
        balance.quantityOnHand,
        reserved,
        Number(balance.quantityOnHand) - reserved,
        item?.reorderLevel ?? "",
      ];
      return isPartner ? baseRow : [...baseRow, item?.costPrice ?? 0, Number(balance.quantityOnHand) * Number(item?.costPrice ?? 0)];
    });
    const blob = new Blob(
      [[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const branchSuffix = reportFilters.branchId === "all" ? "all-branches" : reportFilters.branchId;
    const brandSuffix = reportFilters.brandId === "all" ? "all-brands" : reportFilters.brandId;
    link.download = `inventory-report-${branchSuffix}-${brandSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!hasPermission(member, "inventory.read")) return <PermissionDenied />;
  if (loading) return <LoadingState label="Loading inventory" />;

  return (
    <>
    <section className="grid min-w-0 gap-5 print:hidden">
      <div
        className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none"
        data-tour="inventory-heading"
      >
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPartner
              ? "Your read-only brand inventory report and collaboration space."
              : "Stock balances, movements, locations, brands, valuation, and partner reporting."}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
          <GuidedTour
            storageKey={`vlingo-tour:inventory-enterprise-v1:${isPartner ? "partner" : "internal"}`}
            steps={inventoryTourSteps}
          />
          <Button
            data-tour="inventory-export"
            onClick={downloadReport}
            variant="outline"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <PrintAction variant="outline" />
          <Button onClick={load} variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Branch">
            <Select value={reportFilters.branchId} onChange={(event) => setReportFilters((value) => ({ ...value, branchId: event.target.value }))}>
              <option value="all">All permitted branches</option>
              {reportBranchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Brand">
            <Select value={reportFilters.brandId} onChange={(event) => setReportFilters((value) => ({ ...value, brandId: event.target.value }))}>
              <option value="all">All permitted brands</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </Select>
          </Field>
          <Field label="Movement date from">
            <Input max={reportFilters.dateTo || undefined} type="date" value={reportFilters.dateFrom} onChange={(event) => setReportFilters((value) => ({ ...value, dateFrom: event.target.value }))} />
          </Field>
          <Field label="Movement date to">
            <Input min={reportFilters.dateFrom || undefined} type="date" value={reportFilters.dateTo} onChange={(event) => setReportFilters((value) => ({ ...value, dateTo: event.target.value }))} />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">Branch and brand filters apply to the current stock table and movement ledger. Dates filter the movement ledger; current balances remain the latest recorded quantities.</p>
        </CardContent>
      </Card>
      {!isPartner && !currentBranchLocations.length ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">No active stock location for this branch</p>
          <p className="mt-1 text-muted-foreground">
            Ask an administrator to create or activate this location under
            Settings &gt; Branches, then refresh Inventory.
          </p>
          {hasPermission(member, "users.manage") ? (
            <ButtonLink
              className="mt-3"
              href="/settings/branches"
              variant="outline"
            >
              Manage locations
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            "overview",
            "movements",
            ...(canProcure ? ["procurement"] : []),
            ...(!isPartner ? ["traceability"] : []),
            ...(canCount ? ["counts"] : []),
            ...(canReserve ? ["reservations"] : []),
            ...(canApprove ? ["approvals"] : []),
            "comments",
            ...(canSetup ? ["setup"] : []),
          ] as Tab[]
        ).map((value) => (
          <Button
            data-tour={`inventory-tab-${value}`}
            key={value}
            onClick={() => setTab(value)}
            variant={tab === value ? "primary" : "outline"}
          >
            {tabLabels[value]}
          </Button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          {!isPartner && canMoveStock ? (
            <Card>
              <CardHeader>
                <CardTitle>What do you need to do?</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {hasPermission(member, "inventory.adjust") ? (
                  <button
                    className="rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                    onClick={() => startStockTask("adjustmentIn")}
                    type="button"
                  >
                    <p className="font-semibold">Add existing stock</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter opening quantities already owned.
                    </p>
                  </button>
                ) : null}
                {hasPermission(member, "inventory.receive") ? (
                  <button
                    className="rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                    onClick={() => startStockTask("receipt")}
                    type="button"
                  >
                    <p className="font-semibold">Receive a direct delivery</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      For stock received without a purchase order.
                    </p>
                  </button>
                ) : null}
              {hasPermission(member, "inventory.procure") ? (
                  <button
                    className="rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                    onClick={() => setTab("procurement")}
                    type="button"
                  >
                    <p className="font-semibold">Procure stock</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Create a paid, part-paid, or credit purchase.
                    </p>
                  </button>
                ) : null}
                {hasPermission(member, "inventory.transfer") ? (
                  <button
                    className="rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
                    onClick={() => startStockTask("transfer")}
                    type="button"
                  >
                    <p className="font-semibold">Transfer stock</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Move quantities between stock locations.
                    </p>
                  </button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {!isPartner ? <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Units on hand
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {totalUnits.toLocaleString()}
                </p>
              </CardContent>
            </Card> : null}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Inventory value
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(inventoryValue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Tracked items
                </p>
                <p className="mt-2 text-2xl font-bold">{itemTotals.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Low stock items
                </p>
                <p className="mt-2 text-2xl font-bold text-warning">
                  {lowStock}
                </p>
              </CardContent>
            </Card>
            {isPartner ? (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Units sold
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {unitsSold.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recorded sale issues
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Stock by item</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {itemTotals.length
                    ? `Showing ${(currentOverviewPage - 1) * overviewPageSize + 1}–${Math.min(currentOverviewPage * overviewPageSize, itemTotals.length)} of ${itemTotals.length}`
                    : "No inventory items"}
                </p>
              </div>
              <Field className="w-full sm:w-36" label="Items per page">
                <Select
                  aria-label="Items per page"
                  onChange={(event) => {
                    setOverviewPageSize(Number(event.target.value));
                    setOverviewPage(1);
                  }}
                  value={overviewPageSize}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
                {paginatedItemTotals.map((item) => {
                  const available = item.quantity - item.reserved;
                  const low =
                    item.reorderLevel !== undefined &&
                    available <= Number(item.reorderLevel);
                  return (
                    <article className="rounded-lg border bg-background p-4 shadow-sm" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.brandName} · {titleCase(item.trackingMode ?? "none")}
                          </p>
                        </div>
                        <Badge tone={low ? "warning" : "success"}>
                          {low ? "Low stock" : "Healthy"}
                        </Badge>
                      </div>
                      <div className="mt-3 rounded-md bg-muted/60 p-3 text-xs">
                        <p><span className="text-muted-foreground">SKU:</span> {item.sku || "—"}</p>
                        {item.barcode ? <p className="mt-1"><span className="text-muted-foreground">Barcode:</span> {item.barcode}</p> : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-xs text-muted-foreground">On hand</dt><dd className="mt-1 text-lg font-bold">{item.quantity}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Available</dt><dd className="mt-1 text-lg font-bold">{available}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Reserved</dt><dd className="mt-1 font-semibold">{item.reserved}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Reorder level</dt><dd className="mt-1 font-semibold">{item.reorderLevel ?? "—"}</dd></div>
                        {!isPartner ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">Stock value</dt><dd className="mt-1 font-semibold">{formatCurrency(item.quantity * Number(item.costPrice ?? 0))}</dd></div> : null}
                      </dl>
                      {canEditItems || canSetup ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                          {canEditItems ? <ButtonLink href={`/offerings/${item.id}/edit`} size="sm" variant="outline"><Pencil className="h-4 w-4" />Edit</ButtonLink> : null}
                          {canSetup ? <Button className="text-danger" disabled={archivingItemId === item.id} onClick={() => void archiveItem(item)} size="sm" type="button" variant="outline"><Archive className="h-4 w-4" />{archivingItemId === item.id ? "Deleting" : "Delete"}</Button> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {!itemTotals.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">No branded inventory items are available yet.</div> : null}
              </div>
              <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Brand / item</th>
                    <th className="px-4 py-3">SKU / barcode</th>
                    <th className="px-4 py-3">On hand</th>
                    <th className="px-4 py-3">Reserved</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Reorder</th>
                    {!isPartner ? <th className="px-4 py-3">Value</th> : null}
                    <th className="px-4 py-3">Status</th>
                    {canEditItems || canSetup ? <th className="px-4 py-3">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItemTotals.map((item) => {
                    const available = item.quantity - item.reserved;
                    const low =
                      item.reorderLevel !== undefined &&
                      available <= Number(item.reorderLevel);
                    return (
                      <tr className="border-t" key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.brandName} ·{" "}
                            {titleCase(item.trackingMode ?? "none")}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{item.sku || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.barcode}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3">{item.reserved}</td>
                        <td className="px-4 py-3 font-semibold">{available}</td>
                        <td className="px-4 py-3">
                          {item.reorderLevel ?? "—"}
                        </td>
                        {!isPartner ? <td className="px-4 py-3">
                          {formatCurrency(
                            item.quantity * Number(item.costPrice ?? 0),
                          )}
                        </td> : null}
                        <td className="px-4 py-3">
                          <Badge tone={low ? "warning" : "success"}>
                            {low ? "Low stock" : "Healthy"}
                          </Badge>
                        </td>
                        {canEditItems || canSetup ? (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {canEditItems ? (
                                <ButtonLink href={`/offerings/${item.id}/edit`} size="sm" variant="outline">
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </ButtonLink>
                              ) : null}
                              {canSetup ? (
                                <Button
                                  className="text-danger"
                                  disabled={archivingItemId === item.id}
                                  onClick={() => void archiveItem(item)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Archive className="h-4 w-4" />
                                  {archivingItemId === item.id ? "Deleting" : "Delete"}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {!itemTotals.length ? (
                    <tr>
                      <td
                        className="px-4 py-8 text-center text-muted-foreground"
                        colSpan={(isPartner ? 7 : 8) + (canEditItems || canSetup ? 1 : 0)}
                      >
                        No branded inventory items are available yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </CardContent>
            {itemTotals.length > overviewPageSize ? (
              <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  Page {currentOverviewPage} of {overviewPageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={currentOverviewPage <= 1}
                    onClick={() =>
                      setOverviewPage((page) => Math.max(1, page - 1))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={currentOverviewPage >= overviewPageCount}
                    onClick={() =>
                      setOverviewPage((page) =>
                        Math.min(overviewPageCount, page + 1),
                      )
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Balances by location</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sortedBalances.length
                    ? `Showing ${(currentBalancePage - 1) * balancePageSize + 1}–${Math.min(currentBalancePage * balancePageSize, sortedBalances.length)} of ${sortedBalances.length}`
                    : "No location balances"}
                </p>
              </div>
              <Field className="w-full sm:w-40" label="Balances per page">
                <Select
                  aria-label="Balances per page"
                  onChange={(event) => {
                    setBalancePageSize(Number(event.target.value));
                    setBalancePage(1);
                  }}
                  value={balancePageSize}
                >
                  {[6, 12, 24, 48].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedBalances.map((balance) => (
                <div className="rounded-md border p-3" key={balance.id}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{balance.offeringName}</p>
                      <p className="text-xs text-muted-foreground">
                        {balance.brandName} · {balance.locationName}
                      </p>
                    </div>
                    <p className="text-xl font-bold">
                      {balance.quantityOnHand}
                    </p>
                  </div>
                </div>
              ))}
              {!sortedBalances.length ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                  No inventory balances are available for your permitted
                  branches and brands.
                </div>
              ) : null}
            </CardContent>
            {sortedBalances.length > balancePageSize ? (
              <div className="flex flex-col gap-3 border-t p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  Page {currentBalancePage} of {balancePageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={currentBalancePage <= 1}
                    onClick={() =>
                      setBalancePage((page) => Math.max(1, page - 1))
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={currentBalancePage >= balancePageCount}
                    onClick={() =>
                      setBalancePage((page) =>
                        Math.min(balancePageCount, page + 1),
                      )
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
          {isPartner ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Recorded product sales across all branches
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
                  {salesMovements.map((entry) => (
                    <article className="rounded-lg border bg-background p-4 shadow-sm" key={entry.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-semibold">{entry.offeringName}</h3><p className="mt-1 text-xs text-muted-foreground">{entry.brandName}</p></div>
                        <p className="text-xl font-bold">{entry.quantity}</p>
                      </div>
                      <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Date</dt><dd className="text-right font-medium">{formatDate(entry.occurredAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Branch</dt><dd className="text-right font-medium">{entry.branchId}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Location</dt><dd className="text-right font-medium">{entry.fromLocationName || "—"}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sale reference</dt><dd className="break-all text-right font-medium">{entry.externalReference || entry.referenceNumber}</dd></div>
                      </dl>
                    </article>
                  ))}
                  {!salesMovements.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">No product sales have been recorded for the selected brands yet.</div> : null}
                </div>
                <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Sale reference</th>
                      <th className="px-4 py-3">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesMovements.map((entry) => (
                      <tr className="border-t" key={entry.id}>
                        <td className="px-4 py-3">
                          {formatDate(entry.occurredAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">
                            {entry.offeringName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {entry.brandName}
                          </div>
                        </td>
                        <td className="px-4 py-3">{entry.branchId}</td>
                        <td className="px-4 py-3">
                          {entry.fromLocationName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {entry.externalReference || entry.referenceNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {entry.quantity}
                        </td>
                      </tr>
                    ))}
                    {!salesMovements.length ? (
                      <tr>
                        <td
                          className="px-4 py-8 text-center text-muted-foreground"
                          colSpan={6}
                        >
                          No product sales have been recorded for the selected
                          brands yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === "movements" ? (
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          {canMoveStock ? (
            <Card>
              <CardHeader>
                <CardTitle>Add or move stock</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Products are shared across the organization. Quantities and
                  stock movements remain controlled by branch and location.
                </p>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={submitMovement}>
                  <Field label="What are you doing?">
                    <Select
                      value={effectiveMovementType}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          movementType: event.target
                            .value as InventoryMovementType,
                          movementPurpose:
                            event.target.value === "issue"
                              ? value.movementPurpose
                              : "other",
                          fromLocationId: "",
                          toLocationId: "",
                        }))
                      }
                    >
                      {availableMovementOptions.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                    {selectedMovementOption?.help}
                    {effectiveMovementType === "receipt"
                      ? " Purchase-order deliveries should be received from Purchasing so the order is updated correctly."
                      : ""}
                  </p>
                  <Field label="Scan item">
                    <BarcodeScanner
                      onScan={(code) => {
                        const item = movementItems.find((entry) =>
                          [entry.barcode, entry.sku].some(
                            (value) =>
                              String(value ?? "").toLowerCase() ===
                              code.toLowerCase(),
                          ),
                        );
                        if (item) {
                          setMovementItemFilters({
                            search: "",
                            brandId: "",
                            productType: "",
                            category: "",
                            locationId: "",
                          });
                          setMovement((value) => ({
                            ...value,
                            offeringId: item.id,
                          }));
                        } else
                          toast({
                            title: "Barcode not found",
                            description: code,
                            variant: "error",
                          });
                      }}
                    />
                  </Field>
                  {effectiveMovementType === "issue" ? (
                    <Field label="Why is stock leaving?">
                      <Select
                        value={movement.movementPurpose}
                        onChange={(event) =>
                          setMovement((value) => ({
                            ...value,
                            movementPurpose: event.target
                              .value as InventoryMovementPurpose,
                          }))
                        }
                      >
                        {["sale", "project", "internalUse", "other"].map(
                          (purpose) => (
                            <option key={purpose} value={purpose}>
                              {titleCase(purpose)}
                            </option>
                          ),
                        )}
                      </Select>
                    </Field>
                  ) : null}
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Filter products</p>
                        <p className="text-xs text-muted-foreground">
                          Narrow the organization catalogue before choosing an item.
                        </p>
                      </div>
                      {hasMovementItemFilters ? (
                        <Button
                          onClick={() =>
                            setMovementItemFilters({
                              search: "",
                              brandId: "",
                              productType: "",
                              category: "",
                              locationId: "",
                            })
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                    <Field label="Search products">
                      <Input
                        onChange={(event) =>
                          setMovementItemFilters((value) => ({
                            ...value,
                            search: event.target.value,
                          }))
                        }
                        placeholder="Name, SKU, barcode, category..."
                        type="search"
                        value={movementItemFilters.search}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Brand">
                        <Select
                          onChange={(event) =>
                            setMovementItemFilters((value) => ({ ...value, brandId: event.target.value }))
                          }
                          value={movementItemFilters.brandId}
                        >
                          <option value="">All brands</option>
                          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                        </Select>
                      </Field>
                      <Field label="Product type">
                        <Select
                          onChange={(event) =>
                            setMovementItemFilters((value) => ({ ...value, productType: event.target.value }))
                          }
                          value={movementItemFilters.productType}
                        >
                          <option value="">All product types</option>
                          {movementProductTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                        </Select>
                      </Field>
                      <Field label="Category">
                        <Select
                          onChange={(event) =>
                            setMovementItemFilters((value) => ({ ...value, category: event.target.value }))
                          }
                          value={movementItemFilters.category}
                        >
                          <option value="">All categories</option>
                          {movementCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </Select>
                      </Field>
                      <Field label="Stock location">
                        <Select
                          onChange={(event) =>
                            setMovementItemFilters((value) => ({ ...value, locationId: event.target.value }))
                          }
                          value={movementItemFilters.locationId}
                        >
                          <option value="">All locations</option>
                          {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {filteredMovementItems.length} of {movementItems.length} products shown
                    </p>
                  </div>
                  <Field label="Item">
                    <Select
                      required
                      value={selectedMovementItem?.id ?? ""}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          offeringId: event.target.value,
                          batchNumber: "",
                          serialNumbers: [],
                        }))
                      }
                    >
                      <option value="">{filteredMovementItems.length ? "Select item" : "No products match these filters"}</option>
                      {filteredMovementItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.brandName} · {item.name}
                          {item.sku ? ` · ${item.sku}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Quantity">
                    <Input
                      min={1}
                      required
                      type="number"
                      value={movement.quantity}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          quantity: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  {needsFrom ? (
                    <Field label="From">
                      <Select
                        required
                        value={movement.fromLocationId}
                        onChange={(event) =>
                          setMovement((value) => ({
                            ...value,
                            fromLocationId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select location</option>
                        {sourceLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.isLegacy ? "Legacy cleanup — " : ""}
                            {location.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  {needsTo ? (
                    <Field label="Add to location">
                      <Select
                        required
                        value={movement.toLocationId}
                        onChange={(event) =>
                          setMovement((value) => ({
                            ...value,
                            toLocationId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select location</option>
                        {destinationLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} ({location.code})
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  {selectedMovementItem?.trackingMode === "batch" ? (
                    <>
                      <Field label="Batch number">
                        <Input
                          required
                          value={movement.batchNumber}
                          onChange={(event) =>
                            setMovement((value) => ({
                              ...value,
                              batchNumber: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      {needsTo ? (
                        <Field label="Expiry date">
                          <Input
                            type="date"
                            value={movement.expiryDate}
                            onChange={(event) =>
                              setMovement((value) => ({
                                ...value,
                                expiryDate: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                    </>
                  ) : null}
                  {selectedMovementItem?.trackingMode === "serial" ? (
                    <Field label="Serial numbers (optional, one per line)">
                      <Textarea
                        placeholder="Leave blank for now, or enter one serial per unit"
                        value={movement.serialNumbers.join("\n")}
                        onChange={(event) =>
                          setMovement((value) => ({
                            ...value,
                            serialNumbers: event.target.value
                              .split(/[\n,]+/)
                              .map((entry) => entry.trim())
                              .filter(Boolean),
                          }))
                        }
                      />
                    </Field>
                  ) : null}
                  <Field label="Date">
                    <Input
                      type="date"
                      value={movement.occurredAt}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          occurredAt: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field
                    label={
                      effectiveMovementType === "adjustmentIn"
                        ? "Opening stock reference (optional)"
                        : movement.movementPurpose === "sale"
                          ? "Deal, invoice, or sale reference"
                          : "Reference (optional)"
                    }
                  >
                    <Input
                      required={movement.movementPurpose === "sale"}
                      value={movement.externalReference}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          externalReference: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="Notes (optional)">
                    <Textarea
                      value={movement.notes}
                      onChange={(event) =>
                        setMovement((value) => ({
                          ...value,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Button disabled={saving === "movement"} type="submit">
                    <PackageCheck className="h-4 w-4" />
                    {saving === "movement"
                      ? "Saving"
                      : effectiveMovementType === "adjustmentIn"
                        ? "Add existing stock"
                        : "Save stock movement"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
          <Card className={canMoveStock ? "" : "xl:col-span-2"}>
            <CardHeader>
              <CardTitle>Movement ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:hidden">
                {movements.map((entry) => (
                  <article className="rounded-lg border bg-background p-4 shadow-sm" key={entry.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="font-semibold">{entry.offeringName}</h3><p className="mt-1 text-xs text-muted-foreground">{entry.brandName}</p></div>
                      <Badge tone="info">{titleCase(entry.movementType)}</Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 border-t pt-3 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Quantity</dt><dd className="text-lg font-bold">{entry.quantity}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Date</dt><dd className="text-right font-medium">{formatDate(entry.occurredAt)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Route</dt><dd className="text-right font-medium">{[entry.fromLocationName, entry.toLocationName].filter(Boolean).join(" → ") || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Reference</dt><dd className="break-all text-right font-medium">{entry.externalReference || entry.referenceNumber}</dd></div>
                    </dl>
                  </article>
                ))}
                {!movements.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">No stock movements are available for this branch.</div> : null}
              </div>
              <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((entry) => (
                    <tr className="border-t" key={entry.id}>
                      <td className="px-4 py-3">
                        {formatDate(entry.occurredAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {entry.referenceNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.externalReference}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{entry.offeringName}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.brandName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="info">
                          {titleCase(entry.movementType)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {[entry.fromLocationName, entry.toLocationName]
                          .filter(Boolean)
                          .join(" → ") || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {entry.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {[
        "procurement",
        "counts",
        "reservations",
        "traceability",
        "approvals",
      ].includes(tab) ? (
        <InventoryEnterprisePanel
          balances={balances}
          items={items}
          locations={currentBranchLocations}
          member={member}
          mode={tab as InventoryEnterpriseMode}
          onChanged={load}
        />
      ) : null}

      {tab === "comments" ? (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Comment on a report</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={submitComment}>
                <Field label="Brand">
                  <Select
                    required
                    value={commentForm.brandId}
                    onChange={(event) =>
                      setCommentForm((value) => ({
                        ...value,
                        brandId: event.target.value,
                      }))
                    }
                  >
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Report period">
                  <Input
                    type="month"
                    value={commentForm.reportPeriod}
                    onChange={(event) =>
                      setCommentForm((value) => ({
                        ...value,
                        reportPeriod: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Comment">
                  <Textarea
                    required
                    value={commentForm.message}
                    onChange={(event) =>
                      setCommentForm((value) => ({
                        ...value,
                        message: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button disabled={saving === "comment"} type="submit">
                  <Send className="h-4 w-4" />
                  Post comment
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="grid content-start gap-3">
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="whitespace-pre-wrap text-sm">
                        {comment.message}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {brands.find((brand) => brand.id === comment.brandId)
                          ?.name ?? "Brand"}{" "}
                        · {comment.reportPeriod || "General"} ·{" "}
                        {comment.createdByName || comment.createdByEmail} ·{" "}
                        {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!comments.length ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No report comments yet.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "setup" && canSetup ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editingBrandId ? "Edit brand" : "Brands"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form className="grid gap-3" onSubmit={submitBrand}>
                <Field label="Brand name">
                  <Input
                    required
                    value={brandForm.name}
                    onChange={(event) =>
                      setBrandForm((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Brand code (optional)">
                  <Input
                    value={brandForm.code}
                    onChange={(event) =>
                      setBrandForm((value) => ({
                        ...value,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </Field>
                <Field label="Partner contact name">
                  <Input
                    value={brandForm.contactName}
                    onChange={(event) =>
                      setBrandForm((value) => ({
                        ...value,
                        contactName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Partner contact email">
                  <Input
                    type="email"
                    value={brandForm.contactEmail}
                    onChange={(event) =>
                      setBrandForm((value) => ({
                        ...value,
                        contactEmail: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={brandForm.description}
                    onChange={(event) =>
                      setBrandForm((value) => ({
                        ...value,
                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={saving === "brand"} type="submit">
                    {editingBrandId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {saving === "brand" ? "Saving" : editingBrandId ? "Save brand" : "Create brand"}
                  </Button>
                  {editingBrandId ? (
                    <Button disabled={saving === "brand"} onClick={cancelEditingBrand} type="button" variant="outline">
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
              <div className="grid gap-2">
                {brands.map((brand) => (
                  <div
                    className="flex items-center justify-between rounded-md border p-3"
                    key={brand.id}
                  >
                    <div>
                      <p className="font-semibold">{brand.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {brand.code ? `${brand.code} · ` : ""}
                        {brand.contactEmail || "No partner contact"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge tone="success">{brand.status}</Badge>
                      <Button disabled={saving === "brand" || archivingBrandId === brand.id} onClick={() => startEditingBrand(brand)} size="sm" type="button" variant="outline">
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button className="text-danger" disabled={saving === "brand" || archivingBrandId === brand.id} onClick={() => void archiveBrand(brand)} size="sm" type="button" variant="outline">
                        <Archive className="h-4 w-4" />
                        {archivingBrandId === brand.id ? "Deleting" : "Delete"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stock locations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Managed by administrators</p>
                <p className="mt-1 text-muted-foreground">
                  Every active location created under Settings &gt; Branches is
                  automatically available in inventory stock dropdowns. A
                  legacy location is shown only while it needs stock cleanup
                  and cannot receive new inventory.
                </p>
                {hasPermission(member, "users.manage") ? (
                  <ButtonLink
                    className="mt-3"
                    href="/settings/branches"
                    variant="outline"
                  >
                    Manage locations
                  </ButtonLink>
                ) : null}
              </div>
              <div className="grid gap-2">
                {locations.map((location) => (
                  <div
                    className="flex items-center justify-between rounded-md border p-3"
                    key={location.id}
                  >
                    <div>
                      <p className="font-semibold">{location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {location.code} · {location.address || "No address"}
                      </p>
                    </div>
                    <Badge tone={location.isLegacy ? "warning" : "info"}>
                      {location.isLegacy ? "Legacy cleanup only" : location.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>

    <article className="inventory-print-report hidden bg-white text-[#151915] print:block">
      <header className="border-b-2 border-[#c7a13a] pb-4">
        <Image alt="Vlingo Systems Nigeria Limited" className="h-auto w-full max-w-[520px] object-contain object-left" height={92} priority src="/branding/vlingo-logo.jpeg" width={550} />
        <div className="mt-2 grid grid-cols-2 gap-5 text-[9px] font-medium leading-4 text-[#4f574f]"><p><strong className="text-[#174f20]">Kaduna Office:</strong> 27A, Isa Kaita Road, U/Sarki, Kaduna · +234 803 770 1084</p><p><strong className="text-[#174f20]">Kano Office:</strong> Block 3, Shop 1D, Civic Center Ultramodern Market, Kano · 07032545288</p></div>
      </header>

      <div className="mt-6 flex items-start justify-between gap-6">
        <div><h1 className="text-2xl font-black tracking-tight text-[#174f20]">INVENTORY REPORT</h1><p className="mt-1 text-xs text-[#515851]">Current stock balances and inventory movement history</p></div>
        <div className="bg-[#174f20] px-5 py-3 text-center text-[10px] font-black tracking-[0.12em] text-white">GENERATED {new Date().toLocaleDateString("en-NG")}</div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 border-y py-3 text-[10px]">
        <div className="flex justify-between gap-3 py-1"><dt className="font-bold uppercase text-[#5e665e]">Branch</dt><dd className="font-semibold">{selectedReportBranch}</dd></div>
        <div className="flex justify-between gap-3 py-1"><dt className="font-bold uppercase text-[#5e665e]">Brand</dt><dd className="font-semibold">{selectedReportBrand}</dd></div>
        <div className="flex justify-between gap-3 py-1"><dt className="font-bold uppercase text-[#5e665e]">Movement from</dt><dd className="font-semibold">{reportFilters.dateFrom ? formatDate(reportFilters.dateFrom) : "Beginning"}</dd></div>
        <div className="flex justify-between gap-3 py-1"><dt className="font-bold uppercase text-[#5e665e]">Movement to</dt><dd className="font-semibold">{reportFilters.dateTo ? formatDate(reportFilters.dateTo) : "Current date"}</dd></div>
      </dl>

      <section className={isPartner ? "mt-5 grid grid-cols-4 gap-2" : "mt-5 grid grid-cols-5 gap-2"}>
        {[
          { label: "Units on hand", value: reportTotals.onHand.toLocaleString() },
          { label: "Reserved", value: reportTotals.reserved.toLocaleString() },
          { label: "Available", value: (reportTotals.onHand - reportTotals.reserved).toLocaleString() },
          { label: "Stock lines", value: filteredReportBalances.length.toLocaleString() },
          ...(!isPartner ? [{ label: "Inventory value", value: formatCurrency(reportTotals.value) }] : []),
        ].map((metric) => <div className="border p-2" key={metric.label}><p className="text-[8px] font-bold uppercase text-[#5e665e]">{metric.label}</p><p className="mt-1 text-sm font-black text-[#174f20]">{metric.value}</p></div>)}
      </section>

      <section className="mt-6">
        <h2 className="border-b-2 border-[#174f20] pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#174f20]">Current stock balances</h2>
        <table className="mt-2 w-full table-fixed text-[8px]">
          <thead className="bg-[#174f20] text-left uppercase text-white"><tr><th className="w-[21%] px-2 py-2">Brand / Item</th><th className="w-[13%] px-2 py-2">SKU</th><th className="w-[18%] px-2 py-2">Branch / Location</th><th className="px-2 py-2 text-right">On hand</th><th className="px-2 py-2 text-right">Reserved</th><th className="px-2 py-2 text-right">Available</th><th className="px-2 py-2 text-right">Reorder</th>{!isPartner ? <th className="w-[13%] px-2 py-2 text-right">Value</th> : null}</tr></thead>
          <tbody>{filteredReportBalances.map((balance) => {
            const item = reportItemMap.get(balance.offeringId);
            const reserved = Number(balance.quantityReserved ?? 0);
            const available = Number(balance.quantityOnHand ?? 0) - reserved;
            return <tr className="border-b" key={balance.id}><td className="px-2 py-2"><strong>{balance.offeringName}</strong><br /><span className="text-[#626a62]">{balance.brandName}</span></td><td className="break-all px-2 py-2">{balance.sku || "—"}</td><td className="px-2 py-2">{reportBranchOptions.find((branch) => branch.id === balance.branchId)?.name ?? titleCase(balance.branchId)}<br /><span className="text-[#626a62]">{balance.locationName}</span></td><td className="px-2 py-2 text-right font-bold">{balance.quantityOnHand}</td><td className="px-2 py-2 text-right">{reserved}</td><td className="px-2 py-2 text-right font-bold">{available}</td><td className="px-2 py-2 text-right">{item?.reorderLevel ?? "—"}</td>{!isPartner ? <td className="px-2 py-2 text-right">{formatCurrency(Number(balance.quantityOnHand ?? 0) * Number(item?.costPrice ?? 0))}</td> : null}</tr>;
          })}</tbody>
        </table>
        {!filteredReportBalances.length ? <p className="border-b p-5 text-center text-[9px] text-[#626a62]">No stock balances match the selected branch and brand.</p> : null}
      </section>

      <section className="mt-6 break-before-page">
        <h2 className="border-b-2 border-[#174f20] pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#174f20]">Movement ledger</h2>
        <table className="mt-2 w-full table-fixed text-[8px]">
          <thead className="bg-[#174f20] text-left uppercase text-white"><tr><th className="w-[11%] px-2 py-2">Date</th><th className="w-[21%] px-2 py-2">Brand / Item</th><th className="w-[12%] px-2 py-2">Type</th><th className="w-[19%] px-2 py-2">From / To</th><th className="w-[9%] px-2 py-2 text-right">Qty</th><th className="px-2 py-2">Reference</th></tr></thead>
          <tbody>{filteredReportMovements.map((entry) => <tr className="border-b" key={entry.id}><td className="px-2 py-2">{formatDate(entry.occurredAt)}</td><td className="px-2 py-2"><strong>{entry.offeringName}</strong><br /><span className="text-[#626a62]">{entry.brandName}</span></td><td className="px-2 py-2">{titleCase(entry.movementType)}{entry.movementPurpose ? <><br /><span className="text-[#626a62]">{titleCase(entry.movementPurpose)}</span></> : null}</td><td className="px-2 py-2">{entry.fromLocationName || "—"} → {entry.toLocationName || "—"}</td><td className="px-2 py-2 text-right font-bold">{entry.quantity}</td><td className="break-all px-2 py-2">{entry.externalReference || entry.referenceNumber}</td></tr>)}</tbody>
        </table>
        {!filteredReportMovements.length ? <p className="border-b p-5 text-center text-[9px] text-[#626a62]">No inventory movements match the selected filters and dates.</p> : null}
      </section>

      <footer className="mt-8 border-t-2 border-[#c7a13a] pt-3 text-center text-[8px] text-[#4f574f]"><p>Vlingo Systems Nigeria Limited &nbsp;|&nbsp; This report contains only inventory records permitted for the signed-in user.</p><p className="mt-2 bg-[#174f20] py-2 font-semibold tracking-[0.08em] text-white">Solar • Energy • Infrastructure Solutions</p></footer>
    </article>
    </>
  );
}
