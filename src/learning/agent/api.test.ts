import assert from 'node:assert/strict';
import { before, afterEach, mock, test } from 'node:test';
import { build } from 'esbuild';

let api: typeof import('./api');
const snapshot = {thread: {id: 'saved-thread', state: {}, updated_at: ''}, messages: [{id: 'saved-message', role: 'user', content: 'Hello', created_at: ''}]};
before(async () => {
  const bundle = await build({
    entryPoints: [new URL('./api.ts', import.meta.url).pathname], bundle: true,
    write: false, platform: 'node', format: 'esm',
    define: {'import.meta.env.VITE_SUPABASE_URL': '"https://example.supabase.co"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon"'},
    plugins: [{name: 'fake-session', setup(build) {
      build.onResolve({filter: /lib\/supabase$/}, args => ({path: args.path, namespace: 'fake'}));
      build.onLoad({filter: /.*/, namespace: 'fake'}, () => ({contents: 'export const supabase = {auth: {getSession: async () => ({data: {session: {access_token: "test-session"}}})}};'}));
    }}],
  });
  api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
});
afterEach(() => mock.restoreAll());

test('loads the durable conversation', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(snapshot)));
  assert.deepEqual(await api.loadWorkspaceSnapshot(), snapshot);
});
test('history failures are reported rather than presented as an empty conversation', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('{}', {status: 503}));
  await assert.rejects(api.loadWorkspaceSnapshot(), /Could not load your saved conversation/);
});
test('offline loads cannot erase the conversation with a default snapshot', async () => {
  mock.method(globalThis, 'fetch', async () => {throw Error('Offline');});
  await assert.rejects(api.loadWorkspaceSnapshot(), /Offline/);
});
test('reads the final saved snapshot even without a trailing newline', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({type: 'done', snapshot}), {headers: {'Content-Type': 'application/x-ndjson'}}));
  const events: unknown[] = [];
  assert.deepEqual(await api.sendWorkspaceMessage('Hello', e => events.push(e), undefined, 'request-1'), snapshot);
  assert.equal(events.length, 1);
});
test('an interrupted response is not reported as successfully saved', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('{"type":"text","text":"Partial"}\n', {headers: {'Content-Type': 'application/x-ndjson'}}));
  await assert.rejects(api.sendWorkspaceMessage('Hello', () => {}), /finished saving/);
});
test('voice transcript writes wait for the preceding save acknowledgement', async () => {
  let release!: () => void; const first = new Promise<void>(resolve => {release = resolve;});
  const ids: string[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    ids.push(JSON.parse(String(init.body)).runId);
    if (ids.length === 1) await first;
    return new Response(JSON.stringify({snapshot}), {headers: {'Content-Type': 'application/json'}});
  });
  const a = api.recordWorkspaceTranscript('Hello', 'user', 'voice-1');
  const b = api.recordWorkspaceTranscript('Hi', 'assistant', 'voice-2');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ids, ['voice-1']);
  release(); await Promise.all([a, b]);
  assert.deepEqual(ids, ['voice-1', 'voice-2']);
});

test('voice requests use the authenticated backend and pass cancellation', async () => {
  const controller = new AbortController();
  const audio = new Blob(['wav'], {type:'audio/wav'});
  mock.method(globalThis, 'fetch', async (url:unknown, init:RequestInit) => {
    assert.equal(url, 'https://example.supabase.co/functions/v1/workspace-voice?operation=transcribe');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-session');
    assert.equal(new Headers(init.headers).get('Content-Type'), 'audio/wav');
    assert.equal(init.body, audio); assert.equal(init.signal, controller.signal);
    return new Response(JSON.stringify({text:'Option B'}));
  });
  assert.equal(await api.transcribeVoiceAudio(audio, controller.signal), 'Option B');
});
test('voice availability errors remain visible', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({error:'Speech recognition is not configured.'}), {status:400}));
  await assert.rejects(api.checkVoiceAvailability(), /not configured/);
});

test('hosted TTS requests are authenticated and cannot return a non-audio success',async()=>{
  mock.method(globalThis,'fetch',async(url:unknown,init:RequestInit)=>{
    assert.equal(url,'https://example.supabase.co/functions/v1/workspace-voice?operation=speak');
    assert.equal(new Headers(init.headers).get('Authorization'),'Bearer test-session');
    assert.deepEqual(JSON.parse(String(init.body)),{text:'Hello'});
    return new Response('{}',{headers:{'Content-Type':'application/json'}});
  });
  await assert.rejects(api.requestVoiceSpeech('Hello'),/spoken reply/);
});
