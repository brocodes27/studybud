import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { callMetaJSON, callMeta, requestMeta, streamMeta } from "./meta";

afterEach(() => mock.restoreAll());
const messages = [{ role: "user" as const, content: "Extract study topics." }];
const opts = () => ({
  apiKey: "test-only", maxOutputTokens: 4096, reasoningEffort: "minimal" as const,
  responseJsonSchema: { type: "object" }, retryInvalidJSON: true,
  signal: AbortSignal.timeout(10000),
});
const complete = { topics: ["Loops"], summary: "Python syllabus." };
function reply(content: string, finish_reason = "stop") {
  return new Response(JSON.stringify({ choices: [{ finish_reason, message: { content } }] }));
}

test("uses the contributor model and structured output, retrying truncation within the original deadline", async () => {
  const options = opts();
  let calls = 0;
  mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-only");
    assert.equal(init.signal, options.signal);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "muse-spark-1.3-contributor");
    assert.equal(body.reasoning_effort, "minimal");
    assert.equal(body.max_completion_tokens, calls === 0 ? 4096 : 8192);
    assert.deepEqual(body.response_format, { type: "json_schema", json_schema: { name: "study_task", schema: options.responseJsonSchema } });
    assert.deepEqual(body.messages.slice(1), messages);
    calls++;
    return calls === 1 ? reply('{"topics":[]}', "length") : reply(JSON.stringify(complete));
  });
  assert.deepEqual(await callMetaJSON(messages, options), complete);
  assert.equal(calls, 2);
});

test("accepts fenced JSON and retries malformed JSON", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async () => ++calls === 1
    ? reply('{"topics":[') : reply('```json\n' + JSON.stringify(complete) + '\n```'));
  assert.deepEqual(await callMetaJSON(messages, opts()), complete);
  assert.equal(calls, 2);
});

test("bounds invalid JSON retries without leaking document content", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async () => { calls++; return reply('{"private document'); });
  await assert.rejects(callMetaJSON(messages, opts()), { message: "Meta returned invalid JSON." });
  assert.equal(calls, 2);
});

test("does not retry HTTP errors or expose provider bodies", async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    mock.method(globalThis, "fetch", async () => {
      calls++;
      return new Response("test-only private document", { status });
    });
    await assert.rejects(callMetaJSON(messages, opts()), { message: `Meta API error ${status}` });
    assert.equal(calls, 1);
  }
});

test("rejects empty output, refusals, and non-object JSON", async () => {
  for (const response of [
    { choices: [] },
    { choices: [{ message: { content: "{}", refusal: "private content" } }] },
    { choices: [{ finish_reason: "content_filter", message: { content: "{}" } }] },
    { choices: [{ message: { content: "null" } }] },
    { choices: [{ message: { content: "[]" } }] },
  ]) {
    mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(response)));
    await assert.rejects(callMetaJSON(messages, { ...opts(), retryInvalidJSON: false }), /Meta/);
  }
});

test("does not retry after the request deadline expires", async () => {
  const controller = new AbortController();
  let calls = 0;
  mock.method(globalThis, "fetch", async () => { calls++; controller.abort(); return reply("{}", "length"); });
  await assert.rejects(callMetaJSON(messages, { ...opts(), signal: controller.signal }), /abort/i);
  assert.equal(calls, 1);
});

test("preserves image inputs and JSON arrays used by grading and question generation", async () => {
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body.messages[1].content, [
      { type: "text", text: "Read this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,YQ==" } },
      { type: "image_url", image_url: { url: "https://example.com/page.jpg" } },
    ]);
    assert.equal(body.response_format.type, "json_schema");
    return reply('[{"question":"What is shown?"}]');
  });
  assert.deepEqual(await callMetaJSON([{ role: "user", content: [
    { type: "text", text: "Read this" },
    { type: "image", mimeType: "image/png", base64: "YQ==" },
    { type: "image", dataUrl: "https://example.com/page.jpg" },
  ] }], { apiKey: "test-only" }), [{ question: "What is shown?" }]);
});

test("passes tool definitions through without losing tool-call arguments", async () => {
  const tools = [{ type: "function" as const, function: { name: "build_plan", parameters: { type: "object" } } }];
  const toolCalls = [{ function: { name: "build_plan", arguments: '{"days":3}' } }];
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.deepEqual(body.tools, tools);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.response_format, undefined);
    return new Response(JSON.stringify({ choices: [{ message: { tool_calls: toolCalls } }] }));
  });
  const response = await requestMeta(messages, { apiKey: "test-only", tools });
  assert.deepEqual((await response.json()).choices[0].message.tool_calls, toolCalls);
});

test("streams fragmented SSE and the final unterminated delta, ignoring reasoning", async () => {
  mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    assert.equal(JSON.parse(String(init.body)).stream, true);
    const events = [
      'data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"there"}}]}',
    ].join('');
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < events.length; i += 7) controller.enqueue(new TextEncoder().encode(events.slice(i, i + 7)));
      controller.close();
    } }));
  });
  const chunks = [];
  for await (const chunk of streamMeta(messages, { apiKey: "test-only" })) chunks.push(chunk);
  assert.deepEqual(chunks, ["Hi ", "there"]);
});

test("rejects streaming provider errors and incomplete output", async () => {
  for (const event of [{ error: { message: "private data" } }, { choices: [{ finish_reason: "length" }] }]) {
    mock.method(globalThis, "fetch", async () => new Response(`data: ${JSON.stringify(event)}\n\n`));
    await assert.rejects(async () => {
      for await (const _chunk of streamMeta(messages, { apiKey: "test-only" })) { /* drain */ }
    }, { message: "Meta could not complete the response." });
  }
});

test("plain text requests do not force JSON and use the server-only credential", async () => {
  const state = globalThis as typeof globalThis & { Deno?: { env: { get: (name: string) => string | undefined } } };
  const previous = state.Deno;
  state.Deno = { env: { get: (name) => name === "MODEL_API_KEY" ? "test-only" : undefined } };
  try {
    mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
      assert.equal(JSON.parse(String(init.body)).response_format, undefined);
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-only");
      return reply("Hello");
    });
    assert.equal(await callMeta(messages), "Hello");
    state.Deno.env.get = () => undefined;
    await assert.rejects(callMeta(messages), /MODEL_API_KEY not configured/);
  } finally {
    if (previous) state.Deno = previous;
    else delete state.Deno;
  }
});
