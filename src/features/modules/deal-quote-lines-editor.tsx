"use client";

import { PackagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { calculateDealQuoteLine, summarizeDealQuote } from "@/features/modules/deal-quote-utils";
import { formatCurrency, titleCase } from "@/lib/utils";
import type { DealQuoteFulfillment, DealQuoteLine, DealQuoteLineType, Offering } from "@/types/crm";

const lineTypes: DealQuoteLineType[] = [
  "inventoryProduct",
  "externalMaterial",
  "service",
  "labour",
  "transport",
  "other",
];

const fulfillmentLabels: Record<DealQuoteFulfillment, string> = {
  checkStock: "Check stock when project starts",
  procureToStock: "Procure and receive into inventory",
  directToSite: "Procure directly to project site",
  service: "Service / non-stock cost",
};

function lineId() {
  return `quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultFulfillment(lineType: DealQuoteLineType): DealQuoteFulfillment {
  if (lineType === "inventoryProduct") return "checkStock";
  if (lineType === "externalMaterial") return "directToSite";
  return "service";
}

function newLine(lineType: DealQuoteLineType = "inventoryProduct"): DealQuoteLine {
  return calculateDealQuoteLine({
    id: lineId(),
    lineType,
    fulfillment: defaultFulfillment(lineType),
    description: "",
    quantity: 1,
    unitOfMeasure: lineType === "labour" ? "job" : lineType === "transport" ? "trip" : "unit",
    unitPrice: 0,
    discountAmount: 0,
    taxRate: 0,
    estimatedUnitCost: 0,
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
  });
}

export function DealQuoteLinesEditor({
  disabled,
  locked,
  lines,
  offerings,
  onChange,
}: {
  disabled?: boolean;
  locked?: boolean;
  lines: DealQuoteLine[];
  offerings: Offering[];
  onChange: (lines: DealQuoteLine[]) => void;
}) {
  const activeOfferings = offerings.filter((item) => item.status === "active" && item.vertical === "solar");

  function updateLine(id: string, updates: Partial<DealQuoteLine>) {
    onChange(lines.map((line) => line.id === id ? calculateDealQuoteLine({ ...line, ...updates }) : line));
  }

  function chooseType(line: DealQuoteLine, lineType: DealQuoteLineType) {
    updateLine(line.id, {
      lineType,
      fulfillment: defaultFulfillment(lineType),
      ...(lineType === line.lineType ? {} : {
        brandId: undefined,
        brandName: undefined,
        offeringId: undefined,
        offeringName: undefined,
        offeringType: undefined,
        sku: undefined,
      }),
    });
  }

  function chooseOffering(line: DealQuoteLine, offeringId: string) {
    const offering = activeOfferings.find((item) => item.id === offeringId);
    if (!offering) {
      updateLine(line.id, { offeringId: undefined, offeringName: undefined });
      return;
    }
    const isInventory = ["material", "solarEquipment"].includes(offering.type);
    updateLine(line.id, {
      brandId: offering.brandId,
      brandName: offering.brandName,
      description: offering.name,
      estimatedUnitCost: Number(offering.costPrice ?? 0),
      fulfillment: isInventory ? "checkStock" : "service",
      lineType: isInventory ? "inventoryProduct" : "service",
      offeringId: offering.id,
      offeringName: offering.name,
      offeringType: offering.type,
      sku: offering.sku,
      unitOfMeasure: offering.unitOfMeasure || "unit",
      unitPrice: Number(offering.sellingPrice ?? 0),
    });
  }

  const { discount, estimatedCost, subtotal, tax, total } = summarizeDealQuote(lines);

  return (
    <section className="grid gap-4 rounded-md border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Installation quotation</h3>
          <p className="mt-1 text-xs text-muted-foreground">Add every customer-facing product and service. Inventory quantities are checked and allocated only after the deal becomes an installation project.</p>
        </div>
        <Button disabled={disabled} onClick={() => onChange([...lines, newLine()])} size="sm" type="button" variant="outline">
          <PackagePlus className="h-4 w-4" />
          Add line
        </Button>
      </div>
      {locked ? <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">This quotation is locked because the deal already has an installation project. Manage delivery quantities and costs in the linked project.</div> : null}

      {lines.map((line, index) => (
        <div className="grid gap-3 rounded-md border bg-white p-3" key={line.id}>
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">Line {index + 1}</strong>
            <Button aria-label={`Remove line ${index + 1}`} disabled={disabled} onClick={() => onChange(lines.filter((item) => item.id !== line.id))} size="sm" type="button" variant="ghost">
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Line type">
              <Select disabled={disabled} value={line.lineType} onChange={(event) => chooseType(line, event.target.value as DealQuoteLineType)}>
                {lineTypes.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
              </Select>
            </Field>
            {(line.lineType === "inventoryProduct" || line.lineType === "service") ? (
              <Field className="xl:col-span-2" label={line.lineType === "inventoryProduct" ? "Catalog product" : "Catalog service (optional)"}>
                <Select disabled={disabled} value={line.offeringId ?? ""} onChange={(event) => chooseOffering(line, event.target.value)}>
                  <option value="">Select catalog item</option>
                  {activeOfferings.map((offering) => <option key={offering.id} value={offering.id}>{offering.name} · {titleCase(offering.type)}{offering.sku ? ` · ${offering.sku}` : ""}</option>)}
                </Select>
              </Field>
            ) : null}
            <Field className={(line.lineType === "inventoryProduct" || line.lineType === "service") ? "xl:col-span-1" : "xl:col-span-3"} label="Description">
              <Input disabled={disabled} required value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} />
            </Field>
            <Field label="Quantity">
              <Input disabled={disabled} min="0.01" required step="any" type="number" value={line.quantity || ""} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} />
            </Field>
            <Field label="Unit">
              <Input disabled={disabled} placeholder="unit, job, trip…" value={line.unitOfMeasure ?? ""} onChange={(event) => updateLine(line.id, { unitOfMeasure: event.target.value })} />
            </Field>
            <Field label="Selling unit price">
              <Input disabled={disabled} min="0" required step="any" type="number" value={line.unitPrice || ""} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} />
            </Field>
            <Field label="Estimated unit cost">
              <Input disabled={disabled} min="0" step="any" type="number" value={line.estimatedUnitCost || ""} onChange={(event) => updateLine(line.id, { estimatedUnitCost: Number(event.target.value) })} />
            </Field>
            <Field label="Line discount">
              <Input disabled={disabled} min="0" step="any" type="number" value={line.discountAmount || ""} onChange={(event) => updateLine(line.id, { discountAmount: Number(event.target.value) })} />
            </Field>
            <Field label="VAT / tax %">
              <Input disabled={disabled} max="100" min="0" step="any" type="number" value={line.taxRate || ""} onChange={(event) => updateLine(line.id, { taxRate: Number(event.target.value) })} />
            </Field>
            {line.lineType === "inventoryProduct" ? (
              <Field className="md:col-span-2" label="Planned fulfillment">
                <Select disabled={disabled} value={line.fulfillment} onChange={(event) => updateLine(line.id, { fulfillment: event.target.value as DealQuoteFulfillment })}>
                  {(["checkStock", "procureToStock", "directToSite"] as DealQuoteFulfillment[]).map((value) => <option key={value} value={value}>{fulfillmentLabels[value]}</option>)}
                </Select>
              </Field>
            ) : null}
            <div className="grid content-end rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Line total</span>
              <strong>{formatCurrency(line.totalAmount)}</strong>
            </div>
          </div>
        </div>
      ))}

      {!lines.length ? (
        <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">No quotation lines yet. Add inventory products, external materials, services, labour, or transport.</div>
      ) : null}

      <div className="grid gap-2 rounded-md bg-primary/5 p-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
        <div><span className="text-muted-foreground">Subtotal</span><strong className="block">{formatCurrency(subtotal)}</strong></div>
        <div><span className="text-muted-foreground">Discount</span><strong className="block">{formatCurrency(discount)}</strong></div>
        <div><span className="text-muted-foreground">Tax</span><strong className="block">{formatCurrency(tax)}</strong></div>
        <div><span className="text-muted-foreground">Customer total</span><strong className="block text-primary">{formatCurrency(total)}</strong></div>
        <div><span className="text-muted-foreground">Estimated internal cost</span><strong className="block">{formatCurrency(estimatedCost)}</strong></div>
      </div>
    </section>
  );
}
