"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { AuditLog } from "@/types/crm";

export async function listAuditLogs(
  organizationId: string,
  branchId: string,
) {
  if (!db) throw new Error("Firebase is not configured.");
  try {
    const snapshot = await getDocs(
      query(
        collection(db, orgCollectionPath(organizationId, "auditLogs")),
        where("branchId", "==", branchId),
        orderBy("createdAt", "desc"),
        limit(250),
      ),
    );
    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        createdAt:
          data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate()
            : data.createdAt,
      } as AuditLog;
    });
  } catch (error) {
    throw enrichFirestoreError(error, {
      action: "list",
      collectionName: "auditLogs",
      organizationId,
    });
  }
}
