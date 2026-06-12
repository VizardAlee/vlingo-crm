import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return format(typeof value === "string" ? new Date(value) : value, "MMM d, yyyy");
}

export function formatPhone(value: string | null | undefined) {
  if (!value) {
    return "Not provided";
  }

  return value.replace(/\s+/g, " ").trim();
}

export function whatsappHref(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `234${digits.slice(1)}`;
  }

  return `https://wa.me/${digits}`;
}

export function titleCase(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function createReference(prefix: string) {
  const date = format(new Date(), "yyyyMMdd");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export type BadgeTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

export function statusTone(status: string): BadgeTone {
  if (["converted", "available", "completed", "active", "qualified"].includes(status)) {
    return "success";
  }

  if (["reserved", "underNegotiation", "waiting", "paymentPending", "inspectionScheduled"].includes(status)) {
    return "warning";
  }

  if (["lost", "cancelled", "overdue", "withdrawn", "unavailable"].includes(status)) {
    return "danger";
  }

  if (["new", "contacted", "inProgress", "draft"].includes(status)) {
    return "info";
  }

  return "muted";
}
