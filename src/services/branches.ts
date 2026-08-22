"use client";

import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase/client";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { Branch } from "@/types/crm";

export type BranchStatus = Branch["status"];

export interface BranchRecord extends Branch {
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface SaveBranchInput {
  address: string;
  code: string;
  name: string;
  organizationId: string;
  userId: string;
}

export interface UpdateBranchInput extends SaveBranchInput {
  branchId: string;
}

function assertDb() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return db;
}

function normalizeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }

  return undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBranchInput(input: SaveBranchInput) {
  const address = input.address.trim();
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!name || !code || !address) {
    throw new Error("Branch name, code, and address are required.");
  }

  return { address, code, name };
}

export async function listOrganizationBranches(organizationId: string) {
  const firestore = assertDb();
  const snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "branches")), orderBy("name", "asc")));

  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      createdAt: normalizeDate(data.createdAt),
      updatedAt: normalizeDate(data.updatedAt),
    } as BranchRecord;
  });
}

export async function createOrganizationBranch(input: SaveBranchInput) {
  const firestore = assertDb();
  const normalized = normalizeBranchInput(input);
  const branchId = slugify(normalized.code || normalized.name);

  if (!branchId) {
    throw new Error("Enter a branch code or name.");
  }

  const branchRef = doc(firestore, orgCollectionPath(input.organizationId, "branches"), branchId);
  const existing = await getDoc(branchRef);

  if (existing.exists()) {
    throw new Error("A branch with this code already exists.");
  }

  await setDoc(branchRef, {
    address: normalized.address,
    code: normalized.code,
    createdAt: serverTimestamp(),
    createdBy: input.userId,
    name: normalized.name,
    organizationId: input.organizationId,
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: input.userId,
  });

  return branchId;
}

export async function updateOrganizationBranch(input: UpdateBranchInput) {
  const firestore = assertDb();
  const normalized = normalizeBranchInput(input);

  await updateDoc(doc(firestore, orgCollectionPath(input.organizationId, "branches"), input.branchId), {
    address: normalized.address,
    code: normalized.code,
    name: normalized.name,
    organizationId: input.organizationId,
    updatedAt: serverTimestamp(),
    updatedBy: input.userId,
  });
}

function assertFunctions() {
  if (!functions) {
    throw new Error("Firebase Functions are not configured.");
  }
  return functions;
}

export async function setOrganizationBranchStatus(
  organizationId: string,
  branchId: string,
  status: BranchStatus,
) {
  await httpsCallable<
    { branchId: string; organizationId: string; status: BranchStatus },
    { ok: boolean }
  >(assertFunctions(), "setOrganizationBranchStatus")({
    branchId,
    organizationId,
    status,
  });
}

export async function deleteOrganizationBranch(
  organizationId: string,
  branchId: string,
) {
  await httpsCallable<
    { branchId: string; organizationId: string },
    { ok: boolean }
  >(assertFunctions(), "deleteOrganizationBranch")({
    branchId,
    organizationId,
  });
}
