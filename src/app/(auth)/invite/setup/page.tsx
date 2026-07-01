"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { AuthProvider } from "@/features/auth/auth-provider";
import { auth } from "@/lib/firebase/client";

function InviteSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const oobCode = searchParams.get("oobCode") ?? "";
  const fallbackEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(fallbackEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifyInvite() {
      if (!auth) {
        setError("Firebase Authentication is not configured.");
        setLoading(false);
        return;
      }

      if (!oobCode) {
        setError("This setup link is missing a verification code.");
        setLoading(false);
        return;
      }

      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        if (mounted) {
          setEmail(verifiedEmail);
        }
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "This setup link is invalid or expired.";
        if (mounted) {
          setError(message);
          toast({ title: "Invalid setup link", description: message, variant: "error" });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void verifyInvite();

    return () => {
      mounted = false;
    };
  }, [oobCode, toast]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      const message = "Firebase Authentication is not configured.";
      setError(message);
      toast({ title: "Unable to create account", description: message, variant: "error" });
      return;
    }

    if (password.length < 8) {
      const message = "Use at least 8 characters for the password.";
      setError(message);
      toast({ title: "Password too short", description: message, variant: "error" });
      return;
    }

    if (password !== confirmPassword) {
      const message = "The two password fields do not match.";
      setError(message);
      toast({ title: "Passwords do not match", description: message, variant: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast({ title: "Account ready", description: "Your password has been set. Sign in to continue.", variant: "success" });
      router.push(`/login?email=${encodeURIComponent(email)}`);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to create account from this setup link.";
      setError(message);
      toast({ title: "Unable to create account", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/50 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="grid gap-5 p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Set your password to activate your Vlingo Systems CRM access.</p>
            </div>
          </div>

          {loading ? <LoadingState label="Checking setup link" /> : null}
          {error ? <ErrorState message={error} /> : null}

          {!loading && !error ? (
            <form className="grid gap-4" onSubmit={onSubmit}>
              <Field label="Email">
                <Input readOnly value={email} />
              </Field>
              <Field label="Password">
                <Input autoComplete="new-password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
              <Field label="Confirm password">
                <Input autoComplete="new-password" required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </Field>
              <Button disabled={submitting} type="submit">
                <CheckCircle2 className="h-4 w-4" />
                {submitting ? "Creating account" : "Create account"}
              </Button>
            </form>
          ) : null}

          <Link className="text-sm font-medium text-primary" href="/login">Back to sign in</Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default function InviteSetupPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingState label="Loading setup page" />}>
        <InviteSetupContent />
      </Suspense>
    </AuthProvider>
  );
}
