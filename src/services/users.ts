"use client";

import { sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, orderBy, query, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase/client";
import { orgCollectionPath } from "@/services/firestore-paths";
import type { Branch, Member, RoleName } from "@/types/crm";

export interface InviteUserInput {
  branchId: string;
  displayName: string;
  email: string;
  organizationId: string;
  phoneNumber?: string;
  role: RoleName;
}

export interface UpdateMemberInput {
  branchId: string;
  organizationId: string;
  role: RoleName;
  uid: string;
}

interface InviteUserResult {
  email: string;
  uid: string;
}

function assertFirebase() {
  if (!db || !functions || !auth) {
    throw new Error("Firebase is not configured.");
  }

  return { auth, db, functions };
}

function normalizeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }

  return undefined;
}

export async function listMembers(organizationId: string) {
  const { db: firestore } = assertFirebase();
  const snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "members")), orderBy("displayName", "asc")));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      createdAt: normalizeDate(data.createdAt),
      updatedAt: normalizeDate(data.updatedAt),
    } as Member;
  });
}

export async function listBranches(organizationId: string) {
  const { db: firestore } = assertFirebase();
  const snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "branches")), orderBy("name", "asc")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Branch);
}

export async function inviteOrganizationMember(input: InviteUserInput) {
  const firebase = assertFirebase();
  const callable = httpsCallable<InviteUserInput, InviteUserResult>(firebase.functions, "provisionOrganizationMember");
  const result = await callable(input);
  await sendPasswordResetEmail(firebase.auth, result.data.email);
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
