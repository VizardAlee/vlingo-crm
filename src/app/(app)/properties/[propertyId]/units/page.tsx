"use client";

import { ModuleListPage } from "@/features/modules/module-pages";
import { moduleConfigs } from "@/features/modules/module-config";
import { useParams } from "next/navigation";

export default function PropertyUnitsPage() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = String(params.propertyId);

  return (
    <ModuleListPage
      config={moduleConfigs.propertyUnits}
      createHref={`/units/new?propertyId=${propertyId}`}
      description="Units linked to this property. Add blocks, floors, plot numbers, pricing, and availability per unit."
      fixedFilters={[{ field: "propertyId", value: propertyId }]}
      title="Property Units"
    />
  );
}
