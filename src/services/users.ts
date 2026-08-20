"use client";

import { collection, getDocs, orderBy, query, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { Branch, BranchAccess, Member, RoleName } from "@/types/crm";

export interface InviteUserInput {
  branchId: string;
  branchAccess?: BranchAccess;
  displayName: string;
  email: string;
  organizationId: string;
  phoneNumber?: string;
  partnerBrandIds?: string[];
  role?: RoleName;
  roles: RoleName[];
}

export interface UpdateMemberInput {
  branchId: string;
  branchAccess?: BranchAccess;
  organizationId: string;
  partnerBrandIds?: string[];
  role?: RoleName;
  roles: RoleName[];
  uid: string;
}

interface InviteUserResult {
  email: string;
  setupLink: string;
  uid: string;
}

function assertFirebase() {
  if (!db || !functions || !auth) {
    throw new Error("Firebase is not configured.");
  }

  return { auth, db, functions };
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

export async function listMembers(organizationId: string) {
  const firestore = assertDb();
  let snapshot;
  try {
    snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "members")), orderBy("displayName", "asc")));
  } catch (error) {
    throw enrichFirestoreError(error, { action: "list", collectionName: "members", organizationId });
  }
  return snapshot.docs.map((item) => {
    const data = item.data();
    const role = data.role as RoleName;
    const roles = Array.isArray(data.roles) ? data.roles as RoleName[] : [];
    return {
      id: item.id,
      ...data,
      branchAccess: data.branchAccess === "all" ? "all" : "own",
      roles: Array.from(new Set([...roles, role].filter(Boolean))),
      createdAt: normalizeDate(data.createdAt),
      updatedAt: normalizeDate(data.updatedAt),
    } as Member;
  });
}

export async function listBranches(organizationId: string) {
  const firestore = assertDb();
  let snapshot;
  try {
    snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "branches")), orderBy("name", "asc")));
  } catch (error) {
    throw enrichFirestoreError(error, { action: "list", organizationId, path: `organizations/${organizationId}/branches`, requiredPermission: "active organization membership" });
  }
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Branch);
}

export async function inviteOrganizationMember(input: InviteUserInput) {
  const firebase = assertFirebase();
  const callable = httpsCallable<InviteUserInput, InviteUserResult>(firebase.functions, "provisionOrganizationMember");
  const result = await callable(input);
  return result.data;
}

export async function resendOrganizationMemberInvite(organizationId: string, uid: string) {
  const firebase = assertFirebase();
  const callable = httpsCallable<{ organizationId: string; uid: string }, InviteUserResult>(firebase.functions, "resendOrganizationMemberInvite");
  const result = await callable({ organizationId, uid });
  return result.data;
}

export async function updateOrganizationMember(input: UpdateMemberInput) {
  const { functions: callableFunctions } = assertFirebase();
  await httpsCallable<UpdateMemberInput, { ok: boolean }>(callableFunctions, "updateOrganizationMemberRole")(input);
}

export async function disableOrganizationMember(organizationId: string, uid: string) {
  const { functions: callableFunctions } = assertFirebase();
  await httpsCallable<{ organizationId: string; uid: string }, { ok: boolean }>(callableFunctions, "disableOrganizationMember")({ organizationId, uid });
}

export async function reactivateOrganizationMember(organizationId: string, uid: string) {
  const { functions: callableFunctions } = assertFirebase();
  await httpsCallable<{ organizationId: string; uid: string }, { ok: boolean }>(callableFunctions, "reactivateOrganizationMember")({ organizationId, uid });
}
