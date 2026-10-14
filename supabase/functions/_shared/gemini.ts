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
  responseJsonSchema?: Record<string, unknown>;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  /** Retry incomplete JSON once, within the original request's deadline. */
  retryInvalidJSON?: boolean;
  apiKey?: string;
  signal?: AbortSignal;
}

const DEFAULT_MODEL = "gemini-3-flash-preview";

class GeminiIncompleteJSONError extends Error {}

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

  // --- Inject real-world temporal awareness into every call ---
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const realWorldContext = `Today is ${dayNames[now.getUTCDay()]}, ${monthNames[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()} (UTC).`;

  // Prepend the real-world context as a system message so every edge function
  // AI interaction knows the current date without individual changes.
  const enrichedMessages: GeminiMessage[] = [
    { role: "system", content: `Real-world context: ${realWorldContext}` },
    ...messages,
  ];

  // Gemini uses `systemInstruction` separately and only role=user|model in contents.
  const systemMessages = enrichedMessages.filter((m) => m.role === "system");
  const nonSystem = enrichedMessages.filter((m) => m.role !== "system");

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
    if (opts.responseJsonSchema) {
      generationConfig.responseJsonSchema = opts.responseJsonSchema;
    }
  }
  if (opts.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevel };
  }

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    signal: opts.signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Google can echo the consumer API key in permission errors.
    throw new Error(`Gemini API error ${res.status}: ${errText.replaceAll(apiKey, "[redacted]")}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (opts.json && candidate?.finishReason === "MAX_TOKENS") {
    // Even syntactically valid JSON can be incomplete when the provider hits
    // its output limit. Never accept or save a partial topic list.
    throw new GeminiIncompleteJSONError("Gemini JSON response exceeded its output limit.");
  }
  const text = candidate?.content?.parts
    ?.filter((p: any) => !p?.thought)
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
  opts: { model?: string; apiKey?: string; taskType?: string; signal?: AbortSignal } = {},
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
    signal: opts.signal,
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
  const attempts = opts.retryInvalidJSON ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      opts.signal?.throwIfAborted();
      const text = await callGemini(messages, {
        ...opts,
        json: true,
        maxOutputTokens: attempt === 0
          ? opts.maxOutputTokens
          : Math.min((opts.maxOutputTokens ?? 4096) * 2, 65536),
      });
      const cleaned = text
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new GeminiIncompleteJSONError("Gemini returned invalid JSON.");
      }
    } catch (error) {
      if (!(error instanceof GeminiIncompleteJSONError) || attempt + 1 === attempts) {
        throw error;
      }
    }
  }
  throw new Error("Gemini returned invalid JSON.");
}
