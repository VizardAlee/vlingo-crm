"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";

function LoginContent() {
  const router = useRouter();
  const { firebaseReady, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-muted/50 lg:grid-cols-[1fr_520px]">
      <section className="hidden bg-secondary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={56} height={56} className="h-14 w-14 rounded-md object-contain bg-white" priority />
          <div>
            <p className="text-lg font-bold">Beacon Operations CRM</p>
            <p className="text-sm text-white/70">Corporate Realty Limited</p>
          </div>
        </div>
        <div className="max-w-xl">
          <Building2 className="mb-6 h-10 w-10 text-primary" />
          <h1 className="text-4xl font-semibold leading-tight">A secure source of truth for real estate operations.</h1>
          <p className="mt-4 text-base leading-7 text-white/70">Manage leads, clients, properties, units, tasks, activities, roles, and audit trails with Firebase-backed organization isolation.</p>
        </div>
      </section>
      <section className="grid place-items-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="grid gap-6 p-6">
            <div className="lg:hidden">
              <Image src="/branding/beacon-logo.jpeg" alt="Beacon Corporate Realty Limited logo" width={54} height={54} className="h-14 w-14 rounded-md object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">Use your Beacon workspace credentials.</p>
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
              <Button disabled={submitting || !firebaseReady} type="submit">
                <LogIn className="h-4 w-4" />
                {submitting ? "Signing in" : "Sign in"}
              </Button>
              <Link className="text-sm font-medium text-primary" href="/forgot-password">Forgot password?</Link>
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
      <LoginContent />
    </AuthProvider>
  );
}
