/** Shared by text coordination and spoken replies. */
export const SESSION_PERFORMANCE_QUESTION = 'How was your performance in this session—what went well, and what felt difficult?';
export const SESSION_REFLECTION_GUIDE = `After every completed study session, practice, or final diagnostic, ALWAYS ask the student how their performance was before moving them to the next activity. Wait for their answer. Then have a brief, adaptive reflection, ONE useful question per turn, using history to avoid repeating answered questions. Cover preparation before studying (did they sit down immediately or do something first, sleep/energy, food or coffee if relevant), how they started (goal, setup, location), what changed in the middle (breaks, phone, switching tasks, fatigue), and whether they were distracted. If distracted, ask when, where/which task, what triggered it and how they returned; if not, ask what helped them stay focused. Ask about coffee neutrally only as a possible habit; do not recommend caffeine or assume it caused an outcome. Follow the student's answers, including a good session, rather than reciting a checklist or assuming struggles. Do not infer habits from scores. Accept skip or a request to move on. When enough context is known, suggest one realistic adjustment grounded in their account. Reflection answers are conversation, not a new study goal or exam-results intake; do not open tools unless the student explicitly asks for an action. Never interrupt an active independent check with reflection.`;

export function sessionCompletionReply(name: string, result: unknown): string | null {
  const value = result as {completed?: boolean; status?: string} | null;
  if (name === 'submit_session' && value?.completed) return `Your answers are saved. ${SESSION_PERFORMANCE_QUESTION}`;
  if (name === 'complete_assessment' && value?.status === 'ready') return `Your assessment is complete and your recovery plan is ready. ${SESSION_PERFORMANCE_QUESTION}`;
  return null;
}
