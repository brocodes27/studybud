import assert from 'node:assert/strict';
import { afterEach, before, test, mock } from 'node:test';
import { build } from 'esbuild';
import type * as StageData from './stageData';
let stageData: typeof StageData;
before(async () => {
  const result = await build({ entryPoints: [new URL('./stageData.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://stage-tests.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-only' }) } });
  stageData = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
});
afterEach(() => mock.restoreAll());
const completion = { userId: 'student', enrollmentId: 'course', topicId: 'topic', action: 'prime' as const, evidence: { primingQuestions: 3 }, wasPrescribed: true };
function database(fail: 'read' | 'event' | 'stage' | 'none') {
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (input: unknown, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = options?.method || 'GET';
    requests.push(`${method} ${path}`);
    const rejected = fail === 'read' && method === 'GET' || fail === 'event' && path.endsWith('/curve_stage_events') || fail === 'stage' && method === 'PATCH';
    return new Response(JSON.stringify(rejected ? { message: 'Rejected' } : method === 'GET' ? { topic_id: 'topic', stage: 'new' } : method === 'PATCH' ? { topic_id: 'topic' } : null), { status: rejected ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
  });
  return requests;
}
test('a failed stage read cannot reset progress or write a new completion', async () => {
  const requests = database('read');
  await assert.rejects(stageData.recordStageCompletion(completion), /saved stage could not load/);
  assert.equal(requests.length, 1);
});
test('a rejected evidence write cannot advance the stage', async () => {
  const requests = database('event');
  await assert.rejects(stageData.recordStageCompletion(completion), /session could not save/);
  assert.ok(!requests.some(request => request.startsWith('PATCH')));
});
test('a rejected stage write cannot return a successful advancement receipt', async () => {
  database('stage');
  await assert.rejects(stageData.recordStageCompletion(completion), /stage could not update/);
});
test('an advancement receipt follows persisted evidence and a confirmed stage update', async () => {
  const requests = database('none');
  const result = await stageData.recordStageCompletion(completion);
  assert.equal(result.advanced, true);
  assert.equal(result.state.stage, 'primed');
  assert.ok(requests.indexOf('POST /rest/v1/curve_stage_events') < requests.indexOf('PATCH /rest/v1/curve_topic_stage'));
});
