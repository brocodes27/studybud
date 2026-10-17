import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInteractiveUI, INTERACTIVE_UI_GUIDE } from '../../../supabase/functions/_shared/interactive-ui.ts';
import { assertTool } from '../../../supabase/functions/_shared/workspace-contracts.ts';
import { interactiveDocument } from './interactiveDocument';

const ui = { html: '<label>Angle<input type="range"></label><svg></svg>', css: 'svg{width:100%}', js: 'document.querySelector("input").value = 30;' };
test('validates model payloads without losing a text-only explanation', () => {
  assert.deepEqual(parseInteractiveUI(ui), ui);
  for (const value of [null, {}, { ...ui, html: '' }, { ...ui, js: [] }, { ...ui, css: 'a'.repeat(12001) }, { ...ui, html: 'a'.repeat(24001) }, { ...ui, js: 'a'.repeat(24001) }]) {
    assert.equal(parseInteractiveUI(value), undefined);
  }
});
test('contains code behind a nonce and restricts network APIs, nested frames, and forms', () => {
  const document = interactiveDocument(ui, 'unique-nonce');
  assert.ok(document.includes(ui.html));
  assert.ok(document.includes(ui.js));
  for (const directive of ["default-src 'none'", "script-src 'nonce-unique-nonce'", "connect-src 'none'", "frame-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert.ok(document.includes(directive));
  assert.match(document, /prefers-reduced-motion/);
  assert.throws(() => interactiveDocument(ui, '\" bad'));
});
test('embedded code cannot close its script or style element', () => {
  const document = interactiveDocument({ ...ui, js: 'const x = "</ScRiPt><script>alert(1)</script>";', css: '/* </STYLE><script> */' }, 'nonce');
  assert.equal((document.match(/<\/script>/gi) || []).length, 1);
  assert.equal((document.match(/<\/style>/gi) || []).length, 1);
});
test('interactive explanations retain the diagnostic gate and grounding instructions', () => {
  assert.throws(() => assertTool('explain', true), /independent check/);
  assert.doesNotThrow(() => assertTool('explain', false));
  assert.doesNotThrow(() => assertTool('close_artifact', true));
  assert.doesNotThrow(() => assertTool('cancel_checkpoint', true));
  assert.match(INTERACTIVE_UI_GUIDE, /supplied source/);
  assert.match(INTERACTIVE_UI_GUIDE, /citations must stand on their own/);
});
