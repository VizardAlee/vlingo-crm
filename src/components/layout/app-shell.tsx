"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronsLeft, LogOut, Menu, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/state";
import { navigation } from "@/components/layout/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { hasAnyPermission } from "@/lib/permissions";
import { cn, titleCase } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeBranchId, firebaseReady, loading, member, setActiveBranchId, signOutUser, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && firebaseReady && !user) {
      router.replace("/login");
    }
  }, [firebaseReady, loading, router, user]);

  const visibleNavigation = useMemo(
    () =>
      navigation
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => hasAnyPermission(member, item.permissions)),
        }))
        .filter((section) => section.items.length > 0),
    [member],
  );

  if (loading) {
    return <LoadingState />;
  }

  const sidebar = (
    <aside className={cn("flex h-full flex-col border-r bg-white transition-all", collapsed ? "w-20" : "w-72")}>
      <div className="flex h-20 items-center gap-3 border-b px-4">
        <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={42} height={42} className="h-11 w-11 rounded-md object-contain" priority />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Beacon Operations CRM</p>
            <p className="truncate text-xs text-muted-foreground">Corporate Realty Limited</p>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleNavigation.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed ? <p className="px-3 pb-2 text-xs font-semibold uppercase text-muted-foreground">{section.label}</p> : null}
            <div className="grid gap-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    aria-label={item.label}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? item.label : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <Button aria-label="Collapse sidebar" onClick={() => setCollapsed((value) => !value)} size={collapsed ? "icon" : "md"} variant="ghost" className="w-full">
          <ChevronsLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
          {!collapsed ? "Collapse" : null}
        </Button>
      </div>
    </aside>
  );

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="no-print hidden lg:block">{sidebar}</div>
      {mobileOpen ? <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <div className={cn("fixed inset-y-0 left-0 z-50 lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <Button aria-label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input aria-label="Global search" placeholder="Search leads, clients, properties, tasks" />
            </div>
            <Select aria-label="Branch selector" className="w-40" value={activeBranchId} onChange={(event) => setActiveBranchId(event.target.value)}>
              <option value="head-office">Head office</option>
            </Select>
            <ButtonLink href="/leads/new" variant="secondary">
              <Plus className="h-4 w-4" />
              Quick create
            </ButtonLink>
            <Button aria-label="Notifications" size="icon" variant="outline">
              <Bell className="h-4 w-4" />
            </Button>
            <Button aria-label="Sign out" onClick={signOutUser} size="icon" variant="ghost">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mb-5 text-sm text-muted-foreground">
            {crumbs.length ? crumbs.map(titleCase).join(" / ") : "Dashboard"}
          </div>
          {firebaseReady ? children : (
            <div className="rounded-md border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
              Firebase environment variables are missing. Add `.env.local` values to connect authentication and Firestore.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
