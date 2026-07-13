"use client";

import {
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
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { createReference } from "@/lib/utils";
import { orgCollectionPath, type OrgCollection } from "@/services/firestore-paths";

export interface WriteContext {
  organizationId: string;
  branchId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
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

const offlineWritableCollections = new Set<OrgCollection>([
  "activities",
  "clients",
  "leads",
  "marketingCampaigns",
  "tasks",
]);

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function assertOfflineWriteSupported(collectionName: OrgCollection) {
  if (isOffline() && !offlineWritableCollections.has(collectionName)) {
    throw new Error("This action requires an internet connection because it affects finance, inventory, files, or another protected workflow.");
  }
}

function queueOfflineWrite(operation: Promise<void>, label: string) {
  window.dispatchEvent(new CustomEvent("vlingo:offline-write-queued", { detail: { label } }));
  void operation.catch((error) => {
    console.error(`[Offline write failed] ${label}`, error);
    window.dispatchEvent(new CustomEvent("vlingo:offline-write-failed", { detail: { label } }));
  });
}

function logQueryError(context: string, error: unknown) {
  console.error(`[Firestore query failed] ${context}`, error);
}

export async function listOrgRecords<T extends { id: string }>(
  organizationId: string,
  collectionName: OrgCollection,
  constraints: QueryConstraint[] = [],
) {
  const firestore = assertDb();
  let snapshot;
  try {
    snapshot = await getDocs(
      query(
        collection(firestore, orgCollectionPath(organizationId, collectionName)),
        where("isDeleted", "==", false),
        orderBy("updatedAt", "desc"),
        limit(100),
        ...constraints,
      ),
    );
  } catch (error) {
    const nextError = enrichFirestoreError(error, { action: "list", collectionName, organizationId });
    logQueryError(`${organizationId}/${collectionName}`, nextError);
    throw nextError;
  }

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
}

export async function getOrgRecord<T extends { id: string }>(
  organizationId: string,
  collectionName: OrgCollection,
  id: string,
) {
  const firestore = assertDb();
  let snapshot;
  try {
    snapshot = await getDoc(doc(firestore, orgCollectionPath(organizationId, collectionName), id));
  } catch (error) {
    const nextError = enrichFirestoreError(error, { action: "read", collectionName, organizationId, path: `${orgCollectionPath(organizationId, collectionName)}/${id}` });
    logQueryError(`${organizationId}/${collectionName}/${id}`, nextError);
    throw nextError;
  }
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
  assertOfflineWriteSupported(collectionName);
  const payload = serialize({
    ...data,
    organizationId: context.organizationId,
    branchId: context.branchId,
    createdAt: serverTimestamp(),
    createdBy: context.userId,
    createdByEmail: context.userEmail,
    createdByName: context.userName,
    updatedAt: serverTimestamp(),
    updatedBy: context.userId,
    updatedByEmail: context.userEmail,
    updatedByName: context.userName,
    isDeleted: false,
    referenceNumber: data.referenceNumber ?? createReference(prefix),
  }) as WithFieldValue<DocumentData>;

  try {
    const ref = doc(collection(firestore, orgCollectionPath(context.organizationId, collectionName)));
    const operation = setDoc(ref, payload);
    if (isOffline()) {
      queueOfflineWrite(operation, `create:${collectionName}:${ref.id}`);
      return ref.id;
    }
    await operation;
    return ref.id;
  } catch (error) {
    throw enrichFirestoreError(error, { action: "create", collectionName, organizationId: context.organizationId });
  }
}

export async function updateOrgRecord<T extends Record<string, unknown>>(
  collectionName: OrgCollection,
  id: string,
  data: Partial<T>,
  context: WriteContext,
) {
  const firestore = assertDb();
  assertOfflineWriteSupported(collectionName);
  try {
    const operation = updateDoc(doc(firestore, orgCollectionPath(context.organizationId, collectionName), id), serialize({
      ...data,
      organizationId: context.organizationId,
      updatedAt: serverTimestamp(),
      updatedBy: context.userId,
      updatedByEmail: context.userEmail,
      updatedByName: context.userName,
    }));
    if (isOffline()) {
      queueOfflineWrite(operation, `update:${collectionName}:${id}`);
      return;
    }
    await operation;
  } catch (error) {
    throw enrichFirestoreError(error, { action: "update", collectionName, organizationId: context.organizationId, path: `${orgCollectionPath(context.organizationId, collectionName)}/${id}` });
  }
}

export async function softDeleteOrgRecord(collectionName: OrgCollection, id: string, context: WriteContext) {
  const firestore = assertDb();
  if (isOffline()) {
    throw new Error("Deleting records requires an internet connection so the server can verify your permission.");
  }
  try {
    await updateDoc(doc(firestore, orgCollectionPath(context.organizationId, collectionName), id), {
      deletedAt: serverTimestamp(),
      deletedBy: context.userId,
      isDeleted: true,
      updatedAt: serverTimestamp(),
      updatedBy: context.userId,
    });
  } catch (error) {
    throw enrichFirestoreError(error, { action: "delete", collectionName, organizationId: context.organizationId, path: `${orgCollectionPath(context.organizationId, collectionName)}/${id}` });
  }
}

export async function writeAuditLog(context: WriteContext, action: string, entityType: string, entityId: string, newValue?: unknown) {
  if (!functions) {
    console.warn("Firebase Functions are not configured; audit log skipped.");
    return;
  }

  try {
    await httpsCallable(functions, "writeProtectedAuditLog")({
      action,
      branchId: context.branchId,
      entityId,
      entityType,
      newValue,
      organizationId: context.organizationId,
    });
  } catch (error) {
    console.warn("Audit log write failed; primary record operation completed.", error);
  }
}
