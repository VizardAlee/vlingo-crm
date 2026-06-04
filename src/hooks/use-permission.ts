"use client";

import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import type { Permission } from "@/types/crm";

export function usePermission(permission: Permission) {
  const { member } = useAuth();
  return hasPermission(member, permission);
}

export function useAnyPermission(permissions: Permission[]) {
  const { member } = useAuth();
  return hasAnyPermission(member, permissions);
}
