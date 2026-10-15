import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanOnboardingAnswers, courseNames, initialAdaptation, onboardingInsight, onboardingQuestions } from './onboarding-profile.ts';

test('questionnaire has 17 choices and 3 written answers, all with distinct IDs', () => {
  assert.equal(onboardingQuestions.filter(q => q.options).length, 17);
  assert.equal(onboardingQuestions.filter(q => !q.options).length, 3);
  assert.equal(new Set(onboardingQuestions.map(q => q.id)).size, 20);
});

test('saved profile only accepts known choices and bounded written answers', () => {
  const clean = cleanOnboardingAnswers({daily_minutes:'999999',focus:'-10',days:'NaN',feedback:'gentle',unknown:'ignore',obstacle:'x'.repeat(1000),goal:{bad:true}});
  assert.deepEqual(Object.keys(clean).sort(), ['feedback','obstacle']);
  assert.equal(clean.obstacle.length, 600);
  assert.equal(initialAdaptation(null), null);
  assert.equal(initialAdaptation([]), null);
  assert.equal(initialAdaptation({fake:'profile'}), null);
});

test('budget math and focus limits stay consistent between checkpoints and agent guidance', () => {
  for (const daily_minutes of ['10','20','30','45']) {
    for (const days of ['3','4','5','7']) {
      for (const focus of ['5','10','20','30']) {
        const answers={daily_minutes,days,focus,courses:'Math, Chemistry',energy:'morning'};
        const profile=initialAdaptation(answers)!;
        assert.equal(profile.weeklyMinutes, Number(daily_minutes)*Number(days));
        assert.equal(profile.focusMinutes, Math.min(Number(focus),Number(daily_minutes)));
        assert.equal(onboardingInsight(answers,6).metric, `${profile.weeklyMinutes} min`);
        assert.equal(onboardingInsight(answers,9).metric, `${profile.focusMinutes} min`);
      }
    }
  }
});

test('preferences and self-reported obstacles reach the initial agent profile', () => {
  const profile=initialAdaptation({daily_minutes:'20',explanation:'steps',stuck:'hint',feedback:'direct',structure:'flexible',review:'alternate',ambition:'Understand methods',obstacle:'Busy evenings',partnership:'calm'})!;
  assert.equal(profile.source,'self_reported_onboarding');
  assert.equal(profile.explanation,'steps');
  assert.equal(profile.hintStyle,'hint');
  assert.equal(profile.feedback,'direct');
  assert.equal(profile.obstacle,'Busy evenings');
  assert.equal(profile.structure,'flexible');
  assert.equal(profile.review,'alternate');
  assert.equal(profile.partnership,'calm');
});

test('course parsing trims, removes blanks and deduplicates case-insensitively', () => {
  assert.deepEqual(courseNames(' Math, Chemistry, math, , '), ['math','Chemistry']);
  assert.deepEqual(courseNames(' , '), []);
});
