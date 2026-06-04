"use client";

import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { orgCollectionPath } from "@/services/firestore-paths";

export interface DashboardMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  activeClients: number;
  activeProperties: number;
  availableUnits: number;
  reservedUnits: number;
  activeDeals: number;
  pipelineValue: number;
  upcomingInspections: number;
  overdueFollowUps: number;
}

async function count(path: string, filters: ReturnType<typeof where>[] = []) {
  if (!db) {
    return 0;
  }

  const snapshot = await getCountFromServer(query(collection(db, path), where("isDeleted", "==", false), ...filters));
  return snapshot.data().count;
}

export async function getDashboardMetrics(organizationId: string): Promise<DashboardMetrics> {
  const [totalLeads, qualifiedLeads, activeClients, activeProperties, availableUnits, reservedUnits, overdueFollowUps] =
    await Promise.all([
      count(orgCollectionPath(organizationId, "leads")),
      count(orgCollectionPath(organizationId, "leads"), [where("status", "==", "qualified")]),
      count(orgCollectionPath(organizationId, "clients"), [where("status", "==", "active")]),
      count(orgCollectionPath(organizationId, "properties"), [where("propertyStatus", "in", ["available", "reserved", "underNegotiation"])]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [where("status", "==", "available")]),
      count(orgCollectionPath(organizationId, "propertyUnits"), [where("status", "==", "reserved")]),
      count(orgCollectionPath(organizationId, "tasks"), [where("status", "==", "overdue")]),
    ]);

  return {
    totalLeads,
    qualifiedLeads,
    activeClients,
    activeProperties,
    availableUnits,
    reservedUnits,
    activeDeals: 0,
    pipelineValue: 0,
    upcomingInspections: 0,
    overdueFollowUps,
  };
}
