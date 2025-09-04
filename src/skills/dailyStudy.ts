import type { Skill } from './types';

function computeToday(plan: any) {
  let dayNumber = 1;
  if (plan?.created_at) {
    const created = new Date(plan.created_at);
    dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayNumber < 1) dayNumber = 1;
  }
  const today = (plan?.plan?.daily_schedule?.find((d: any) => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
  return { dayNumber, today };
}

export const dailyStudy: Skill = {
  id: 'dailyStudy',
  canStart: (message, ctx) => {
    void ctx;
    const t = message.toLowerCase();
    return (
      t.includes("start today's study") ||
      t.includes('start today') ||
      t.includes('study today') ||
      t.includes('start my day') ||
      t.includes('daily study')
    );
  },
  onStart: async (ctx) => {
    const plan = ctx.getPlanById(ctx.selectedPlan);
    if (!plan) {
      ctx.addAssistant('Select a study plan first to start today\'s study.');
      return;
    }
    const { today } = computeToday(plan);
    const topic = today?.topic || "today's topic";
    const focus = today?.description || 'Focus on understanding key ideas and basic problems.';
    ctx.addAssistant(
      `Let\'s begin today.\n\n` +
      `1) Read NCERT sections relevant to <strong>${topic}</strong>.\n` +
      `2) Note down 3 key ideas in your own words.\n` +
      `3) Practice 5 quick questions.\n` +
      `Focus: ${focus}.\n\n` +
      `When you\'re done, reply with "done". If you want practice first, reply "practice". If you want a quick quiz, reply "quiz".`
    );
  },
  onMessage: async (message, ctx, state, setState, end) => {
    const t = message.trim().toLowerCase();
    if (t.includes('practice')) {
      ctx.addAssistant('Here are 5 practice prompts. Answer briefly; I\'ll check your reasoning if needed.\n\n1) Define the core concept.\n2) Solve a basic example.\n3) Identify a common mistake.\n4) Create a real-life analogy.\n5) One challenge question.');
      ctx.addAssistant('Reply "done" when you finish or ask any doubt.');
      return;
    }
    if (t.includes('quiz')) {
      ctx.addAssistant('Okay, a quick 3-question self-check. Answer 1/2/3 in order.\n\nQ1) State one key definition.\nQ2) Solve a short computation/example.\nQ3) Name a subtopic you find tricky.');
      ctx.addAssistant('Reply with your answers like: 1) ..., 2) ..., 3) ...');
      setState({ ...state, step: 1 });
      return;
    }
    if (state.step === 1) {
      ctx.addAssistant('Thanks. From your answers, identify one weak area and do a 3-minute revision. If you want help, say "remediate".');
      end();
      return;
    }
    if (t.includes('done')) {
      ctx.addAssistant('Great job. Marking today as complete is available in the Today\'s Plan card. If you want flashcards for today\'s topic, just say: generate flashcards.');
      end();
      return;
    }
    // default
    ctx.addAssistant('Would you like practice or a quick quiz? You can also type "done" to finish.');
  }
};
