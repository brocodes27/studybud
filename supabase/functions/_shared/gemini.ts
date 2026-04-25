// Shared Gemini helper for Supabase Edge Functions.
// Provides a drop-in replacement for the common OpenAI chat-completion patterns
// used across this project, using Google's Gemini API.
//
// Env: GEMINI_API_KEY
// Default model: gemini-3-flash-preview (override per call via `model`)

export interface GeminiTextPart {
  type: "text";
  text: string;
}

export interface GeminiImagePart {
  type: "image";
  // Either a data URL ("data:image/png;base64,...") or raw base64 with mime_type.
  dataUrl?: string;
  mimeType?: string;
  base64?: string;
}

export type GeminiPart = GeminiTextPart | GeminiImagePart;

export interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string | GeminiPart[];
}

export interface GeminiCallOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Request strict JSON output (sets responseMimeType). */
  json?: boolean;
  apiKey?: string;
}

const DEFAULT_MODEL = "gemini-3-flash-preview";

function partsFromContent(content: string | GeminiPart[]): any[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  return content.map((p) => {
    if (p.type === "text") return { text: p.text };

    // Image part — accept dataUrl or raw base64 + mimeType.
    let mimeType = p.mimeType || "image/png";
    let data = p.base64 || "";
    if (p.dataUrl) {
      const match = p.dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        data = match[2];
      } else {
        // Not a data URL — treat as raw URL (Gemini doesn't fetch remote URLs
        // for inline_data, so caller must pre-fetch). Leave as-is.
        data = p.dataUrl;
      }
    }
    return { inline_data: { mime_type: mimeType, data } };
  });
}

/**
 * Call Gemini's generateContent endpoint with an OpenAI-style message array.
 * Returns the raw text output.
 */
export async function callGemini(
  messages: GeminiMessage[],
  opts: GeminiCallOptions = {},
): Promise<string> {
  const apiKey = opts.apiKey || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = opts.model || DEFAULT_MODEL;

  // Gemini uses `systemInstruction` separately and only role=user|model in contents.
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const systemInstruction = systemMessages.length
    ? { parts: systemMessages.flatMap((m) => partsFromContent(m.content)) }
    : undefined;

  const contents = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: partsFromContent(m.content),
  }));

  const generationConfig: Record<string, unknown> = {};
  if (typeof opts.temperature === "number") {
    generationConfig.temperature = opts.temperature;
  }
  if (typeof opts.maxOutputTokens === "number") {
    generationConfig.maxOutputTokens = opts.maxOutputTokens;
  }
  if (opts.json) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      `Gemini returned no text. Raw response: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }

  return text;
}

/**
 * Generate an embedding vector for the given text using Gemini's
 * text-embedding-004 model (OpenAI text-embedding-3-small replacement).
 */
export async function callGeminiEmbedding(
  text: string,
  opts: { model?: string; apiKey?: string; taskType?: string } = {},
): Promise<number[]> {
  const apiKey = opts.apiKey || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const model = opts.model || "text-embedding-004";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
  const body: Record<string, unknown> = {
    content: { parts: [{ text }] },
  };
  if (opts.taskType) body.taskType = opts.taskType;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini embedding error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const values: number[] = data?.embedding?.values || [];
  if (!values.length) {
    throw new Error(`Gemini embedding returned empty vector: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return values;
}

/**
 * Convenience wrapper that returns a parsed JSON object.
 * Sets responseMimeType=application/json and strips ```json fences if present.
 */
export async function callGeminiJSON<T = any>(
  messages: GeminiMessage[],
  opts: GeminiCallOptions = {},
): Promise<T> {
  const text = await callGemini(messages, { ...opts, json: true });
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${err instanceof Error ? err.message : err}. Raw: ${cleaned.slice(0, 500)}`,
    );
  }
}
