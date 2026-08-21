import type { ActionEvent } from '@openuidev/react-lang';

const ALLOWED_ROUTES = new Set(['/', '/prove-it']);
const SAFE_CONTINUE_PROMPTS = {
  next_step: 'Show me the next useful step.',
  smaller_hint: 'Give me one smaller hint without revealing the answer.',
  start_task: 'Begin the suggested study step with one guiding question.',
  adjust_plan: 'Help me adjust this plan using my current study context.',
} as const;

export type AtlasOpenUIResolvedAction =
  | { kind: 'continue'; prompt: string }
  | { kind: 'navigate'; route: string };

export function resolveAtlasOpenUIAction(event: ActionEvent): AtlasOpenUIResolvedAction | null {
  if (event.type === 'atlas_continue') {
    if (!Object.prototype.hasOwnProperty.call(event.params, 'intent')) return null;
    const intent = event.params.intent;
    if (
      typeof intent !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SAFE_CONTINUE_PROMPTS, intent)
    ) {
      return null;
    }
    return {
      kind: 'continue',
      prompt: SAFE_CONTINUE_PROMPTS[intent as keyof typeof SAFE_CONTINUE_PROMPTS],
    };
  }

  if (event.type === 'atlas_navigate') {
    if (!Object.prototype.hasOwnProperty.call(event.params, 'route')) return null;
    const route = event.params.route;
    if (typeof route !== 'string' || !ALLOWED_ROUTES.has(route)) return null;
    return { kind: 'navigate', route };
  }

  return null;
}
