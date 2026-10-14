// Meta Model API. Keep MODEL_API_KEY server-side.
// https://dev.meta.ai/docs/protocols/chat-completions
export const META_MODEL = "muse-spark-1.3-contributor";
export type MetaPart = { type: "text"; text: string } | {
  type: "image"; dataUrl?: string; mimeType?: string; base64?: string;
};
export interface MetaMessage {
  role: "system" | "user" | "assistant";
  content: string | MetaPart[];
}
export interface MetaCallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  responseJsonSchema?: Record<string, unknown>;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  retryInvalidJSON?: boolean;
  signal?: AbortSignal;
  apiKey?: string;
  stream?: boolean;
  tools?: { type: "function"; function: { name: string; description?: string; parameters: unknown } }[];
}
class MetaIncompleteJSONError extends Error {}

/** Shared transport for text, vision, streaming, and tool calls. */
export async function requestMeta(messages: MetaMessage[], opts: MetaCallOptions = {}): Promise<Response> {
  const apiKey = opts.apiKey || Deno.env.get("MODEL_API_KEY");
  if (!apiKey) throw new Error("MODEL_API_KEY not configured");
  const signal = opts.signal ?? AbortSignal.timeout(55000);
  signal.throwIfAborted();
  const response = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: META_MODEL,
      messages: [
        { role: "system", content: `Today is ${new Date().toISOString().slice(0, 10)} (UTC).` },
        ...messages.map((m) => ({ ...m, content: typeof m.content === "string" ? m.content : m.content.map((p) => {
          if (p.type === "text") return p;
          const url = p.dataUrl || `data:${p.mimeType || "image/png"};base64,${p.base64 || ""}`;
          if (!/^(https?:\/\/|data:image\/)/i.test(url)) throw new Error("Meta vision requires an image URL or image data URL.");
          return { type: "image_url", image_url: { url } };
        }) })),
      ],
      reasoning_effort: opts.reasoningEffort ?? "low",
      max_completion_tokens: opts.maxOutputTokens ?? 8192,
      ...(opts.json || opts.responseJsonSchema ? {
        response_format: { type: "json_schema", json_schema: { name: "study_task", schema: opts.responseJsonSchema ?? {} } },
      } : {}),
      ...(opts.stream ? { stream: true } : {}),
      ...(opts.tools ? { tools: opts.tools, parallel_tool_calls: false } : {}),
      // Muse Spark is tuned for temperature 1; retain that default for all callers.
    }),
  });
  // Provider bodies can echo credentials or source material; keep them out of logs.
  if (!response.ok) throw new Error(`Meta API error ${response.status}`);
  return response;
}

export async function callMeta(messages: MetaMessage[], opts: MetaCallOptions = {}): Promise<string> {
  const response = await requestMeta(messages, opts);
  let data;
  try { data = await response.json(); } catch {
    opts.signal?.throwIfAborted();
    throw new MetaIncompleteJSONError("Meta returned invalid JSON.");
  }
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === "length") throw new MetaIncompleteJSONError("Meta response exceeded its output limit.");
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") throw new Error("Meta could not generate this content.");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Meta returned no text.");
  return content.trim();
}

export async function callMetaJSON<T = any>(messages: MetaMessage[], opts: MetaCallOptions = {}): Promise<T> {
  const signal = opts.signal ?? AbortSignal.timeout(55000);
  const attempts = opts.retryInvalidJSON ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      signal.throwIfAborted();
      const content = await callMeta(messages, {
        ...opts, signal, json: true, maxOutputTokens: (opts.maxOutputTokens ?? 8192) * (attempt + 1),
      });
      try {
        const result = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, ""));
        if (result === null || (opts.responseJsonSchema?.type === "object" && (typeof result !== "object" || Array.isArray(result)))) {
          throw new Error("Unexpected JSON value");
        }
        return result as T;
      } catch { throw new MetaIncompleteJSONError("Meta returned invalid JSON."); }
    } catch (error) {
      if (!(error instanceof MetaIncompleteJSONError) || attempt + 1 === attempts) throw error;
    }
  }
  throw new Error("Meta returned invalid JSON.");
}

/** Yield actual SSE text deltas, including a final event without a trailing newline. */
export async function* streamMeta(messages: MetaMessage[], opts: MetaCallOptions = {}): AsyncGenerator<string> {
  const response = await requestMeta(messages, { ...opts, stream: true });
  if (!response.body) throw new Error("Meta returned no stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", received = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      if (done && buffer) lines.push(buffer);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let chunk;
        try { chunk = JSON.parse(raw); } catch { throw new Error("Meta returned an invalid stream."); }
        const choice = chunk.choices?.[0];
        if (chunk.error || choice?.finish_reason === "length" || choice?.finish_reason === "content_filter" || choice?.delta?.refusal) {
          throw new Error("Meta could not complete the response.");
        }
        const text = choice?.delta?.content;
        if (typeof text === "string" && text) { received = true; yield text; }
      }
      if (done) break;
    }
    if (!received) throw new Error("Meta returned no text.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
