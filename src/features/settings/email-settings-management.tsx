"use client";

import { MailCheck, RefreshCw, Save, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { useAuth } from "@/features/auth/auth-provider";
import {
  getEmailSmtpSettings,
  saveEmailSmtpSettings,
  sendEmailSmtpTest,
  type EmailSecureMode,
} from "@/services/email-settings";

const defaultForm = {
  enabled: true,
  host: "",
  password: "",
  port: 587,
  replyTo: "",
  secureMode: "starttls" as EmailSecureMode,
  senderEmail: "",
  senderName: "",
  username: "",
};

export function EmailSettingsManagement() {
  const { activeOrganizationId, member, user } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [hasPassword, setHasPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const settings = await getEmailSmtpSettings(activeOrganizationId);
      setForm({
        enabled: settings.enabled,
        host: settings.host,
        password: "",
        port: settings.port,
        replyTo: settings.replyTo,
        secureMode: settings.secureMode,
        senderEmail: settings.senderEmail || member?.email || user?.email || "",
        senderName: settings.senderName || member?.displayName || user?.displayName || "",
        username: settings.username || member?.email || user?.email || "",
      });
      setHasPassword(settings.hasPassword);
      setTestRecipient(settings.senderEmail || member?.email || user?.email || "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load email settings.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, member, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSettings]);

  async function submitSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("save");
    setError(null);
    setSuccess(null);
    try {
      const settings = await saveEmailSmtpSettings({
        ...form,
        organizationId: activeOrganizationId,
        password: form.password || undefined,
      });
      setForm((current) => ({ ...current, password: "" }));
      setHasPassword(settings.hasPassword);
      setSuccess("Email settings saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save email settings.");
    } finally {
      setSaving(null);
    }
  }

  async function sendTest() {
    setSaving("test");
    setError(null);
    setSuccess(null);
    try {
      await sendEmailSmtpTest(activeOrganizationId, testRecipient || undefined);
      setSuccess(`Test email sent to ${testRecipient || form.senderEmail}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send test email.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <LoadingState label="Loading email settings" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:flex md:items-end md:justify-between md:bg-transparent md:p-0 md:shadow-none">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Email Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connect your official mailbox for client and lead messages.</p>
        </div>
        <Button className="mt-4 h-11 w-full md:mt-0 md:w-auto" onClick={loadSettings} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
          <MailCheck className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>SMTP Mailbox</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submitSettings}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Sender name">
                <Input required value={form.senderName} onChange={(event) => setForm((value) => ({ ...value, senderName: event.target.value }))} />
              </Field>
              <Field label="Sender email">
                <Input required type="email" value={form.senderEmail} onChange={(event) => setForm((value) => ({ ...value, senderEmail: event.target.value }))} />
              </Field>
              <Field label="Reply-to email">
                <Input type="email" value={form.replyTo} onChange={(event) => setForm((value) => ({ ...value, replyTo: event.target.value }))} />
              </Field>
              <Field label="SMTP username">
                <Input required autoComplete="username" value={form.username} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} />
              </Field>
              <Field label="SMTP host">
                <Input required placeholder="smtp.yourcompany.com" value={form.host} onChange={(event) => setForm((value) => ({ ...value, host: event.target.value }))} />
              </Field>
              <Field label="Port">
                <Input required min={1} max={65535} type="number" value={form.port} onChange={(event) => setForm((value) => ({ ...value, port: Number(event.target.value) }))} />
              </Field>
              <Field label="Security">
                <Select value={form.secureMode} onChange={(event) => setForm((value) => ({ ...value, secureMode: event.target.value as EmailSecureMode }))}>
                  <option value="starttls">STARTTLS</option>
                  <option value="ssl">SSL/TLS</option>
                  <option value="none">None</option>
                </Select>
              </Field>
              <Field label={hasPassword ? "SMTP password or app password" : "SMTP password or app password"}>
                <Input
                  autoComplete="new-password"
                  placeholder={hasPassword ? "Leave blank to keep saved password" : ""}
                  required={!hasPassword}
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                />
              </Field>
              <Field label="Status">
                <Select value={form.enabled ? "enabled" : "disabled"} onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.value === "enabled" }))}>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </Field>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <Button className="h-11" disabled={saving === "save"} type="submit">
                <Save className="h-4 w-4" />
                {saving === "save" ? "Saving" : "Save settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Connection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Send test to">
            <Input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button className="h-10 w-full md:w-auto" disabled={saving === "test"} onClick={sendTest} type="button" variant="outline">
              <Send className="h-4 w-4" />
              {saving === "test" ? "Sending" : "Send test"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
