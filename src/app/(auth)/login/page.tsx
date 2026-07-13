"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  Landmark,
  LogIn,
  Mail,
  Package,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
} from "lucide-react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";

const featureRows = [
  { icon: Users, title: "Lead capture", text: "Real estate, building materials, solar, and service enquiries." },
  { icon: Handshake, title: "Deal pipeline", text: "Linked owners, products/services, activities, approvals, and finance." },
  { icon: Landmark, title: "Finance control", text: "Receipts, commissions, expenses, verification, and audit trails." },
];

const activityFeed = [
  "Solar consultation assigned",
  "Property inspection confirmed",
  "Material quote moved to deal",
  "Receipt awaiting verification",
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseReady, signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      toast({ title: "Signed in", description: "Welcome back.", variant: "success" });
      router.push("/dashboard");
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to sign in.";
      setError(message);
      toast({ title: "Unable to sign in", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f8f3] lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="auth-hero relative hidden overflow-hidden bg-secondary p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-10">
        <div className="auth-hero-grid absolute inset-0" aria-hidden="true" />
        <div className="auth-hero-glow auth-hero-glow-a" aria-hidden="true" />
        <div className="auth-hero-glow auth-hero-glow-b" aria-hidden="true" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/branding/vlingo-logo.jpeg" alt="Vlingo Systems Nig. Ltd. logo" width={220} height={56} className="h-auto w-56 rounded-md bg-white object-contain object-left shadow-2xl shadow-black/20" priority style={{ height: "auto" }} />
            <div>
              <p className="text-lg font-bold">Vlingo Systems CRM</p>
              <p className="text-sm text-white/70">Systems Nig. Ltd.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-[#c9a23d]" />
            Secure workspace
          </div>
        </div>

        <div className="relative z-10 my-10 grid gap-6 xl:grid-cols-[0.86fr_1.14fr] xl:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white/85 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#c9a23d]" />
              Built for active business teams
            </div>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">Run sales, operations, finance, and field work from one command center.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/72">
              Sign in to manage leads, clients, deals, products/services, projects, tasks, receipts, documents, and role-controlled branch activity.
            </p>
            <div className="mt-7 grid gap-3">
              {featureRows.map((item) => (
                <div className="auth-feature-row" key={item.title}>
                  <item.icon className="h-5 w-5 text-[#c9a23d]" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="block text-sm leading-6 text-white/62">{item.text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-command-preview">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">Operations pulse</p>
                <p className="text-xs text-white/50">Live CRM workflow snapshot</p>
              </div>
              <BadgeCheck className="h-5 w-5 text-[#c9a23d]" />
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              {[
                { icon: Building2, label: "Properties", value: "34" },
                { icon: SunMedium, label: "Solar projects", value: "18" },
                { icon: Package, label: "Products/Services", value: "76" },
                { icon: ClipboardCheck, label: "Tasks due", value: "14" },
              ].map((item) => (
                <div className="bg-[#10180e]/90 p-5" key={item.label}>
                  <item.icon className="mb-3 h-5 w-5 text-[#c9a23d]" />
                  <p className="text-xs text-white/48">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 p-5">
              {activityFeed.map((item, index) => (
                <div className="auth-activity-row" key={item} style={{ animationDelay: `${index * 180}ms` }}>
                  <CheckCircle2 className="h-4 w-4 text-[#c9a23d]" />
                  <span>{item}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-white/35" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 text-sm">
          {["Branch-aware roles", "Official email", "Audit-ready finance"].map((item) => (
            <div className="rounded-md border border-white/12 bg-white/8 p-3 text-white/72 backdrop-blur" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="relative grid min-h-screen place-items-center overflow-hidden p-5 md:p-8 lg:min-h-0">
        <div className="auth-mobile-bg absolute inset-0 lg:hidden" aria-hidden="true" />
        <Card className="relative z-10 w-full max-w-md overflow-hidden border-0 bg-white/92 shadow-2xl shadow-[#14550f]/10 backdrop-blur">
          <CardContent className="grid gap-6 p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <Image src="/branding/vlingo-logo.jpeg" alt="Vlingo Systems Nig. Ltd. logo" width={220} height={54} className="h-auto w-56 max-w-full rounded-md object-contain object-left" style={{ height: "auto" }} />
              <span className="hidden rounded-md bg-[#edf5ea] px-3 py-2 text-xs font-semibold text-primary sm:inline-flex">
                CRM
              </span>
            </div>
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-md bg-[#f7f8f3] px-3 py-2 text-xs font-semibold text-secondary">
                <Mail className="h-4 w-4 text-primary" />
                Official workspace access
              </p>
              <h1 className="text-3xl font-semibold">Welcome back</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to continue managing Vlingo Systems leads, deals, projects, finance, and team operations.</p>
            </div>
            {!firebaseReady ? <ErrorState message="Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables." /> : null}
            {error ? <ErrorState message={error} /> : null}
            <form className="grid gap-4" onSubmit={onSubmit}>
              <Field label="Email">
                <Input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Password">
                <Input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
              <Button className="h-11" disabled={submitting || !firebaseReady} type="submit">
                <LogIn className="h-4 w-4" />
                {submitting ? "Signing in" : "Sign in"}
              </Button>
              <div className="flex flex-col gap-2 pt-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                <Link className="font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
                <Link className="font-medium text-muted-foreground hover:text-primary" href="/">View landing page</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </AuthProvider>
  );
}
