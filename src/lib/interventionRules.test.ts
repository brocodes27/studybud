import assert from 'node:assert/strict';
import { chooseIntervention, type InterventionSignalInput } from './interventionRules';

function base(overrides: Partial<InterventionSignalInput> = {}): InterventionSignalInput {
  return {
    studentUserId: 'student-1',
    classId: 'class-1',
    roadmapId: 'roadmap-1',
    missedMissionDays: 0,
    backlogCount: 0,
    previousBacklogCount: 0,
    avoidedSubjects: [],
    shrinkingSession: false,
    correctionSprintStalled: false,
    attendanceRiskLevel: 'low',
    unresolvedLevel3Count: 0,
    ...overrides,
  };
}

const level1 = chooseIntervention(base({ missedMissionDays: 1 }));
assert.equal(level1?.interventionLevel, 1);
assert.equal(level1?.triggerType, 'missed_mission');
assert.equal(level1?.actionType, 'compress_plan');

const level2 = chooseIntervention(base({
  missedMissionDays: 2,
  avoidedSubjects: ['Chemistry'],
}));
assert.equal(level2?.interventionLevel, 2);
assert.equal(level2?.triggerType, 'subject_avoidance');
assert.equal(level2?.actionType, 'rescue_block');
assert.deepEqual(level2?.actionPayload.subject, 'Chemistry');

const backlog = chooseIntervention(base({
  backlogCount: 9,
  previousBacklogCount: 3,
}));
assert.equal(backlog?.triggerType, 'backlog_growth');
assert.equal(backlog?.severity, 'medium');

const level4 = chooseIntervention(base({
  attendanceRiskLevel: 'high',
  unresolvedLevel3Count: 2,
}));
assert.equal(level4?.interventionLevel, 4);
assert.equal(level4?.actionType, 'teacher_review');

const normal = chooseIntervention(base());
assert.equal(normal, null);

console.log('interventionRules tests passed');
