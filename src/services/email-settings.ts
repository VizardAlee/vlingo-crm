"use client";

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";

export type EmailSecureMode = "none" | "ssl" | "starttls";

export interface EmailSmtpSettings {
  enabled: boolean;
  hasPassword: boolean;
  host: string;
  port: number;
  replyTo: string;
  secureMode: EmailSecureMode;
  senderEmail: string;
  senderName: string;
  username: string;
  updatedAt?: unknown;
}

export interface SaveEmailSmtpSettingsInput {
  enabled: boolean;
  host: string;
  organizationId: string;
  password?: string;
  port: number;
  replyTo?: string;
  secureMode: EmailSecureMode;
  senderEmail: string;
  senderName: string;
  username: string;
}

function assertFunctions() {
  if (!functions) {
    throw new Error("Firebase Functions are not configured.");
  }

  return functions;
}

export async function getEmailSmtpSettings(organizationId: string) {
  const callable = httpsCallable<{ organizationId: string }, EmailSmtpSettings>(assertFunctions(), "getEmailSmtpSettings");
  const result = await callable({ organizationId });
  return result.data;
}

export async function saveEmailSmtpSettings(input: SaveEmailSmtpSettingsInput) {
  const callable = httpsCallable<SaveEmailSmtpSettingsInput, EmailSmtpSettings>(assertFunctions(), "saveEmailSmtpSettings");
  const result = await callable(input);
  return result.data;
}

export async function sendEmailSmtpTest(organizationId: string, recipient?: string) {
  const callable = httpsCallable<{ organizationId: string; recipient?: string }, { ok: boolean }>(assertFunctions(), "sendEmailSmtpTest");
  await callable({ organizationId, recipient });
}

export async function sendSalesJourneyEmail(input: {
  body: string;
  leadId: string;
  organizationId: string;
  recipient?: string;
  subject: string;
}) {
  const callable = httpsCallable<typeof input, { activityId: string; ok: boolean }>(assertFunctions(), "sendSalesJourneyEmail");
  const result = await callable(input);
  return result.data;
}
