import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";
import { authorize, publicError } from "../_shared/workspace.ts";
import {
  MAX_VOICE_BYTES,
  requireVoiceConfig,
  transcribeVoice,
  synthesizeVoice,
} from "../_shared/workspace-voice.ts";

serve(async (req) => {
  const cors = getCors(req);
  const headers = {
    ...cors.headers,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  try {
    await authorize(req);
    const config = {
      metaKey: Deno.env.get("MODEL_API_KEY"),
      groqKey: Deno.env.get("GROQ_API_KEY"),
    };
    const operation = new URL(req.url).searchParams.get("operation");
    if (operation === "status") {
      requireVoiceConfig(config);
      return new Response(JSON.stringify({ stt: "meta", tts: "groq" }), {
        headers,
      });
    }
    // Read incrementally so chunked uploads cannot bypass the size cap.
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Missing voice request.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > MAX_VOICE_BYTES) {
          await reader.cancel();
          throw new Error("Voice request is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (operation === "transcribe") {
      const text = await transcribeVoice(bytes, config);
      return new Response(JSON.stringify({ text }), { headers });
    }
    if (operation === "speak") {
      const { text } = JSON.parse(new TextDecoder().decode(bytes));
      const audio = await synthesizeVoice(text, config);
      return new Response(audio.body, {
        headers: {
          ...headers,
          "Content-Type": audio.headers.get("Content-Type")!,
        },
      });
    }
    throw new Error("Unsupported voice operation.");
  } catch (error) {
    return new Response(JSON.stringify({ error: publicError(error) }), {
      status: (error as { status?: number })?.status || 400,
      headers,
    });
  }
});
