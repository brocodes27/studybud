/**
 * Telemetry for the PERIR-O stage path (PRD v2 §9).
 *
 * Writes to the existing `analytics_events` table — the analytics decision
 * (P0.4) was in-house on Supabase, and this needs no new table, no new vendor,
 * and no new RLS story.
 *
 * Every call is fire-and-forget and swallows its own failures. A telemetry
 * write must never be what stops a student studying, and an await here would
 * put a network round-trip in front of the "start" button.
 *
 * The one metric that cannot be reconstructed later is the stage-correct
 * session rate — whether the student ran the action that was prescribed, or
 * something they picked instead. That is the phase's exit criterion, so
 * `was_prescribed` has to be recorded truthfully at the moment it happens.
 */

import { supabase } from './supabase';

export const STAGE_EVENTS = {
  prescribed: 'stage_action_prescribed',
  started: 'stage_session_started',
  completed: 'stage_session_completed',
  advanced: 'stage_advanced',
  gateBlocked: 'stage_gate_blocked',
  overrideUsed: 'stage_override_used',
  interleaveCompleted: 'interleave_set_completed',
  overlearnUnlocked: 'overlearn_unlocked',
  primerCacheHit: 'primer_cache_hit',
  primerFallbackUsed: 'primer_fallback_used',
} as const;

export type StageEvent = (typeof STAGE_EVENTS)[keyof typeof STAGE_EVENTS];

export function trackStage(event: StageEvent, metadata: Record<string, unknown> = {}): void {
  void supabase
    .from('analytics_events')
    .insert({
      event_name: event,
      metadata,
      path: typeof window !== 'undefined' ? window.location.pathname : null,
    })
    .then(undefined, () => undefined);
}

/**
 * Logs the whole queue in one event rather than one per card.
 *
 * The interesting unit is the day's plan — how many actions it held, which
 * stages, how many subjects it spanned — and splitting that across three rows
 * would mean reassembling it in every query that asks whether the planner is
 * behaving.
 */
export function trackPrescribed(
  actions: Array<{ action: string; subject: string; topicId: string; forced: boolean }>,
  interleaveOffered: boolean,
): void {
  if (actions.length === 0 && !interleaveOffered) return;

  trackStage(STAGE_EVENTS.prescribed, {
    count: actions.length,
    stages: actions.map((action) => action.action),
    subjects: [...new Set(actions.map((action) => action.subject))],
    topic_ids: actions.map((action) => action.topicId),
    forced: actions.filter((action) => action.forced).length,
    interleave_offered: interleaveOffered,
  });
}
