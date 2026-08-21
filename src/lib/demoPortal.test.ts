import assert from 'node:assert/strict';
import {
  completedDemoSteps,
  createDemoPortalState,
  demoPortalReducer,
} from './demoPortal';

let state = createDemoPortalState();
assert.equal(state.activeRole, 'teacher');
assert.equal(completedDemoSteps(state), 1);

const blockedStart = demoPortalReducer(state, { type: 'start_session' });
assert.equal(blockedStart, state, 'A student session cannot start before repair is assigned');

state = demoPortalReducer(state, { type: 'assign_repair' });
assert.equal(state.repairAssigned, true);
assert.equal(completedDemoSteps(state), 2);

state = demoPortalReducer(state, { type: 'start_session' });
state = demoPortalReducer(state, { type: 'show_hint' });
state = demoPortalReducer(state, { type: 'select_answer', answer: 'x = 5' });
state = demoPortalReducer(state, { type: 'submit_evidence' });
assert.equal(state.evidenceSubmitted, false, 'An incorrect answer must not create evidence');

state = demoPortalReducer(state, { type: 'select_answer', answer: 'x = 7' });
state = demoPortalReducer(state, { type: 'submit_evidence' });
assert.equal(state.evidenceSubmitted, true);
assert.equal(state.masteryAfter, 74);
assert.equal(completedDemoSteps(state), 4);

state = demoPortalReducer(state, { type: 'review_evidence' });
assert.equal(state.evidenceReviewed, true);
assert.equal(completedDemoSteps(state), 5);

const duplicate = demoPortalReducer(state, { type: 'review_evidence' });
assert.equal(duplicate.timeline.length, state.timeline.length, 'Repeated actions stay idempotent');

state = demoPortalReducer(state, { type: 'reset' });
assert.deepEqual(state, createDemoPortalState());

console.log('Demo portal state tests passed');
