"use client";

import {
  BarChart3,
  Bot,
  CalendarDays,
  Mail,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const releaseId = "2026-07-14-workflow-release";

const updates = [
  {
    description: "Quick capture now keeps lead creation focused on essential contact, category, source, immediate interest, follow-up, and notes. Full details and flexible spreadsheet import remain available.",
    icon: Users,
    title: "Faster lead capture",
  },
  {
    description: "Personal performance opens with live aggregates, lead interaction history, conversion, tasks, deals, and attributed revenue. Custom ranges can be summarized by AI and downloaded as an A4 PDF.",
    icon: BarChart3,
    title: "Performance reports",
  },
  {
    description: "Products/Services supports property, solar, building materials, installation, maintenance, consultancy, and other sellable work. Leads and dynamic deals carry this context into Finance.",
    icon: Package,
    title: "Broader sales workflows",
  },
  {
    description: "Users can connect an official SMTP mailbox, send individual or bulk messages, and open lead or client phone numbers in WhatsApp.",
    icon: Mail,
    title: "Customer communication",
  },
  {
    description: "Dated assigned tasks can sync to a connected Google Calendar. Persistent unread alerts and optional browser notifications keep follow-up visible.",
    icon: CalendarDays,
    title: "Calendar and notifications",
  },
  {
    description: "Vlingo CRM is installable on phones, tablets, and computers. Cached pages and supported queued changes improve continuity when the connection is unreliable.",
    icon: Smartphone,
    title: "Installable PWA and offline support",
  },
  {
    description: "Multiple roles, branch scoping, branch switching, hidden restricted navigation, renewable invite links, and creator attribution make team access clearer and safer.",
    icon: ShieldCheck,
    title: "Roles, branches, and invitations",
  },
  {
    description: "Gemini AI Guide now understands current CRM workflows, follows user permissions, supports follow-up questions, preserves the daily chat, and explains CRM concepts.",
    icon: Bot,
    title: "Updated AI assistance",
  },
  {
    description: "Organization administrators can update the company name, upload a logo, and apply branding colors across the CRM.",
    icon: Sparkles,
    title: "Organization branding",
  },
];

function storageKey(organizationId: string, userId: string) {
  return `vlingo:release-seen:${organizationId}:${userId}:${releaseId}`;
}

export function WhatsNew({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    const key = storageKey(organizationId, userId);
    const timeout = window.setTimeout(() => {
      let alreadySeen = false;
      try {
        alreadySeen = window.localStorage.getItem(key) === "seen";
      } catch {
        alreadySeen = false;
      }
      setSeen(alreadySeen);
      if (!alreadySeen) setOpen(true);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [organizationId, userId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  });

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(organizationId, userId), "seen");
    } catch {
      // The update remains available from the header when storage is unavailable.
    }
    setSeen(true);
    setOpen(false);
  }

  return (
    <>
      <Button aria-label="What's new" className="relative" onClick={() => setOpen(true)} size="icon" title="What's new" type="button" variant="ghost">
        <Sparkles className="h-4 w-4" />
        {!seen ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-white" /> : null}
      </Button>
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) dismiss(); }}>
          <section aria-labelledby="whats-new-title" aria-modal="true" className="flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-md border bg-white shadow-2xl sm:max-h-[80dvh]" role="dialog">
            <header className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold" id="whats-new-title">What&apos;s new in Vlingo CRM</h2>
                  <Badge tone="success">July 2026</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Recent improvements across sales, operations, reporting, and team workflows.</p>
              </div>
              <Button aria-label="Close updates" onClick={dismiss} size="icon" type="button" variant="ghost"><X className="h-5 w-5" /></Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
              {updates.map(({ description, icon: Icon, title }) => (
                <article className="flex gap-3 border-b py-4 last:border-b-0" key={title}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                </article>
              ))}
            </div>
            <footer className="border-t bg-muted/30 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
              <p className="mb-3 text-xs text-muted-foreground sm:mb-0">Available anytime from the sparkle icon in the header.</p>
              <Button className="w-full sm:w-auto" onClick={dismiss} type="button">Got it</Button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
