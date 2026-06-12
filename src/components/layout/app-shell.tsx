"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronsLeft, LogOut, Menu, MoreHorizontal, Plus, Search, X } from "lucide-react";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  const flatNavigation = visibleNavigation.flatMap((section) => section.items);
  const primaryMobileHrefs = ["/dashboard", "/leads", "/properties", "/tasks"];
  const primaryMobileNavigation = primaryMobileHrefs
    .map((href) => flatNavigation.find((item) => item.href === href))
    .filter((item) => item !== undefined);
  const currentSection = flatNavigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const sidebar = (
    <aside className={cn("flex h-full min-h-0 flex-col border-r bg-white transition-all", collapsed ? "w-20" : "w-72")}>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b px-4">
        <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={42} height={42} className="h-11 w-11 rounded-md object-contain" priority />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Beacon Operations CRM</p>
            <p className="truncate text-xs text-muted-foreground">Corporate Realty Limited</p>
          </div>
        ) : null}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
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
      <div className="shrink-0 border-t p-3">
        <Button aria-label="Collapse sidebar" onClick={() => setCollapsed((value) => !value)} size={collapsed ? "icon" : "md"} variant="ghost" className="w-full">
          <ChevronsLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
          {!collapsed ? "Collapse" : null}
        </Button>
      </div>
    </aside>
  );

  const tabletRail = (
    <aside className="no-print hidden h-screen w-[5.25rem] shrink-0 border-r bg-white md:flex lg:hidden">
      <div className="flex min-h-0 w-full flex-col items-center gap-3 py-4">
        <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={42} height={42} className="h-11 w-11 rounded-md object-contain" priority />
        <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain px-2">
          {flatNavigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                aria-label={item.label}
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-md transition",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={item.href}
                key={item.href}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
        <Button aria-label="Sign out" onClick={signOutUser} size="icon" variant="ghost">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );

  const mobileAllSections = (
    <>
      {mobileOpen ? <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} /> : null}
      <section
        aria-label="All sections"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[86vh] rounded-t-[1.75rem] border bg-white shadow-2xl transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-base font-semibold">All sections</p>
            <p className="text-xs text-muted-foreground">Beacon Operations CRM</p>
          </div>
          <Button aria-label="Close sections" onClick={() => setMobileOpen(false)} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="grid max-h-[calc(86vh-5.5rem)] gap-5 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          {visibleNavigation.map((section) => (
            <div key={section.label}>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{section.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-md border px-3 py-3 text-sm font-semibold shadow-sm",
                        active ? "border-primary bg-primary text-primary-foreground" : "bg-white text-foreground",
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </section>
    </>
  );

  const mobileBottomNavigation = (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgb(15_23_42_/_0.08)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {primaryMobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              className={cn(
                "grid min-h-14 place-items-center rounded-md px-1 text-[11px] font-semibold transition",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          aria-label="Open all sections"
          className={cn(
            "grid min-h-14 place-items-center rounded-md px-1 text-[11px] font-semibold transition",
            mobileOpen ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <MoreHorizontal className="mb-1 h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-muted/40">
      <div className="no-print hidden h-screen shrink-0 lg:block">{sidebar}</div>
      {tabletRail}
      {mobileAllSections}
      {mobileBottomNavigation}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="no-print z-30 shrink-0 border-b bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:h-18 lg:px-6">
            <Button aria-label="Open all sections" className="md:hidden" onClick={() => setMobileOpen(true)} size="icon" variant="ghost">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
              <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={34} height={34} className="h-9 w-9 rounded-md object-contain" priority />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{currentSection?.label ?? "Beacon CRM"}</p>
                <p className="truncate text-xs text-muted-foreground">Head office</p>
              </div>
            </div>
            <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input aria-label="Global search" placeholder="Search leads, clients, properties, tasks" />
            </div>
            <Select aria-label="Branch selector" className="hidden w-40 sm:block" value={activeBranchId} onChange={(event) => setActiveBranchId(event.target.value)}>
              <option value="head-office">Head office</option>
            </Select>
            <ButtonLink className="hidden sm:inline-flex" href="/leads/new" variant="secondary">
              <Plus className="h-4 w-4" />
              Quick create
            </ButtonLink>
            <Button aria-label="Search" className="md:hidden" onClick={() => setMobileSearchOpen((value) => !value)} size="icon" variant="ghost">
              <Search className="h-5 w-5" />
            </Button>
            <ButtonLink aria-label="Notifications" href="/notifications" size="icon" variant="outline">
              <Bell className="h-4 w-4" />
            </ButtonLink>
            <Button aria-label="Sign out" className="hidden md:inline-flex" onClick={signOutUser} size="icon" variant="ghost">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          {mobileSearchOpen ? (
            <div className="border-t px-4 py-3 md:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input aria-label="Global search" className="h-11 rounded-md pl-9" placeholder="Search workspace" />
              </div>
            </div>
          ) : null}
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 md:px-5 md:pb-8 md:pt-6 lg:px-8">
          <div className="mb-5 hidden text-sm text-muted-foreground md:block">
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
