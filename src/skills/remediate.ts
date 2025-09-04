import type { Skill } from './types';

export const remediate: Skill = {
  id: 'remediate',
  canStart: (message, ctx) => {
    void ctx;
    const t = message.toLowerCase();
    return t.includes('remediate') || t.includes('fix weak') || t.includes('weak area');
  },
  onStart: async (ctx) => {
    ctx.addAssistant('Which subtopic do you find weak? Reply with the subtopic name.');
  },
  onMessage: async (message, ctx, state, setState, end) => {
    if (!state.step) {
      const subtopic = message.trim();
      if (!subtopic) {
        ctx.addAssistant('Please provide a subtopic name to target.');
        return;
      }
      setState({ ...state, step: 1, data: { subtopic } });
      ctx.addAssistant(
        `Let\'s drill <strong>${subtopic}</strong>.\n\n` +
        `1) One basic recall question.\n` +
        `2) One application example.\n` +
        `3) One trap question.\n\n` +
        `Answer briefly. When done, type "done".`
      );
      return;
    }
    if (state.step === 1) {
      if (message.trim().toLowerCase().includes('done')) {
        ctx.addAssistant('Good job. If you want, we can do a short re-test later.');
        end();
        return;
      }
      ctx.addAssistant('Thanks. Type "done" when you want to wrap up this drill.');
      return;
    }
  }
};
