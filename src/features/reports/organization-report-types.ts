export interface ReportBreakdownRow {
  label: string;
  value: number;
}

export interface OrganizationReport {
  breakdowns: {
    crmStatus: ReportBreakdownRow[];
    documentBrandSales: ReportBreakdownRow[];
    inventoryByBrand: ReportBreakdownRow[];
    inventoryMovementsByType: ReportBreakdownRow[];
    inventoryValueByBrand: ReportBreakdownRow[];
    projectStatus: ReportBreakdownRow[];
    purchasePaymentStatus: ReportBreakdownRow[];
    purchaseReceivingStatus: ReportBreakdownRow[];
    salesByBrand: ReportBreakdownRow[];
  };
  filters: {
    branchId: string;
    brandId: string;
    dateFrom: string;
    dateTo: string;
  };
  generatedAt: string;
  limitations: string[];
  rows: {
    branches: Array<{
      cashCollected: number;
      inventoryOnHand: number;
      label: string;
      purchaseValue: number;
      salesRevenue: number;
    }>;
    inventoryItems: Array<{
      available: number;
      brand: string;
      category: string;
      costPrice: number;
      label: string;
      onHand: number;
      reorderLevel: number | null;
      reserved: number;
      sku: string;
      status: "inStock" | "lowStock" | "outOfStock";
      stockValue: number;
      unitOfMeasure: string;
    }>;
    inventoryLocations: Array<{
      available: number;
      branch: string;
      itemCount: number;
      label: string;
      lowStockItems: number;
      onHand: number;
      reserved: number;
      stockValue: number;
    }>;
    inventoryOpeningStock: Array<{
      brand: string;
      label: string;
      openingQuantity: number;
      sku: string;
      unitOfMeasure: string;
    }>;
    inventoryReceipts: Array<{
      date: string;
      label: string;
      quantity: number;
      referenceNumber: string;
      source: string;
      type: string;
      unitOfMeasure: string;
    }>;
    inventoryReconciliation: Array<{
      adjustmentIn: number;
      adjustmentOut: number;
      brand: string;
      closingQuantity: number;
      label: string;
      openingQuantity: number;
      receipts: number;
      sales: number;
      sku: string;
      transferIn: number;
      transferOut: number;
      unitOfMeasure: string;
    }>;
    inventorySales: Array<{
      customer: string;
      date: string;
      label: string;
      lineTotal: number | null;
      quantity: number;
      referenceNumber: string;
      salesperson: string;
      unitPrice: number | null;
    }>;
    inventoryTransfers: Array<{
      date: string;
      destination: string;
      label: string;
      quantity: number;
      referenceNumber: string;
      source: string;
      unitOfMeasure: string;
    }>;
    inventoryMovements: Array<{
      destination: string;
      label: string;
      occurredAt: string;
      purpose: string;
      quantity: number;
      referenceNumber: string;
      source: string;
      type: string;
    }>;
    projects: Array<{
      contractValue: number;
      estimatedCost: number;
      label: string;
      margin: number;
      received: number;
      status: string;
    }>;
    suppliers: Array<{
      label: string;
      orderValue: number;
      outstanding: number;
      paid: number;
    }>;
    topProducts: Array<{
      label: string;
      quantity: number;
      revenue: number;
    }>;
  };
  scopeLabel: string;
  summary: {
    activeClients: number;
    cashCollected: number;
    completedTasks: number;
    completedProjects: number;
    financeExpenses: number;
    grossProfit: number;
    inventoryAvailable: number;
    inventoryAdjustmentIn: number;
    inventoryAdjustmentOut: number;
    inventoryClosingQuantity: number;
    inventoryLowStockItems: number;
    inventoryMovements: number;
    inventoryOnHand: number;
    inventoryOpeningQuantity: number;
    inventoryOutOfStockItems: number;
    inventoryReceivedQuantity: number;
    inventoryReserved: number;
    inventorySoldQuantity: number;
    inventoryTrackedItems: number;
    inventoryTransferredIn: number;
    inventoryTransferredOut: number;
    inventoryValue: number;
    netCashFlow: number;
    openPipelineValue: number;
    outstandingSales: number;
    overdueSupplierBalance: number;
    paidExpenses: number;
    projectContractValue: number;
    projectEstimatedCost: number;
    projectEstimatedMargin: number;
    purchaseCount: number;
    purchaseOutstanding: number;
    purchaseValue: number;
    salesCount: number;
    salesRevenue: number;
    unitsSold: number;
  };
}
