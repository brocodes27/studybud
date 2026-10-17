import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canPresentResearch, unreadResearch } from './researchBriefing';
import { emptyWorkspace, type WorkspaceArtifact } from './contracts';

const brief = (id: string, createdAt: string): WorkspaceArtifact => ({ id, kind: 'research', title: id, topic: id, text: 'Saved findings', sources: [], materialId: 'notes', createdAt });
test('arrival uses only unread, open, completed briefs, newest first', () => {
  const state = { ...emptyWorkspace(), artifacts: [brief('old', '2026-10-16'), brief('new', '2026-10-18'), brief('reviewed', '2026-10-17'), brief('closed', '2026-10-17'), { ...brief('empty', '2026-10-18'), text: ' ' }, { id: 'notes', kind: 'material' as const, title: 'Notes', materialId: 'notes' }], reviewedArtifactIds: ['reviewed'], closedArtifactIds: ['closed'] };
  assert.deepEqual(unreadResearch(state).map(item => item.id), ['new', 'old']);
  assert.equal(state.artifacts[0].id, 'old');
});
test('briefing never takes over a session, assessment, or independent check', () => {
  const state = emptyWorkspace();
  assert.equal(canPresentResearch(state), true);
  assert.equal(canPresentResearch({ ...state, checkpointId: 'check' }), false);
  assert.equal(canPresentResearch({ ...state, activeId: 'session', artifacts: [{ id: 'session', kind: 'session', title: 'Practice', sessionId: 's' }] }), false);
  assert.equal(canPresentResearch({ ...state, activeId: 'assessment', artifacts: [{ id: 'assessment', kind: 'assessment', title: 'Check', goal: 'Learn', mode: 'study', status: 'setup', targets: [], sessionIds: [] }] }), false);
  assert.equal(canPresentResearch({ ...state, activeId: 'brief', artifacts: [brief('brief', '2026-10-18')] }), true);
});
