import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { encodeVoiceWav } from "../../../src/learning/agent/voiceAudio";
import {
  requireVoiceConfig,
  transcribeVoice,
  TRANSCRIPTION_MODEL,
  synthesizeVoice,
  SPEECH_MODEL,
} from "./workspace-voice";
const config = {
  metaKey: "test-meta",
  groqKey: "test-groq",
};
afterEach(() => mock.restoreAll());

test("voice configuration requires server-side Meta and Groq keys", () => {
  assert.throws(() => requireVoiceConfig({}), /recognition is not configured/);
  assert.throws(
    () => requireVoiceConfig({ metaKey: "test" }),
    /Hosted speech is not configured/,
  );
  requireVoiceConfig(config);
});
test("transcribes WAV through the dedicated Meta STT API without exposing keys", async () => {
  const wav = encodeVoiceWav([new Float32Array(16000)]);
  const signal = new AbortController().signal;
  mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "https://api.meta.ai/v1/asr/transcribe");
    assert.equal(
      new Headers(init.headers).get("Authorization"),
      "Bearer test-meta",
    );
    assert.equal(new Headers(init.headers).get("Accept"), "text/plain");
    assert.equal(init.signal, signal);
    const form = init.body as FormData;
    assert.deepEqual(JSON.parse(await (form.get("request") as Blob).text()), {
      model: TRANSCRIPTION_MODEL,
      audioEncoding: "WAV",
      mode: "PUSH_TO_TALK",
    });
    assert.deepEqual(
      new Uint8Array(await (form.get("audio") as Blob).arrayBuffer()),
      wav,
    );
    return new Response("  Explain ATP synthesis.\n");
  });
  assert.equal(
    await transcribeVoice(wav, config, signal),
    "Explain ATP synthesis.",
  );
});
test("rejects invalid or oversized recordings before calling a provider", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => {
    throw new Error("must not call");
  });
  await assert.rejects(
    transcribeVoice(new Uint8Array(10), config),
    /25 seconds/,
  );
  await assert.rejects(
    transcribeVoice(new Uint8Array(1_000_001), config),
    /25 seconds/,
  );
  await assert.rejects(
    transcribeVoice(encodeVoiceWav([new Float32Array(10)], 48000), config),
    /16 kHz/,
  );
  const corrupt = encodeVoiceWav([new Float32Array(10)]);
  corrupt[40] = 0;
  await assert.rejects(transcribeVoice(corrupt, config), /PCM WAV/);
  assert.equal(fetch.mock.callCount(), 0);
});
test("provider errors cannot expose response bodies", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("private upstream key", { status: 401 }),
  );
  await assert.rejects(
    transcribeVoice(encodeVoiceWav([new Float32Array(10)]), config),
    { message: "Speech recognition is unavailable. Please try again." },
  );
});

test("hosted TTS uses Groq Orpheus with server-side credentials", async () => {
  const signal = new AbortController().signal;
  mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "https://api.groq.com/openai/v1/audio/speech");
    assert.equal(
      new Headers(init.headers).get("Authorization"),
      "Bearer test-groq",
    );
    assert.equal(init.signal, signal);
    assert.deepEqual(JSON.parse(String(init.body)), {
      model: SPEECH_MODEL,
      input: "Choice saved.",
      voice: "hannah",
      response_format: "wav",
    });
    return new Response("wav", { headers: { "Content-Type": "audio/wav" } });
  });
  assert.equal(
    await (await synthesizeVoice("Choice saved.", config, signal)).text(),
    "wav",
  );
});
test("speech validates character limits and reports quota exhaustion without exposing provider errors", async () => {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response("private upstream text", { status: 429 }),
  );
  await assert.rejects(
    synthesizeVoice("x".repeat(201), config),
    /200 characters/,
  );
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(synthesizeVoice("Hello", config), /free speech quota/);
});
test("TTS rejects non-audio responses and honors cancellation", async () => {
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    init.signal?.throwIfAborted();
    return new Response("{}", {
      headers: { "Content-Type": "application/json" },
    });
  });
  await assert.rejects(
    synthesizeVoice("Hello", config),
    /Hosted speech is unavailable/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    synthesizeVoice("Hello", config, controller.signal),
    /abort/i,
  );
});
