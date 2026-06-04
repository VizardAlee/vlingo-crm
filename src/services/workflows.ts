"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

export interface ConvertLeadResult {
  clientId: string;
}

function assertFunctions() {
  if (!functions) {
    throw new Error("Firebase Functions are not configured.");
  }

  return functions;
}

export async function convertLeadToClient(organizationId: string, leadId: string) {
  const callable = httpsCallable<{ organizationId: string; leadId: string }, ConvertLeadResult>(assertFunctions(), "convertLeadToClient");
  const result = await callable({ organizationId, leadId });
  return result.data;
}
