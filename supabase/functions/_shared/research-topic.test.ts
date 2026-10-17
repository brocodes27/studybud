import assert from 'node:assert/strict';
import { test } from 'node:test';
import { researchTopic } from './research-topic.ts';

test('research generation requests an interactive brief and validates optional UI', async t => {
  (globalThis as any).Deno = { env: { get: () => 'fixture-key' } };
  const ui = { html: '<button>Show the next step</button>', css: '', js: '' };
  let visual: unknown = ui;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (url.includes('tavily')) return Response.json({ results: [{ title: 'Algebra notes', url: 'https://example.com/algebra', content: 'A linear equation has a constant rate of change.' }] });
    const request = JSON.parse(String(init.body));
    assert.match(request.messages.map((m: { content: string }) => m.content).join('\n'), /always include a working interactive study activity/i);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ text: 'A linear equation has a constant rate of change [1].', ui: visual }) } }] });
  });
  const result = await researchTopic('Math', 'Algebra');
  assert.deepEqual(result.ui, ui);
  assert.equal(result.sources[0].url, 'https://example.com/algebra');
  for (const invalid of [null, { ...ui, html: '' }, { ...ui, js: 'x'.repeat(24001) }]) {
    visual = invalid;
    const fallback = await researchTopic('Math', 'Algebra');
    assert.equal(fallback.ui, undefined);
    assert.equal(fallback.text, result.text);
    assert.deepEqual(fallback.sources, result.sources);
  }
});
