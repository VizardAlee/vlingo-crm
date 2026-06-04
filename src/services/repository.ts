"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { createReference } from "@/lib/utils";
import { orgCollectionPath, type OrgCollection } from "@/services/firestore-paths";

export interface WriteContext {
  organizationId: string;
  branchId: string;
  userId: string;
}

function assertDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }

  return db;
}

function serialize(value: DocumentData) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export async function listOrgRecords<T extends { id: string }>(
  organizationId: string,
  collectionName: OrgCollection,
  constraints: QueryConstraint[] = [],
) {
  const firestore = assertDb();
  const snapshot = await getDocs(
    query(
      collection(firestore, orgCollectionPath(organizationId, collectionName)),
      where("isDeleted", "==", false),
      orderBy("updatedAt", "desc"),
      limit(100),
      ...constraints,
    ),
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

export async function getOrgRecord<T extends { id: string }>(
  organizationId: string,
  collectionName: OrgCollection,
  id: string,
) {
  const firestore = assertDb();
  const snapshot = await getDoc(doc(firestore, orgCollectionPath(organizationId, collectionName), id));
  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function createOrgRecord<T extends Record<string, unknown>>(
  collectionName: OrgCollection,
  data: T,
  context: WriteContext,
  prefix: string,
) {
  const firestore = assertDb();
  const payload = serialize({
    ...data,
    organizationId: context.organizationId,
    branchId: context.branchId,
    createdAt: serverTimestamp(),
    createdBy: context.userId,
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
    isDeleted: false,
    referenceNumber: data.referenceNumber ?? createReference(prefix),
  }) as WithFieldValue<DocumentData>;

  const ref = await addDoc(collection(firestore, orgCollectionPath(context.organizationId, collectionName)), payload);
  return ref.id;
}

export async function updateOrgRecord<T extends Record<string, unknown>>(
  collectionName: OrgCollection,
  id: string,
  data: Partial<T>,
  context: WriteContext,
) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, orgCollectionPath(context.organizationId, collectionName), id), serialize({
    ...data,
    organizationId: context.organizationId,
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
  }));
}

export async function softDeleteOrgRecord(collectionName: OrgCollection, id: string, context: WriteContext) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, orgCollectionPath(context.organizationId, collectionName), id), {
    deletedAt: serverTimestamp(),
    deletedBy: context.userId,
    isDeleted: true,
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
  });
}

export async function writeAuditLog(context: WriteContext, action: string, entityType: string, entityId: string, newValue?: unknown) {
  const firestore = assertDb();
  await setDoc(doc(collection(firestore, orgCollectionPath(context.organizationId, "auditLogs"))), {
    action,
    actorId: context.userId,
    actorName: context.userId,
    branchId: context.branchId,
    createdAt: serverTimestamp(),
    entityId,
    entityType,
    newValue,
    organizationId: context.organizationId,
  });
}
