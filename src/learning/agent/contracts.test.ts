import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyWorkspace,
  putArtifact,
  removeArtifact,
  type WorkspaceArtifact,
} from './contracts';

describe('Agent Workspace Contracts & State', () => {
  it('creates an empty workspace', () => {
    const ws = emptyWorkspace();
    assert.deepEqual(ws.artifacts, []);
    assert.equal(ws.activeId, null);
    assert.equal(ws.plan, null);
    assert.equal(ws.checkpointId, null);
  });

  it('adds and activates artifacts correctly', () => {
    let ws = emptyWorkspace();
    const art1: WorkspaceArtifact = {
      id: 'material:123',
      kind: 'material',
      title: 'Biology Chapter 1',
      materialId: '123',
      page: 1,
    };

    ws = putArtifact(ws, art1);
    assert.equal(ws.artifacts.length, 1);
    assert.equal(ws.artifacts[0].id, 'material:123');
    assert.equal(ws.activeId, 'material:123');

    const art2: WorkspaceArtifact = {
      id: 'session:456',
      kind: 'session',
      title: 'Photosynthesis Quiz',
      sessionId: '456',
    };

    ws = putArtifact(ws, art2);
    assert.equal(ws.artifacts.length, 2);
    assert.equal(ws.activeId, 'session:456');

    // Updating existing artifact replaces it and sets active
    const art1Updated: WorkspaceArtifact = {
      ...art1,
      page: 3,
    };
    ws = putArtifact(ws, art1Updated);
    assert.equal(ws.artifacts.length, 2);
    assert.equal(ws.activeId, 'material:123');
    const found = ws.artifacts.find((a) => a.id === 'material:123');
    assert.ok(found && found.kind === 'material');
    if (found && found.kind === 'material') {
      assert.equal(found.page, 3);
    }
  });

  it('removes artifacts and updates activeId smoothly', () => {
    let ws = emptyWorkspace();
    const art1: WorkspaceArtifact = {
      id: 'art-1',
      kind: 'progress',
      title: 'Progress',
    };
    const art2: WorkspaceArtifact = {
      id: 'art-2',
      kind: 'explanation',
      title: 'Limits explanation',
      text: 'Sample',
      citations: [],
    };

    ws = putArtifact(ws, art1);
    ws = putArtifact(ws, art2);
    assert.equal(ws.activeId, 'art-2');

    // Remove active artifact -> falls back to previous artifact
    ws = removeArtifact(ws, 'art-2');
    assert.equal(ws.artifacts.length, 1);
    assert.equal(ws.activeId, 'art-1');

    // Remove last remaining artifact -> activeId becomes null
    ws = removeArtifact(ws, 'art-1');
    assert.equal(ws.artifacts.length, 0);
    assert.equal(ws.activeId, null);
  });
});
