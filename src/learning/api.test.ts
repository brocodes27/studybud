import assert from "node:assert/strict";
import { before, afterEach, it, mock } from "node:test";
import { build } from "esbuild";
import type * as Api from "./api";

let api: typeof Api;
before(async () => {
  // Bundle with a fake project URL so the real client can be tested without
  // connecting to Supabase or depending on Vite's environment injection.
  const result = await build({
    entryPoints: [new URL("./api.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    external: ["pdfjs-dist*"],
    define: {
      "import.meta.env": JSON.stringify({
        VITE_SUPABASE_URL: "https://upload-tests.supabase.co",
        VITE_SUPABASE_ANON_KEY: "test-only",
      }),
    },
  });
  api = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
});
afterEach(() => mock.restoreAll());

function mockUpload(analysisFails = false, insertFails = false) {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(String(input));
      const body = JSON.parse(String(options?.body || "{}"));
      requests.push({ path: url.pathname, body });
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (url.pathname === "/rest/v1/materials") {
        if (insertFails) return json({ message: "Insert failed" }, 400);
        return json({
          ...body,
          id: "new-material",
          created_at: "2026-10-07T00:00:00Z",
        });
      }
      if (url.pathname === "/functions/v1/material-study") {
        if (analysisFails)
          return json({ error: "Daily AI limit reached." }, 400);
        return json({
          topics: ["Matrices", "Differential equations"],
          summary: "Course outline.",
        });
      }
      throw new Error(`Unexpected network request: ${url.pathname}`);
    },
  );
  return requests;
}

it("fetches topics during upload and returns them with the saved semester material", async () => {
  const requests = mockUpload();
  const material = await api.saveMaterial(
    "test-user",
    "Mathematics",
    "MA101",
    "",
    [{ page: 4, text: "Module 1: Matrices" }],
    "Semester 1",
  );
  assert.deepEqual(
    requests.map((r) => r.path),
    ["/rest/v1/materials", "/functions/v1/material-study"],
  );
  assert.deepEqual(requests[1].body, {
    action: "analyze",
    material_id: "new-material",
  });
  assert.deepEqual(material.metadata.topics, [
    "Matrices",
    "Differential equations",
  ]);
  assert.equal(material.metadata.summary, "Course outline.");
  assert.equal(material.metadata.semester, "Semester 1");
  assert.equal(material.metadata.confirmed, false);
  assert.equal(material.metadata.pages?.[0].page, 4);
  assert.equal(material.topicAnalysisError, undefined);
});

it("keeps the upload and a retry warning when topic fetching fails", async () => {
  const requests = mockUpload(true);
  const material = await api.saveMaterial("test-user", "Maths", "MA101", "", [
    { page: 1, text: "Calculus" },
  ]);
  assert.equal(material.id, "new-material");
  assert.equal(material.topicAnalysisError, "Daily AI limit reached.");
  assert.deepEqual(material.metadata.topics, []);
  assert.equal(
    requests.filter((r) => r.path === "/rest/v1/materials").length,
    1,
  );
});

it("does not analyze a material whose upload failed", async () => {
  const requests = mockUpload(false, true);
  await assert.rejects(
    api.saveMaterial("test-user", "Maths", "MA101", "", [
      { page: 1, text: "Calculus" },
    ]),
    /Could not save/,
  );
  assert.equal(requests.length, 1);
});
