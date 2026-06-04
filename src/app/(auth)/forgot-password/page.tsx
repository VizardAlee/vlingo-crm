"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";

function ForgotPasswordContent() {
  const { firebaseReady, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await resetPassword(email);
      setMessage("Password reset email sent.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send reset email.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/50 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="grid gap-5 p-6">
          <div>
            <h1 className="text-2xl font-semibold">Forgot password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email to receive a Firebase reset link.</p>
          </div>
          {!firebaseReady ? <ErrorState message="Firebase is not configured." /> : null}
          {error ? <ErrorState message={error} /> : null}
          {message ? <div className="rounded-md border border-success/20 bg-success/10 p-3 text-sm text-success">{message}</div> : null}
          <form className="grid gap-4" onSubmit={onSubmit}>
            <Field label="Email">
              <Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Button disabled={!firebaseReady} type="submit">Send reset link</Button>
            <Link className="text-sm font-medium text-primary" href="/login">Back to sign in</Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthProvider>
      <ForgotPasswordContent />
    </AuthProvider>
  );
}
