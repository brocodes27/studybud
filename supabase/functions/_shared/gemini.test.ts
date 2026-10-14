import assert from "node:assert/strict";
import { afterEach, test, mock } from "node:test";
import { callGeminiJSON } from "./gemini";

afterEach(() => mock.restoreAll());
const messages = [{ role: "user" as const, content: "Extract Python topics." }];
const complete = { topics: ["Decision-making structures and Loops"], summary: "Python syllabus." };

function provider(replies: { text?: string; finishReason?: string; status?: number; thought?: string }[]) {
  const requests: { config: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
  mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    const reply = replies[requests.length];
    assert.ok(reply, "Unexpected extra Gemini request");
    requests.push({ config: JSON.parse(String(init.body)).generationConfig, signal: init.signal });
    return new Response(JSON.stringify({ candidates: [{
      finishReason: reply.finishReason ?? "STOP",
      content: { parts: [
        ...(reply.thought ? [{ thought: true, text: reply.thought }] : []),
        { text: reply.text ?? "" },
      ] },
    }] }), { status: reply.status ?? 200 });
  });
  return requests;
}

test("retries a cut-off topic reply with more room and the same deadline", async () => {
  const requests = provider([
    { text: '{"topics":["Decision-making structures and Loops', finishReason: "MAX_TOKENS" },
    { text: JSON.stringify(complete) },
  ]);
  const signal = AbortSignal.timeout(10000);
  const schema = { type: "object", properties: { topics: { type: "array", items: { type: "string" } } } };
  assert.deepEqual(await callGeminiJSON(messages, {
    apiKey: "test-only", maxOutputTokens: 4096, thinkingLevel: "minimal",
    responseJsonSchema: schema, retryInvalidJSON: true, signal,
  }), complete);
  assert.deepEqual(requests.map((r) => r.config.maxOutputTokens), [4096, 8192]);
  assert.ok(requests.every((r) => r.signal === signal));
  assert.deepEqual(requests[0].config.thinkingConfig, { thinkingLevel: "minimal" });
  assert.deepEqual(requests[0].config.responseJsonSchema, schema);
  assert.equal(requests[0].config.responseMimeType, "application/json");
});

test("retries malformed JSON even if the provider reports a normal stop", async () => {
  provider([{ text: '{"topics":["Loops' }, { text: JSON.stringify(complete) }]);
  assert.deepEqual(await callGeminiJSON(messages, { apiKey: "test-only", retryInvalidJSON: true }), complete);
});

test("rejects token-limited replies even if the partial JSON is parseable", async () => {
  provider([{ text: '{"topics":[]}', finishReason: "MAX_TOKENS" }]);
  await assert.rejects(callGeminiJSON(messages, { apiKey: "test-only" }), /output limit/);
});

test("stops after one retry without exposing partial document text", async () => {
  const requests = provider([{ text: '{"private document' }, { text: '{"private document' }]);
  await assert.rejects(callGeminiJSON(messages, { apiKey: "test-only", retryInvalidJSON: true }), (error: Error) => {
    assert.match(error.message, /Gemini returned invalid JSON/);
    assert.doesNotMatch(error.message, /private document/);
    return true;
  });
  assert.equal(requests.length, 2);
});

test("ignores thought parts and retains fenced JSON compatibility without retrying valid output", async () => {
  const requests = provider([{ thought: "Provider thoughts", text: '```json\n' + JSON.stringify(complete) + '\n```' }]);
  assert.deepEqual(await callGeminiJSON(messages, { apiKey: "test-only", retryInvalidJSON: true }), complete);
  assert.equal(requests.length, 1);
});

test("does not retry provider authentication or rate-limit errors", async () => {
  const requests = provider([{ status: 429 }]);
  await assert.rejects(callGeminiJSON(messages, { apiKey: "test-only", retryInvalidJSON: true }), /Gemini API error 429/);
  assert.equal(requests.length, 1);
});

test("redacts credentials echoed in provider errors before they reach logs", async () => {
  mock.method(globalThis, "fetch", async () => new Response('Consumer api_key:test-only is suspended', { status: 403 }));
  await assert.rejects(callGeminiJSON(messages, { apiKey: "test-only" }), (error: Error) => {
    assert.match(error.message, /403.*\[redacted\]/);
    assert.doesNotMatch(error.message, /test-only/);
    return true;
  });
});

test("an expired deadline prevents the retry", async () => {
  const controller = new AbortController();
  let calls = 0;
  mock.method(globalThis, "fetch", async () => {
    calls++;
    controller.abort();
    return new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }));
  });
  await assert.rejects(callGeminiJSON(messages, { apiKey: "test-only", retryInvalidJSON: true, signal: controller.signal }), /abort/i);
  assert.equal(calls, 1);
});
