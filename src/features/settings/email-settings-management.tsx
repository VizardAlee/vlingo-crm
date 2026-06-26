"use client";

import { MailCheck, RefreshCw, Save, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GuidedTour, type GuidedTourStep } from "@/components/tour/guided-tour";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState, PermissionDenied } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { emailSettingsAccessPermissions } from "@/components/layout/navigation";
import { hasAnyPermission } from "@/lib/permissions";
import {
  getEmailSmtpSettings,
  saveEmailSmtpSettings,
  sendEmailSmtpTest,
  type EmailSecureMode,
} from "@/services/email-settings";

function emailSettingsTourTarget(fieldName: string) {
  return `email-settings-${fieldName}`;
}

const emailSettingsTourSteps: GuidedTourStep[] = [
  {
    body: "This is the name recipients will see beside the email address. Use the staff member's official name or a clear company sender name.",
    target: emailSettingsTourTarget("senderName"),
    title: "Sender name",
  },
  {
    body: "Use the official email address clients and leads should recognize. Many providers require this to match the SMTP account.",
    target: emailSettingsTourTarget("senderEmail"),
    title: "Sender email",
  },
  {
    body: "Use this only when replies should go somewhere different from the sender mailbox, such as a shared sales inbox.",
    target: emailSettingsTourTarget("replyTo"),
    title: "Reply-to email",
  },
  {
    body: "This is usually the full email address for the mailbox. Some providers use a separate SMTP username from the visible sender email.",
    target: emailSettingsTourTarget("username"),
    title: "SMTP username",
  },
  {
    body: "Enter the SMTP server from the email provider, for example smtp.gmail.com, smtp.office365.com, or your company mail server.",
    target: emailSettingsTourTarget("host"),
    title: "SMTP host",
  },
  {
    body: "Port 587 is common for STARTTLS. Port 465 is common for SSL/TLS. Use the value supplied by the provider or IT admin.",
    target: emailSettingsTourTarget("port"),
    title: "SMTP port",
  },
  {
    body: "Choose the encryption mode required by the provider. STARTTLS is the common default, SSL/TLS is often used with port 465.",
    target: emailSettingsTourTarget("secureMode"),
    title: "Security mode",
  },
  {
    body: "Use the mailbox password or app password. For Google Workspace or Gmail, turn on 2-Step Verification, create an app password at myaccount.google.com/apppasswords, and paste that 16-character password here instead of the normal login password.",
    target: emailSettingsTourTarget("password"),
    title: "SMTP password",
  },
  {
    body: "Keep this enabled when the mailbox is ready for CRM emails. Disable it to save the settings without allowing outbound messages.",
    target: emailSettingsTourTarget("status"),
    title: "Mailbox status",
  },
  {
    body: "Save the settings before testing. The password is encrypted and the field clears after saving, so leave it blank later unless you are replacing it.",
    target: emailSettingsTourTarget("save"),
    title: "Save settings",
  },
  {
    body: "Send a test message to confirm the SMTP details work before using this mailbox for lead or client communication.",
    target: emailSettingsTourTarget("testRecipient"),
    title: "Test delivery",
  },
];

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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase();
}

export function EmailSettingsManagement() {
  const { activeOrganizationId, member, user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(defaultForm);
  const [hasPassword, setHasPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canUseEmailSettings = hasAnyPermission(member, emailSettingsAccessPermissions);

  const loadSettings = useCallback(async () => {
    if (!canUseEmailSettings) {
      setLoading(false);
      return;
    }

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
      const message = errorMessage(nextError, "Unable to load email settings.");
      setError(message);
      toast({ description: message, title: "Unable to load email settings", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, canUseEmailSettings, member, toast, user]);

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
      const host = normalizeHost(form.host);
      const settings = await saveEmailSmtpSettings({
        ...form,
        host,
        organizationId: activeOrganizationId,
        password: form.password || undefined,
      });
      setForm((current) => ({ ...current, host, password: "" }));
      setHasPassword(settings.hasPassword);
      setSuccess("Email settings saved.");
      toast({ title: "Email settings saved", variant: "success" });
    } catch (nextError) {
      const message = errorMessage(nextError, "Unable to save email settings.");
      setError(message);
      toast({ description: message, title: "Unable to save email settings", variant: "error" });
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
      const message = `Test email sent to ${testRecipient || form.senderEmail}.`;
      setSuccess(message);
      toast({ description: message, title: "Test email sent", variant: "success" });
    } catch (nextError) {
      const message = errorMessage(nextError, "Unable to send test email.");
      setError(message);
      toast({ description: message, title: "Unable to send test email", variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  if (!canUseEmailSettings) {
    return <PermissionDenied />;
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
        <div className="mt-4 flex flex-col gap-2 md:mt-0 md:flex-row">
          <GuidedTour className="h-11 w-full md:w-auto" storageKey="beacon-tour:email-settings" steps={emailSettingsTourSteps} />
          <Button className="h-11 w-full md:w-auto" onClick={loadSettings} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
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
              <div data-tour={emailSettingsTourTarget("senderName")}>
                <Field label="Sender name">
                  <Input required value={form.senderName} onChange={(event) => setForm((value) => ({ ...value, senderName: event.target.value }))} />
                  <span className="text-xs font-normal text-muted-foreground">The display name recipients see beside the email address.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("senderEmail")}>
                <Field label="Sender email">
                  <Input required type="email" value={form.senderEmail} onChange={(event) => setForm((value) => ({ ...value, senderEmail: event.target.value }))} />
                  <span className="text-xs font-normal text-muted-foreground">The official mailbox address used for outbound client and lead messages.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("replyTo")}>
                <Field label="Reply-to email">
                  <Input type="email" value={form.replyTo} onChange={(event) => setForm((value) => ({ ...value, replyTo: event.target.value }))} />
                  <span className="text-xs font-normal text-muted-foreground">Optional shared inbox where replies should go if different from the sender email.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("username")}>
                <Field label="SMTP username">
                  <Input required autoComplete="username" value={form.username} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} />
                  <span className="text-xs font-normal text-muted-foreground">Usually the full email address, unless your provider gives a separate SMTP username.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("host")}>
                <Field label="SMTP host">
                  <Input required placeholder="smtp.yourcompany.com" value={form.host} onBlur={() => setForm((value) => ({ ...value, host: normalizeHost(value.host) }))} onChange={(event) => setForm((value) => ({ ...value, host: event.target.value }))} />
                  <span className="text-xs font-normal text-muted-foreground">
                    The outgoing mail server from your provider, such as smtp.gmail.com or smtp.office365.com.
                    {normalizeHost(form.host) === "stmp.gmail.com" ? <span className="font-semibold text-destructive"> Use smtp.gmail.com, not stmp.gmail.com.</span> : null}
                  </span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("port")}>
                <Field label="Port">
                  <Input required min={1} max={65535} type="number" value={form.port} onChange={(event) => setForm((value) => ({ ...value, port: Number(event.target.value) }))} />
                  <span className="text-xs font-normal text-muted-foreground">587 is common for STARTTLS. 465 is common for SSL/TLS.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("secureMode")}>
                <Field label="Security">
                  <Select value={form.secureMode} onChange={(event) => setForm((value) => ({ ...value, secureMode: event.target.value as EmailSecureMode }))}>
                    <option value="starttls">STARTTLS</option>
                    <option value="ssl">SSL/TLS</option>
                    <option value="none">None</option>
                  </Select>
                  <span className="text-xs font-normal text-muted-foreground">Encryption mode required by your email provider or IT admin.</span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("password")}>
                <Field label={hasPassword ? "SMTP password or app password" : "SMTP password or app password"}>
                  <Input
                    autoComplete="new-password"
                    placeholder={hasPassword ? "Leave blank to keep saved password" : ""}
                    required={!hasPassword}
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    Use an app password when the provider requires it. For Google Workspace or Gmail, enable 2-Step Verification, create an app password at{" "}
                    <a className="font-semibold text-primary underline-offset-2 hover:underline" href="https://myaccount.google.com/apppasswords" rel="noreferrer" target="_blank">
                      myaccount.google.com/apppasswords
                    </a>
                    , and use that 16-character password here. Leave blank after saving unless replacing the password.
                  </span>
                </Field>
              </div>
              <div data-tour={emailSettingsTourTarget("status")}>
                <Field label="Status">
                  <Select value={form.enabled ? "enabled" : "disabled"} onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.value === "enabled" }))}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </Select>
                  <span className="text-xs font-normal text-muted-foreground">Disable the mailbox to keep settings saved without allowing outbound CRM emails.</span>
                </Field>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <Button className="h-11" data-tour={emailSettingsTourTarget("save")} disabled={saving === "save"} type="submit">
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
          <div data-tour={emailSettingsTourTarget("testRecipient")}>
            <Field label="Send test to">
              <Input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} />
              <span className="text-xs font-normal text-muted-foreground">Send a test message here to confirm SMTP delivery before using the mailbox.</span>
            </Field>
          </div>
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
