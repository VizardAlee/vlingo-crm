import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { appGuideContext, fallbackGuideAnswer } from "@/features/ai-guide/guide-knowledge";

export const runtime = "nodejs";

const dailyUsage = new Map<string, { count: number; day: string }>();
const defaultDailyLimit = 30;
const defaultResponseCharacterLimit = 3500;

interface GuideHistoryItem {
  content: string;
  role: "assistant" | "user";
}

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function usageForUser(uid: string, dailyLimit: number) {
  const day = todayKey();
  const key = `${uid}:${day}`;
  const current = dailyUsage.get(key);
  const count = current?.day === day ? current.count : 0;
  return {
    count,
    day,
    key,
    remaining: Math.max(dailyLimit - count, 0),
  };
}

function incrementUsage(uid: string, dailyLimit: number) {
  const usage = usageForUser(uid, dailyLimit);
  const count = usage.count + 1;
  dailyUsage.set(usage.key, { count, day: usage.day });
  return {
    count,
    dailyLimit,
    remaining: Math.max(dailyLimit - count, 0),
  };
}

function capAnswer(value: string, characterLimit: number) {
  if (value.length <= characterLimit) {
    return { answer: value, truncated: false };
  }

  const suffix = `\n\n[Response shortened to stay within the ${characterLimit.toLocaleString()} character limit. Ask a focused follow-up if you need more detail.]`;
  return {
    answer: `${value.slice(0, Math.max(characterLimit - suffix.length, 500)).trimEnd()}${suffix}`,
    truncated: true,
  };
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    return "";
  }

  return candidates
    .flatMap((item) => {
      const content = item && typeof item === "object" ? (item as { content?: unknown }).content : null;
      const parts = content && typeof content === "object" ? (content as { parts?: unknown }).parts : null;
      return Array.isArray(parts) ? parts : [];
    })
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiFinishReason(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    return "";
  }

  const first = candidates[0];
  if (!first || typeof first !== "object") {
    return "";
  }

  const finishReason = (first as { finishReason?: unknown }).finishReason;
  return typeof finishReason === "string" ? finishReason : "";
}

function normalizeHistory(value: unknown): GuideHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "assistant" && role !== "user") || typeof content !== "string") {
        return null;
      }

      return { content: content.slice(0, 2500), role };
    })
    .filter((item): item is GuideHistoryItem => item !== null)
    .slice(-10);
}

function firestoreStringValue(fields: Record<string, { stringValue?: string }> | undefined, key: string) {
  return fields?.[key]?.stringValue ?? "";
}

async function readMemberWithUserToken(projectId: string, organizationId: string, uid: string, token: string) {
  const documentPath = `organizations/${organizationId}/members/${uid}`;
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const baseUrl = emulatorHost
    ? `http://${emulatorHost}/v1`
    : "https://firestore.googleapis.com/v1";
  const response = await fetch(`${baseUrl}/projects/${projectId}/databases/(default)/documents/${documentPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { fields?: Record<string, { stringValue?: string }> };
  return {
    organizationId: firestoreStringValue(payload.fields, "organizationId"),
    status: firestoreStringValue(payload.fields, "status"),
  };
}

async function verifyActiveMember(request: Request, organizationId: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!token) {
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    decoded.aud;
  const member = await readMemberWithUserToken(projectId, organizationId, decoded.uid, token);
  if (!member || member.status !== "active" || member.organizationId !== organizationId) {
    return null;
  }

  return { uid: decoded.uid, member };
}

export async function POST(request: Request) {
  const organizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "beacon-corporate-realty";
  const dailyLimit = numericEnv("AI_GUIDE_DAILY_LIMIT", defaultDailyLimit);
  const characterLimit = numericEnv("AI_GUIDE_RESPONSE_CHARACTER_LIMIT", defaultResponseCharacterLimit);
  let body: { history?: unknown; question?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = normalizeHistory(body.history);
  if (question.length < 3) {
    return NextResponse.json({ error: "Ask a question with at least 3 characters." }, { status: 400 });
  }

  try {
    const verified = await verifyActiveMember(request, organizationId);
    if (!verified) {
      return NextResponse.json({ error: "You must be signed in as an active CRM user to use AI Guide." }, { status: 401 });
    }

    const usage = usageForUser(verified.uid, dailyLimit);
    if (usage.remaining <= 0) {
      return NextResponse.json({
        characterLimit,
        dailyLimit,
        error: `Daily AI Guide limit reached. You can ask ${dailyLimit} questions per day.`,
        remaining: 0,
      }, { status: 429 });
    }
  } catch (error) {
    console.error("[AI Guide auth failed]", error);
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const verified = await verifyActiveMember(request, organizationId);
    const usage = verified ? incrementUsage(verified.uid, dailyLimit) : { dailyLimit, remaining: 0 };
    const capped = capAnswer(fallbackGuideAnswer(question), characterLimit);
    return NextResponse.json({
      answer: capped.answer,
      characterLimit,
      dailyLimit: usage.dailyLimit,
      mode: "built-in",
      remaining: usage.remaining,
      truncated: capped.truncated,
    });
  }

  try {
    const verified = await verifyActiveMember(request, organizationId);
    if (!verified) {
      return NextResponse.json({ error: "You must be signed in as an active CRM user to use AI Guide." }, { status: 401 });
    }
    const usage = incrementUsage(verified.uid, dailyLimit);
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const modelPath = model.startsWith("models/") ? model : `models/${model}`;
    const contents = [
      ...history.map((item) => ({
        parts: [{ text: item.content }],
        role: item.role === "assistant" ? "model" : "user",
      })),
      {
        parts: [{ text: question }],
        role: "user",
      },
    ];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`, {
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 2400,
          temperature: 0.3,
        },
        systemInstruction: {
          parts: [{ text: `${appGuideContext}\n\nHard response limit: answer in ${characterLimit} characters or fewer. Prioritize the most useful steps first. If more detail is needed, tell the user what follow-up to ask.` }],
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      method: "POST",
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("[AI Guide Gemini failed]", payload);
      const capped = capAnswer(fallbackGuideAnswer(question), characterLimit);
      return NextResponse.json({
        answer: capped.answer,
        characterLimit,
        dailyLimit: usage.dailyLimit,
        mode: "built-in",
        remaining: usage.remaining,
        truncated: capped.truncated,
        warning: "Gemini was unavailable, so the built-in CRM guide answered instead.",
      });
    }

    const capped = capAnswer(extractGeminiText(payload) || fallbackGuideAnswer(question), characterLimit);
    return NextResponse.json({
      answer: capped.answer,
      characterLimit,
      dailyLimit: usage.dailyLimit,
      finishReason: extractGeminiFinishReason(payload),
      mode: "ai",
      remaining: usage.remaining,
      truncated: capped.truncated,
    });
  } catch (error) {
    console.error("[AI Guide failed]", error);
    const verified = await verifyActiveMember(request, organizationId).catch(() => null);
    const usage = verified ? usageForUser(verified.uid, dailyLimit) : { remaining: 0 };
    const capped = capAnswer(fallbackGuideAnswer(question), characterLimit);
    return NextResponse.json({
      answer: capped.answer,
      characterLimit,
      dailyLimit,
      mode: "built-in",
      remaining: usage.remaining,
      truncated: capped.truncated,
      warning: "Gemini was unavailable, so the built-in CRM guide answered instead.",
    });
  }
}
