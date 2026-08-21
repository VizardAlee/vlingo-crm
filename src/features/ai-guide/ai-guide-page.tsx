"use client";

import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

interface GuideMessage {
  content: string;
  finishReason?: string;
  mode?: "ai" | "built-in";
  role: "assistant" | "user";
  truncated?: boolean;
}

interface GuideUsage {
  characterLimit: number;
  dailyLimit: number;
  remaining: number;
}

interface PersistedGuideChat {
  messages: GuideMessage[];
  savedAt: string;
  usage: GuideUsage;
}

const defaultGuideMessage: GuideMessage = {
  content: "Ask me how CRM works or how to use Vlingo Systems CRM. I can guide you through the inventory-first dashboard, sales records, Point of Sale, invoices and receipts, inventory, procurement, products and brands, reports, finance, roles, branches, and more.",
  mode: "built-in",
  role: "assistant",
};

const defaultUsage: GuideUsage = { characterLimit: 3500, dailyLimit: 30, remaining: 30 };
const guideStoragePrefix = "vlingo:ai-guide";

const suggestedQuestions = [
  "What is CRM and how should our team use it?",
  "How do I create a lead and link it to a property?",
  "How do I open a deal from a lead?",
  "How do I create and receive a purchase order?",
  "How do stock reservations and available quantities work?",
  "What can a brand partner see in Inventory?",
  "What sales records are shown on the dashboard?",
  "How do I complete a POS sale and print the official invoice or receipt?",
  "How do I record a property sale payment and print a receipt?",
  "How do I send bulk emails to leads?",
  "How do I review my performance and amount generated?",
  "How do I connect my tasks to Google Calendar?",
  "What can a sales executive see?",
  "How do I geotag a lead location?",
];

function currentQuotaDay() {
  return new Date().toISOString().slice(0, 10);
}

function guideStorageKey(organizationId: string, uid: string) {
  return `${guideStoragePrefix}:${organizationId}:${uid}:${currentQuotaDay()}`;
}

function isGuideMessage(value: unknown): value is GuideMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<GuideMessage>;
  return typeof item.content === "string" && (item.role === "assistant" || item.role === "user");
}

function isGuideUsage(value: unknown): value is GuideUsage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<GuideUsage>;
  return typeof item.characterLimit === "number" && typeof item.dailyLimit === "number" && typeof item.remaining === "number";
}

function readPersistedGuideChat(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedGuideChat>;
    if (!Array.isArray(parsed.messages) || !parsed.messages.every(isGuideMessage) || !isGuideUsage(parsed.usage)) {
      return null;
    }

    return {
      messages: parsed.messages,
      usage: parsed.usage,
    };
  } catch {
    return null;
  }
}

function pruneOldGuideChats() {
  const activeDaySuffix = `:${currentQuotaDay()}`;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${guideStoragePrefix}:`) && !key.endsWith(activeDaySuffix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be unavailable in private browsing or locked-down browsers.
  }
}

export function AiGuidePage() {
  const { activeOrganizationId, firebaseReady, loading, member, user } = useAuth();
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<GuideMessage[]>([defaultGuideMessage]);
  const [usage, setUsage] = useState<GuideUsage>(defaultUsage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  const canAsk = useMemo(() => Boolean(firebaseReady && user && member?.status === "active"), [firebaseReady, member?.status, user]);
  const storageKey = user?.uid ? guideStorageKey(activeOrganizationId, user.uid) : "";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextQuestion = params.get("question")?.trim();
      if (nextQuestion) {
        setQuestion(nextQuestion);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!storageKey) {
        setMessages([defaultGuideMessage]);
        setUsage(defaultUsage);
        setStorageReady(false);
        return;
      }

      const persisted = readPersistedGuideChat(storageKey);
      if (persisted) {
        setMessages(persisted.messages.length ? persisted.messages : [defaultGuideMessage]);
        setUsage(persisted.usage);
      } else {
        setMessages([defaultGuideMessage]);
        setUsage(defaultUsage);
      }
      pruneOldGuideChats();
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady || !storageKey) {
      return;
    }

    try {
      const payload: PersistedGuideChat = {
        messages,
        savedAt: new Date().toISOString(),
        usage,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Keep the chat usable even if browser storage is unavailable.
    }
  }, [messages, storageKey, storageReady, usage]);

  async function askGuide(nextQuestion?: string) {
    const text = (nextQuestion ?? question).trim();
    if (!text || submitting) {
      return;
    }

    if (!user) {
      setError("You must be signed in to use AI Guide.");
      return;
    }

    setError(null);
    setSubmitting(true);
    setQuestion("");
    const history = messages
      .filter((message) => !(message.role === "assistant" && message.mode === "built-in" && message.content.startsWith("Ask me how CRM works")))
      .slice(-10)
      .map((message) => ({ content: message.content, role: message.role }));
    setMessages((current) => [...current, { content: text, role: "user" }]);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai-guide", {
        body: JSON.stringify({ history, organizationId: activeOrganizationId, question: text }),
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json() as {
        answer?: string;
        characterLimit?: number;
        dailyLimit?: number;
        error?: string;
        finishReason?: string;
        mode?: "ai" | "built-in";
        remaining?: number;
        requiredAction?: string;
        truncated?: boolean;
        warning?: string;
      };

      if (typeof payload.dailyLimit === "number" && typeof payload.remaining === "number") {
        const nextDailyLimit = payload.dailyLimit;
        const nextRemaining = payload.remaining;
        setUsage((current) => ({
          characterLimit: typeof payload.characterLimit === "number" ? payload.characterLimit : current.characterLimit,
          dailyLimit: nextDailyLimit,
          remaining: nextRemaining,
        }));
      }

      if (!response.ok) {
        const action = payload.requiredAction ? ` Run: ${payload.requiredAction}` : "";
        throw new Error(`${payload.error || "Unable to ask AI Guide."}${action}`);
      }

      if (payload.warning) {
        toast({ title: "AI Guide fallback used", description: payload.warning, variant: "info" });
      }

      setMessages((current) => [...current, {
        content: payload.answer || "I could not find an answer. Try asking the question another way.",
        finishReason: payload.finishReason,
        mode: payload.mode ?? "built-in",
        role: "assistant",
        truncated: payload.truncated,
      }]);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to ask AI Guide.";
      setError(message);
      toast({ title: "AI Guide failed", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Workspace / AI Guide</p>
          <h1 className="text-2xl font-semibold tracking-tight">Ask AI Guide</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Ask how CRM works or how to perform any task in the app, then get a practical step-by-step guide.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={canAsk ? "success" : "warning"}>{canAsk ? "Ready" : loading ? "Loading" : "Sign-in required"}</Badge>
          <Badge tone={usage.remaining > 3 ? "info" : "warning"}>{usage.remaining}/{usage.dailyLimit} questions left today</Badge>
          <Badge tone="muted">{usage.characterLimit.toLocaleString()} chars per answer</Badge>
        </div>
      </div>

      {!firebaseReady ? <ErrorState message="Firebase is not configured, so AI Guide cannot verify signed-in users." /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-h-[620px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              CRM Help Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="grid min-h-[540px] grid-rows-[1fr_auto] gap-4">
            <div className="grid content-start gap-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
              {messages.map((message, index) => (
                <div className={cn("flex gap-3", message.role === "user" && "justify-end")} key={`${message.role}-${index}`}>
                  {message.role === "assistant" ? (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                  ) : null}
                  <div className={cn(
                    "max-w-[85%] rounded-md border px-4 py-3 text-sm leading-6 shadow-sm",
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground",
                  )}>
                    {message.role === "assistant" && message.mode ? <Badge className="mb-2" tone={message.mode === "ai" ? "success" : "info"}>{message.mode === "ai" ? "AI answer" : "Built-in guide"}</Badge> : null}
                    <MarkdownContent className="gap-1" content={message.content} />
                    {message.finishReason === "MAX_TOKENS" || message.truncated ? (
                      <p className="mt-3 rounded-md border border-info/20 bg-info/10 p-2 text-xs text-muted-foreground">
                        The answer reached its length limit. Ask “continue” or a focused follow-up and I’ll keep going from here.
                      </p>
                    ) : null}
                  </div>
                  {message.role === "user" ? (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      <UserRound className="h-5 w-5" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <form className="grid gap-3" onSubmit={(event) => {
              event.preventDefault();
              void askGuide();
            }}>
              <Textarea
                disabled={!canAsk || submitting}
                placeholder="Example: How do I create a solar installation deal and record payment?"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <div className="flex justify-end">
                <Button disabled={!canAsk || submitting || !question.trim()} type="submit">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Thinking" : "Ask"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Try Asking</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="mb-2 rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              To keep AI Guide fair and affordable, each user can ask {usage.dailyLimit} questions per day. Answers are capped at {usage.characterLimit.toLocaleString()} characters, so ask focused follow-ups when you need more detail.
            </div>
            {suggestedQuestions.map((item) => (
              <button
                className="rounded-md border bg-white p-3 text-left text-sm font-medium transition hover:border-primary/40 hover:bg-muted/40"
                disabled={!canAsk || submitting}
                key={item}
                onClick={() => void askGuide(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
