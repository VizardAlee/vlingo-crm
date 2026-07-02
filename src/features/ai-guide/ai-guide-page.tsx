"use client";

import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
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

const suggestedQuestions = [
  "What is CRM and how should our team use it?",
  "How do I create a lead and link it to a property?",
  "How do I open a deal from a lead?",
  "How do I record a property sale payment and print a receipt?",
  "How do I send bulk emails to leads?",
  "What can a sales executive see?",
  "How do I geotag a lead location?",
];

function renderGuideContent(content: string) {
  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <br key={`break-${index}`} />;
    }

    if (trimmed.startsWith("### ")) {
      return <p className="mt-1 font-semibold text-foreground" key={`${trimmed}-${index}`}>{trimmed.replace(/^###\s+/, "")}</p>;
    }

    return <p key={`${trimmed}-${index}`}>{trimmed}</p>;
  });
}

export function AiGuidePage() {
  const { firebaseReady, loading, member, user } = useAuth();
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<GuideMessage[]>([
    {
      content: "Ask me how CRM works or how to use Vlingo Systems CRM. I can explain CRM concepts and walk you through leads, deals, finance, emails, roles, branches, notifications, geotagging, and more.",
      mode: "built-in",
      role: "assistant",
    },
  ]);
  const [usage, setUsage] = useState<GuideUsage>({ characterLimit: 3500, dailyLimit: 30, remaining: 30 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAsk = useMemo(() => Boolean(firebaseReady && user && member?.status === "active"), [firebaseReady, member?.status, user]);

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
        body: JSON.stringify({ history, question: text }),
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
        throw new Error(payload.error || "Unable to ask AI Guide.");
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
                    <div className="grid gap-1">{renderGuideContent(message.content)}</div>
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
