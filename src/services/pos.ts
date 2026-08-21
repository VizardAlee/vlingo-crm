"use client";

import { collection, getDocs, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { Member, PosSale, RentalPaymentMethod } from "@/types/crm";

function dateValue(value: unknown) {
  return value && typeof value === "object" && "toDate" in value
    ? (value as Timestamp).toDate()
    : value;
}

export async function listPosSales(organizationId: string, member: Member | null) {
  if (!db) throw new Error("Firebase is not configured.");
  const constraints = member && member.branchAccess !== "all" && member.role !== "superAdmin" && !member.roles?.includes("superAdmin")
    ? [where("branchId", "==", member.branchId)]
    : [];
  try {
    const snapshot = await getDocs(query(
      collection(db, orgCollectionPath(organizationId, "posSales")),
      ...constraints,
      orderBy("soldAt", "desc"),
    ));
    return snapshot.docs
      .filter((item) => item.data().isDeleted !== true)
      .map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: dateValue(item.data().createdAt),
        soldAt: dateValue(item.data().soldAt),
        updatedAt: dateValue(item.data().updatedAt),
      }) as PosSale);
  } catch (error) {
    throw enrichFirestoreError(error, {
      action: "list",
      collectionName: "posSales",
      organizationId,
      requiredPermission: "pos.read",
    });
  }
}

async function posCallable<TInput, TResult>(name: string, input: TInput) {
  if (!functions) throw new Error("Firebase Functions are not configured.");
  return (await httpsCallable<TInput, TResult>(functions, name)(input)).data;
}

export interface CreatePosSaleInput {
  organizationId: string;
  branchId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  lines: Array<{ offeringId: string; quantity: number; discountAmount?: number }>;
  taxRate?: number;
  amountPaid?: number;
  paymentMethod?: RentalPaymentMethod;
  paymentReference?: string;
  soldAt?: string;
  notes?: string;
}

export function createPosSale(input: CreatePosSaleInput) {
  return posCallable<CreatePosSaleInput, {
    saleId: string;
    referenceNumber: string;
    invoiceNumber: string;
    receiptNumber: string;
    totalAmount: number;
  }>("createPosSale", input);
}

export function recordPosSalePayment(input: {
  organizationId: string;
  saleId: string;
  amount: number;
  paymentMethod: RentalPaymentMethod;
  paymentReference?: string;
}) {
  return posCallable<typeof input, {
    ok: boolean;
    receiptNumber: string;
    balanceDue: number;
    paymentStatus: "partPaid" | "paid";
  }>("recordPosSalePayment", input);
}
