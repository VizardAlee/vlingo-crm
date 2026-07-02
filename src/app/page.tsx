import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Handshake,
  Landmark,
  LineChart,
  LockKeyhole,
  Mail,
  Package,
  PanelsTopLeft,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const workflows = [
  { icon: Users, label: "Capture", text: "Leads, sources, interests, follow-ups, and assignments." },
  { icon: Building2, label: "Match", text: "Properties, units, offerings, inventory, and service categories." },
  { icon: Handshake, label: "Close", text: "Deals, negotiations, inspections, approvals, and pipeline stages." },
  { icon: Landmark, label: "Account", text: "Payments, receipts, expenses, commissions, and finance checks." },
];

const modules = [
  { icon: Building2, title: "Real estate operations", text: "Properties, units, rentals, inspections, documents, and deal finance stay connected." },
  { icon: Factory, title: "Building materials funnel", text: "Track prospects, product interest, quotations, order readiness, and sales follow-up." },
  { icon: SunMedium, title: "Solar business workflows", text: "Manage consultation, installation, projects, equipment sales, and after-sales activity." },
  { icon: ShieldCheck, title: "Roles and branches", text: "Give every team member the right view, right branch scope, and right action level." },
];

const metrics = [
  ["Pipeline", "₦248.6M", "+18%"],
  ["Open deals", "42", "12 hot"],
  ["Receipts", "96", "verified"],
  ["Tasks due", "14", "today"],
];

const lanes = ["Lead", "Property", "Deal", "Finance"];

const commandCenterStats = [
  { icon: Users, label: "Leads", value: "128" },
  { icon: Handshake, label: "Deals", value: "42" },
  { icon: ClipboardCheck, label: "Tasks", value: "31" },
  { icon: Package, label: "Inventory", value: "76" },
  { icon: BarChart3, label: "Finance", value: "₦84.2M" },
  { icon: Mail, label: "Email actions", value: "219" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-foreground">
      <section className="relative isolate min-h-[92svh] overflow-hidden bg-secondary text-white">
        <div className="landing-mesh absolute inset-0" aria-hidden="true" />
        <div className="landing-ops-scene absolute inset-x-0 bottom-0 top-24 opacity-75 md:top-16" aria-hidden="true">
          <div className="landing-scanline" />
          <div className="landing-panel landing-panel-a">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-semibold text-white/70">Revenue pipeline</span>
              <LineChart className="h-4 w-4 text-[#c9a23d]" />
            </div>
            <div className="mt-4 grid gap-3">
              {lanes.map((lane, index) => (
                <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3" key={lane}>
                  <span className="text-xs text-white/60">{lane}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10">
                    <span className="landing-progress block h-full rounded-full bg-[#c9a23d]" style={{ animationDelay: `${index * 280}ms` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-panel landing-panel-b">
            <div className="grid gap-3">
              {metrics.map(([label, value, note], index) => (
                <div className="landing-metric-row" key={label} style={{ animationDelay: `${index * 220}ms` }}>
                  <span>
                    <span className="block text-xs text-white/55">{label}</span>
                    <span className="block text-lg font-semibold">{value}</span>
                  </span>
                  <span className="rounded-md bg-[#14550f] px-2 py-1 text-xs font-semibold text-white">{note}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="landing-panel landing-panel-c">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70">Team activity</span>
              <Activity className="h-4 w-4 text-[#c9a23d]" />
            </div>
            {["New solar consultation", "Property viewing booked", "Material quote approved", "Receipt verified"].map((item, index) => (
              <div className="landing-activity" key={item} style={{ animationDelay: `${index * 300}ms` }}>
                <CheckCircle2 className="h-4 w-4 text-[#c9a23d]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <Image src="/branding/vlingo-logo.jpeg" alt="Vlingo Systems Nig. Ltd. logo" width={220} height={56} className="h-auto w-48 rounded-md bg-white object-contain object-left md:w-56" priority style={{ height: "auto" }} />
            <span className="hidden min-w-0 md:block">
              <span className="block text-sm font-semibold">Vlingo Systems Nig. Ltd.</span>
              <span className="block text-xs text-white/60">CRM and operations platform</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/75 transition hover:text-white md:inline-flex" href="#workflows">Workflows</Link>
            <Link className="hidden rounded-md px-3 py-2 text-sm font-medium text-white/75 transition hover:text-white md:inline-flex" href="#modules">Use cases</Link>
            <ButtonLink className="h-10 bg-white text-secondary hover:bg-[#f4f4ed]" href="/login" variant="outline">
              Sign in
            </ButtonLink>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(92svh-88px)] w-full max-w-7xl flex-col justify-center px-5 pb-20 pt-10 md:px-8">
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white/85 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#c9a23d]" />
              Built for real business teams that sell, deliver, collect, and report.
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] md:text-6xl lg:text-7xl">
              Vlingo Systems CRM for sales, operations, finance, and field execution.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/74 md:text-lg">
              Run real estate, building materials, solar projects, service pipelines, tasks, receipts, documents, approvals, and branch-controlled team activity from one connected workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink className="h-12 px-5" href="/login">
                Enter workspace
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <Link className="inline-flex h-12 items-center justify-center rounded-md border border-white/18 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15" href="#workflows">
                Explore workflow
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="workflows" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Connected journey</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">One record chain from first enquiry to final receipt.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Every lead can point to the right product, property, unit, project, or service. Deals inherit context, finance records reference the commercial source, and activities keep the team honest.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {workflows.map((item, index) => (
            <div className="landing-step rounded-md border bg-white p-4 shadow-sm" key={item.label} style={{ animationDelay: `${index * 140}ms` }}>
              <item.icon className="mb-4 h-6 w-6 text-primary" />
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase text-primary">Industry-ready scope</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Designed for property workflows, flexible enough for broader commercial operations.</h2>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-[#f7f8f3] px-3 py-2 text-sm font-medium text-secondary">
              <LockKeyhole className="h-4 w-4 text-primary" />
              Role-aware, branch-aware, audit-aware.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((item) => (
              <div className="rounded-md border bg-[#fbfcf8] p-5 shadow-sm" key={item.title}>
                <item.icon className="mb-5 h-7 w-7 text-primary" />
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="overflow-hidden rounded-md border bg-secondary text-white shadow-sm">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white/70">Live command center</span>
              <PanelsTopLeft className="h-5 w-5 text-[#c9a23d]" />
            </div>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-3">
            {commandCenterStats.map((item) => (
              <div className="bg-secondary p-5" key={item.label}>
                <item.icon className="mb-4 h-5 w-5 text-[#c9a23d]" />
                <p className="text-sm text-white/55">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase text-primary">Operational clarity</p>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Less scattered follow-up. Fewer broken handoffs. Cleaner approvals.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">The app keeps commercial teams, field teams, managers, finance, legal, and auditors working from the same truth, with the right sections hidden or visible based on role.</p>
          <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
            {["Lead and client communication through official SMTP mailboxes.", "Role and branch restrictions enforced in UI and Firebase rules.", "Receipts, commissions, expenses, and audit trails tied to real records."].map((item) => (
              <div className="flex items-start gap-3" key={item}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary px-5 py-12 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Image src="/branding/vlingo-logo.jpeg" alt="Vlingo Systems Nig. Ltd. logo" width={220} height={56} className="h-auto w-56 rounded-md bg-white object-contain object-left" style={{ height: "auto" }} />
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">A controlled operations CRM for Vlingo Systems Nig. Ltd. and the teams moving opportunities from conversation to delivery.</p>
          </div>
          <ButtonLink className="h-12 px-5" href="/login">
            Sign in to CRM
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
