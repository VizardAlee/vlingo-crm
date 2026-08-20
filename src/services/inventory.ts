"use client";

import { collection, getDocs, query, serverTimestamp, where, addDoc, type QueryConstraint, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { createOrgRecord, type WriteContext } from "@/services/repository";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { InventoryBalance, InventoryBrand, InventoryComment, InventoryLocation, InventoryMovement, InventoryMovementType, Member, Offering } from "@/types/crm";

export interface RecordInventoryMovementInput {
  organizationId: string;
  branchId: string;
  offeringId: string;
  movementType: InventoryMovementType;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  externalReference?: string;
  notes?: string;
  occurredAt?: string;
}

function assertDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

function dateValue(value: unknown) {
  return value && typeof value === "object" && "toDate" in value ? (value as Timestamp).toDate() : value;
}

function partnerBrandIds(member: Member | null) {
  return member?.role === "brandPartner" || member?.roles?.includes("brandPartner") ? member.partnerBrandIds ?? [] : null;
}

async function scopedCollection<T extends { id: string }>(organizationId: string, collectionName: "inventoryBalances" | "inventoryBrands" | "inventoryComments" | "inventoryLocations" | "inventoryMovements" | "offerings", member: Member | null, constraints: QueryConstraint[] = []) {
  const firestore = assertDb();
  const brandIds = partnerBrandIds(member);
  if (brandIds && !brandIds.length) return [];

  try {
    const branchConstraints = !brandIds && member && member.branchAccess !== "all" && member.role !== "superAdmin" && !member.roles?.includes("superAdmin")
      ? [where("branchId", "==", member.branchId)]
      : [];
    const snapshots = brandIds
      ? await Promise.all(brandIds.map((brandId) => getDocs(query(collection(firestore, orgCollectionPath(organizationId, collectionName)), where("brandId", "==", brandId), ...constraints))))
      : [await getDocs(query(collection(firestore, orgCollectionPath(organizationId, collectionName)), ...branchConstraints, ...constraints))];
    const records = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
    return Array.from(new Map(records.map((item) => [item.id, item])).values());
  } catch (error) {
    throw enrichFirestoreError(error, { action: "list", collectionName, organizationId });
  }
}

export async function listInventoryBrands(organizationId: string, member: Member | null) {
  const scoped = partnerBrandIds(member);
  if (scoped) {
    const firestore = assertDb();
    const snapshots = await Promise.all(scoped.map((id) => getDocs(query(collection(firestore, orgCollectionPath(organizationId, "inventoryBrands")), where("brandId", "==", id)))));
    return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as InventoryBrand));
  }
  return scopedCollection<InventoryBrand>(organizationId, "inventoryBrands", member).then((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listInventoryLocations(organizationId: string, member: Member | null) {
  return scopedCollection<InventoryLocation>(organizationId, "inventoryLocations", member).then((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listInventoryItems(organizationId: string, member: Member | null) {
  return scopedCollection<Offering>(organizationId, "offerings", member, [where("isDeleted", "==", false)]);
}

export function listInventoryBalances(organizationId: string, member: Member | null) {
  return scopedCollection<InventoryBalance>(organizationId, "inventoryBalances", member);
}

export async function listInventoryMovements(organizationId: string, member: Member | null) {
  const records = await scopedCollection<InventoryMovement>(organizationId, "inventoryMovements", member, [where("isDeleted", "==", false)]);
  return records.map((item) => ({ ...item, createdAt: dateValue(item.createdAt), occurredAt: dateValue(item.occurredAt) } as InventoryMovement))
    .sort((a, b) => new Date(String(b.occurredAt)).getTime() - new Date(String(a.occurredAt)).getTime());
}

export async function listInventoryComments(organizationId: string, member: Member | null) {
  const records = await scopedCollection<InventoryComment>(organizationId, "inventoryComments", member, [where("isDeleted", "==", false)]);
  return records.map((item) => ({ ...item, createdAt: dateValue(item.createdAt) } as InventoryComment))
    .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime());
}

export function createInventoryBrand(data: Pick<InventoryBrand, "name" | "code" | "description" | "contactName" | "contactEmail" | "status">, context: WriteContext) {
  return createOrgRecord("inventoryBrands", { ...data, brandId: "pending" }, context, "BRD").then(async (id) => {
    const firestore = assertDb();
    const { updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
    await updateDoc(firestoreDoc(firestore, orgCollectionPath(context.organizationId, "inventoryBrands"), id), { brandId: id });
    return id;
  });
}

export function createInventoryLocation(data: Pick<InventoryLocation, "name" | "code" | "address" | "locationType" | "status">, context: WriteContext) {
  return createOrgRecord("inventoryLocations", data, context, "LOC");
}

export async function addInventoryComment(input: { organizationId: string; branchId: string; brandId: string; message: string; reportPeriod?: string; userId: string; userEmail?: string; userName?: string }) {
  const firestore = assertDb();
  await addDoc(collection(firestore, orgCollectionPath(input.organizationId, "inventoryComments")), {
    organizationId: input.organizationId,
    branchId: input.branchId,
    brandId: input.brandId,
    message: input.message.trim(),
    reportPeriod: input.reportPeriod ?? "",
    createdAt: serverTimestamp(),
    createdBy: input.userId,
    createdByEmail: input.userEmail ?? "",
    createdByName: input.userName ?? "",
    isDeleted: false,
  });
}

export async function recordInventoryMovement(input: RecordInventoryMovementInput) {
  if (!functions) throw new Error("Firebase Functions are not configured.");
  const result = await httpsCallable<RecordInventoryMovementInput, { movementId: string; referenceNumber: string }>(functions, "recordInventoryMovement")(input);
  return result.data;
}
