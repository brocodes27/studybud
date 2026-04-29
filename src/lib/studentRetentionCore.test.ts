import assert from 'node:assert/strict';
import { buildStudentCommandCenter } from './studentRetentionCore';

const comeback = buildStudentCommandCenter({
  streak: 0,
  studentState: {
    backlogCount: 6,
    missedDaysStreak: 3,
    weakSubjects: ['Physics', 'Chemistry'],
  },
  todayTasks: [
    { title: 'Physics rescue block', completed: false, proofRequired: true, durationMin: 20, subject: 'Physics' },
    { title: 'Chemistry quick revision', completed: false, durationMin: 15, subject: 'Chemistry' },
  ],
  recentSubmissions: [],
});

assert.equal(comeback.mode, 'comeback');
assert.equal(comeback.primaryQuest.label, 'Main Quest');
assert.equal(comeback.primaryQuest.proofRequired, true);
assert.equal(comeback.identityTitle, 'Comeback Arc');
assert.ok(comeback.coachLine.includes('No guilt'));
assert.ok(comeback.rewardCue.includes('proof'));

const momentum = buildStudentCommandCenter({
  streak: 8,
  studentState: {
    backlogCount: 0,
    missedDaysStreak: 0,
    weakSubjects: [],
  },
  todayTasks: [
    { title: 'Calculus retrieval check', completed: true, durationMin: 15, subject: 'Math' },
    { title: 'Optional beast mode set', completed: false, durationMin: 25, subject: 'Math' },
  ],
  recentSubmissions: [{ id: 'sub-1' }, { id: 'sub-2' }],
});

assert.equal(momentum.mode, 'momentum');
assert.equal(momentum.completedCount, 1);
assert.equal(momentum.progressPct, 50);
assert.equal(momentum.sideQuest?.label, 'Side Quest');
assert.ok(momentum.identityTitle.includes('8-Day'));

console.log('studentRetentionCore tests passed');
