"use client";

import { doc, getDoc, serverTimestamp, updateDoc, type Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { enrichFirestoreError } from "@/lib/firebase/permission-errors";
import { orgPath } from "@/services/firestore-paths";
import type { Organization } from "@/types/crm";

export interface OrganizationRecord extends Organization {
  updatedAt?: Date;
  updatedBy?: string;
}

export interface UpdateOrganizationInput {
  legalName: string;
  logoUrl: string;
  name: string;
  organizationId: string;
  primaryColor: string;
  status: Organization["status"];
  userId: string;
}

function assertDb() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  return db;
}

function assertStorage() {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  return storage;
}

function normalizeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }

  return undefined;
}

function normalizeColor(value: string) {
  const color = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("Primary color must be a valid hex color like #14550f.");
  }

  return color.toLowerCase();
}

function safeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function getOrganization(organizationId: string) {
  const firestore = assertDb();
  let snapshot;
  try {
    snapshot = await getDoc(doc(firestore, orgPath(organizationId)));
  } catch (error) {
    throw enrichFirestoreError(error, { action: "read", organizationId, path: orgPath(organizationId), requiredPermission: "active organization membership" });
  }
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    updatedAt: normalizeDate(data.updatedAt),
  } as OrganizationRecord;
}

export async function updateOrganization(input: UpdateOrganizationInput) {
  const name = input.name.trim();
  const legalName = input.legalName.trim();
  const logoUrl = input.logoUrl.trim();
  const primaryColor = normalizeColor(input.primaryColor);

  if (!name || !legalName) {
    throw new Error("Organization name and legal name are required.");
  }

  try {
    await updateDoc(doc(assertDb(), orgPath(input.organizationId)), {
      legalName,
      logoUrl,
      name,
      primaryColor,
      status: input.status,
      updatedAt: serverTimestamp(),
      updatedBy: input.userId,
    });
  } catch (error) {
    throw enrichFirestoreError(error, { action: "update", organizationId: input.organizationId, path: orgPath(input.organizationId), requiredPermission: "users.manage" });
  }
}

export async function uploadOrganizationLogo(input: { file: File; organizationId: string }) {
  if (!input.file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the organization logo.");
  }

  if (input.file.size > 2 * 1024 * 1024) {
    throw new Error("Logo image must be 2 MB or smaller.");
  }

  const firebaseStorage = assertStorage();
  const extension = safeFileName(input.file.name).split(".").pop() || "logo";
  const storagePath = `organizations/${input.organizationId}/branding/logo-${Date.now()}.${extension}`;
  const storageRef = ref(firebaseStorage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type });
  return getDownloadURL(storageRef);
}
