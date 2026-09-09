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

export function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const converted = value.toDate();
      date = converted instanceof Date ? converted : null;
    } else {
      const timestamp = value as {
        _nanoseconds?: unknown;
        _seconds?: unknown;
        nanoseconds?: unknown;
        seconds?: unknown;
      };
      const seconds = Number(timestamp.seconds ?? timestamp._seconds);
      const nanoseconds = Number(
        timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0,
      );
      if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
        date = new Date(seconds * 1_000 + nanoseconds / 1_000_000);
      }
    }
  }

  return date && !Number.isNaN(date.getTime())
    ? format(date, "MMM d, yyyy")
    : "Not set";
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
