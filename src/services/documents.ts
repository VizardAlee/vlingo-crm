"use client";

import { collection, getDocs, orderBy, query, serverTimestamp, where, addDoc, type Timestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { createReference } from "@/lib/utils";
import { orgCollectionPath } from "@/services/firestore-paths";

export type RelatedEntityType = "lead" | "client" | "property" | "unit" | "task" | "owner" | "developer" | "management";

export interface DocumentRecord {
  id: string;
  address?: string;
  branchId: string;
  category: string;
  contentType: string;
  createdAt?: Date;
  createdBy: string;
  downloadURL: string;
  fileName: string;
  isDeleted: boolean;
  organizationId: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
  relatedEntityType?: RelatedEntityType;
  size: number;
  status: "active" | "archived";
  storagePath: string;
  title: string;
  updatedAt?: Date;
  updatedBy: string;
}

export interface UploadDocumentInput {
  branchId: string;
  category: string;
  file: File;
  organizationId: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
  relatedEntityType?: RelatedEntityType;
  title: string;
  userId: string;
}

function assertFirebase() {
  if (!db || !storage) {
    throw new Error("Firebase Firestore or Storage is not configured.");
  }

  return { db, storage };
}

function normalizeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }

  return undefined;
}

function safeFileName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function listDocuments(organizationId: string) {
  const { db: firestore } = assertFirebase();
  const snapshot = await getDocs(query(collection(firestore, orgCollectionPath(organizationId, "documents")), where("isDeleted", "==", false), orderBy("updatedAt", "desc")));

  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      createdAt: normalizeDate(data.createdAt),
      updatedAt: normalizeDate(data.updatedAt),
    } as DocumentRecord;
  });
}

export async function uploadDocument(input: UploadDocumentInput) {
  const firebase = assertFirebase();
  const reference = createReference("DOC");
  const fileName = safeFileName(input.file.name) || "document";
  const storagePath = `organizations/${input.organizationId}/documents/${reference}-${fileName}`;
  const storageRef = ref(firebase.storage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || "application/octet-stream" });
  const downloadURL = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(firebase.db, orgCollectionPath(input.organizationId, "documents")), {
    branchId: input.branchId,
    category: input.category,
    contentType: input.file.type || "application/octet-stream",
    createdAt: serverTimestamp(),
    createdBy: input.userId,
    downloadURL,
    fileName,
    isDeleted: false,
    organizationId: input.organizationId,
    relatedEntityId: input.relatedEntityId || "",
    relatedEntityName: input.relatedEntityName || "",
    relatedEntityType: input.relatedEntityType || "",
    size: input.file.size,
    status: "active",
    storagePath,
    title: input.title.trim() || fileName,
    updatedAt: serverTimestamp(),
    updatedBy: input.userId,
  });

  return docRef.id;
}
