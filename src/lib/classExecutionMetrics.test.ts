import assert from 'node:assert/strict';
import { buildClassExecutionMetrics } from './classExecutionMetricsCore';

const metrics = buildClassExecutionMetrics({
  prescriptions: [
    { tasks: [{}, {}, {}] },
    { tasks: [{}] },
  ],
  completions: [{}, {}],
  profiles: [
    { user_id: 'student-1', backlog_count: 4, missed_days_streak: 2 },
    { user_id: 'student-2', backlog_count: 1, missed_days_streak: 0 },
  ],
  interventions: [
    {
      id: 'risk-1',
      student_user_id: 'student-1',
      trigger_type: 'backlog_growth',
      severity: 'high',
      intervention_level: 3,
      action_type: 'proof_required',
      action_payload: { message: 'Upload correction proof.' },
      created_at: '2026-04-29T00:00:00.000Z',
      status: 'active',
      created_by_type: 'system',
    },
    {
      id: 'risk-2',
      student_user_id: 'student-2',
      trigger_type: 'missed_mission',
      severity: 'low',
      intervention_level: 1,
      action_type: 'compress_plan',
      action_payload: {},
      created_at: '2026-04-29T00:00:00.000Z',
      status: 'resolved',
      created_by_type: 'system',
    },
  ],
  activeSprints: [{ id: 'sprint-1' }],
  users: [
    { id: 'student-1', full_name: 'Asha' },
    { id: 'student-2', email: 'student@example.com' },
  ],
});

assert.equal(metrics.missionCompletionRate, 50);
assert.equal(metrics.backlogCount, 5);
assert.equal(metrics.unresolvedRiskCount, 1);
assert.equal(metrics.resolvedInterventionCount, 1);
assert.equal(metrics.totalInterventionCount, 2);
assert.equal(metrics.interventionResolutionRate, 50);
assert.equal(metrics.highRiskCount, 1);
assert.equal(metrics.riskQueue[0].studentName, 'Asha');
assert.equal(metrics.riskQueue[0].recommendedAction, 'Upload correction proof.');

console.log('classExecutionMetrics tests passed');
