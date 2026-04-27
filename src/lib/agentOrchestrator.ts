// ============================================================================
// Agent Orchestrator
// ----------------------------------------------------------------------------
// Runs a set of *real* autonomous actions in parallel when the user opens the
// app, streaming progress to the UI. This is what makes the product feel
// agentic instead of chatbot-ish: the system is already working when you
// arrive, and it *shows its work*.
//
// Each action is a real side-effect (DB read, edge function, RPC). Each
// reports its own progress via an `onUpdate` callback so the UI can render a
// live workstream. Actions are best-effort — one failing doesn't stop others.
// ============================================================================

import { supabase } from './supabase';
import { recall } from './memory';

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface AgentStep {
  id: string;
  /** Short label shown while running, e.g. "Analyzing Physics submission..." */
  label: string;
  /** Final single-line summary shown when done, e.g. "Flagged 2 weak spots in kinematics" */
  result?: string;
  /** Optional longer detail shown on hover/expand */
  detail?: string;
  /** Semantic category for iconography / grouping */
  category: 'analysis' | 'planning' | 'memory' | 'intel' | 'repair';
  status: AgentStepStatus;
  startedAt?: number;
  finishedAt?: number;
}

export interface AgentRunReport {
  steps: AgentStep[];
  findings: string[];            // short lines for "what I did" summary
  proactiveQuestion?: string;    // one question the agent wants to ask
  bookmark?: string;             // "where I left you" marker
}

type StepUpdate = (step: AgentStep) => void;

const now = () => Date.now();

function makeStep(init: Pick<AgentStep, 'id' | 'label' | 'category'>): AgentStep {
  return { ...init, status: 'pending' };
}

// ----------------------------------------------------------------------------
// Individual action runners
// ----------------------------------------------------------------------------

/**
 * Analyze any task_outputs that haven't been analyzed yet.
 * Real action: calls `analyse-task-output` for each pending row.
 */
async function actionAnalyzePendingOutputs(
  userId: string,
  step: AgentStep,
  onUpdate: StepUpdate,
): Promise<string[]> {
  step.status = 'running';
  step.startedAt = now();
  onUpdate({ ...step });

  const findings: string[] = [];
  try {
    const { data: pending } = await supabase
      .from('task_outputs')
      .select('id, output_type, text_content, file_url, created_at')
      .eq('user_id', userId)
      .is('ai_analysis', null)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!pending || pending.length === 0) {
      step.status = 'skipped';
      step.result = 'No pending submissions to review';
      step.finishedAt = now();
      onUpdate({ ...step });
      return findings;
    }

    step.label = `Reviewing your last ${pending.length} submission${pending.length === 1 ? '' : 's'}...`;
    onUpdate({ ...step });

    let analyzed = 0;
    for (const row of pending) {
      try {
        await supabase.functions.invoke('analyse-task-output', {
          body: {
            output_id: row.id,
            task_title: (row as any).file_url ? 'File submission' : 'Your submission',
            subject: null,
            output_type: row.output_type || 'text',
            text_content: row.text_content || null,
          },
        });
        analyzed += 1;
      } catch {
        // best effort
      }
    }

    step.status = 'done';
    step.result = analyzed > 0
      ? `Analyzed ${analyzed} submission${analyzed === 1 ? '' : 's'} and updated your learner model`
      : 'Couldn\'t reach analyzer — will retry later';
    step.finishedAt = now();
    onUpdate({ ...step });

    if (analyzed > 0) {
      findings.push(`Analyzed ${analyzed} pending submission${analyzed === 1 ? '' : 's'} and folded it into your learner model.`);
    }
  } catch (e) {
    step.status = 'error';
    step.result = 'Submission review skipped (non-fatal)';
    step.finishedAt = now();
    onUpdate({ ...step });
  }
  return findings;
}

/**
 * Refresh the behavioral profile so backlog/missed-days/weak-subjects are current.
 * Real action: RPC call to `refresh_behavioral_profile`.
 */
async function actionRefreshProfile(
  userId: string,
  step: AgentStep,
  onUpdate: StepUpdate,
): Promise<string[]> {
  step.status = 'running';
  step.startedAt = now();
  onUpdate({ ...step });

  const findings: string[] = [];
  try {
    const { data, error } = await supabase.rpc('refresh_behavioral_profile', { p_user_id: userId });
    if (error) throw error;

    const backlog = (data as any)?.backlog_count ?? 0;
    const missed = (data as any)?.missed_days_streak ?? 0;
    const weak: string[] = (data as any)?.weak_subjects ?? [];

    const bits: string[] = [];
    if (backlog > 0) bits.push(`${backlog} backlog item${backlog === 1 ? '' : 's'}`);
    if (missed > 1) bits.push(`${missed} missed days`);
    if (weak.length > 0) bits.push(`weak: ${weak.slice(0, 2).join(', ')}`);

    step.status = 'done';
    step.result = bits.length
      ? `Updated your state — ${bits.join(' · ')}`
      : 'State refreshed — nothing urgent';
    step.finishedAt = now();
    onUpdate({ ...step });

    if (backlog > 2 || missed > 2) {
      findings.push(`Your backlog is at ${backlog} and you've missed ${missed} days — I'll factor that into tonight's plan.`);
    } else if (weak.length > 0) {
      findings.push(`Your weakest signals right now are ${weak.slice(0, 2).join(' and ')} — prioritizing those.`);
    }
  } catch {
    step.status = 'error';
    step.result = 'State refresh failed';
    step.finishedAt = now();
    onUpdate({ ...step });
  }
  return findings;
}

/**
 * Check the test calendar for anything urgent so the agent can warn proactively.
 */
async function actionScanExamCalendar(
  userId: string,
  step: AgentStep,
  onUpdate: StepUpdate,
): Promise<string[]> {
  step.status = 'running';
  step.startedAt = now();
  onUpdate({ ...step });

  const findings: string[] = [];
  try {
    const { data } = await supabase
      .from('upcoming_tests')
      .select('test_name, test_date, syllabus')
      .eq('user_id', userId)
      .eq('status', 'upcoming')
      .order('test_date', { ascending: true })
      .limit(1);

    const next = data && data[0];
    if (!next) {
      step.status = 'skipped';
      step.result = 'No upcoming tests scheduled';
      step.finishedAt = now();
      onUpdate({ ...step });
      return findings;
    }

    const daysAway = Math.ceil(
      (new Date(next.test_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    step.status = 'done';
    step.result = `Next test: ${next.test_name} in ${daysAway} day${daysAway === 1 ? '' : 's'}`;
    step.finishedAt = now();
    onUpdate({ ...step });

    if (daysAway <= 3) {
      findings.push(`${next.test_name} is ${daysAway} day${daysAway === 1 ? '' : 's'} out — I've biased tonight toward revision over new material.`);
    } else if (daysAway <= 7) {
      findings.push(`${next.test_name} is in ${daysAway} days — I'll start tightening your plan this week.`);
    }
  } catch {
    step.status = 'skipped';
    step.result = 'Exam calendar unavailable';
    step.finishedAt = now();
    onUpdate({ ...step });
  }
  return findings;
}

/**
 * Recall memory so the agent can greet the student with continuity.
 */
async function actionRecallMemory(
  _userId: string,
  step: AgentStep,
  onUpdate: StepUpdate,
): Promise<{ findings: string[]; bookmark?: string }> {
  step.status = 'running';
  step.startedAt = now();
  onUpdate({ ...step });

  const findings: string[] = [];
  try {
    const { memories } = await recall(undefined, { limit: 8, includeBaseline: true });
    const bookmark = memories.find((m) => m.memory_type === 'bookmark')?.value;
    const style = memories.find((m) => m.memory_type === 'communication_style')?.value;
    const goal = memories.find((m) => m.memory_type === 'goal')?.value;

    const bits: string[] = [];
    if (bookmark) bits.push('last session context');
    if (style) bits.push('your communication style');
    if (goal) bits.push('your target goal');

    step.status = 'done';
    step.result = bits.length
      ? `Recalled ${bits.join(', ')}`
      : 'No long-term memory yet — I\'ll start building it';
    step.finishedAt = now();
    onUpdate({ ...step });

    if (bookmark) {
      findings.push(`I remember you left off on: "${bookmark.slice(0, 120)}"`);
    }
    return { findings, bookmark };
  } catch {
    step.status = 'error';
    step.result = 'Memory lookup failed';
    step.finishedAt = now();
    onUpdate({ ...step });
    return { findings };
  }
}

/**
 * Count weak-area knowledge and surface a prioritized repair target.
 */
async function actionIdentifyRepairTarget(
  userId: string,
  step: AgentStep,
  onUpdate: StepUpdate,
): Promise<string[]> {
  step.status = 'running';
  step.startedAt = now();
  onUpdate({ ...step });

  const findings: string[] = [];
  try {
    const { data } = await supabase
      .from('user_subject_mastery')
      .select('domain, subdomain, mastery_score')
      .eq('user_id', userId)
      .order('mastery_score', { ascending: true })
      .limit(3);

    if (!data || data.length === 0) {
      step.status = 'skipped';
      step.result = 'No mastery signals yet';
      step.finishedAt = now();
      onUpdate({ ...step });
      return findings;
    }

    const weakest = data[0];
    step.status = 'done';
    step.result = `Weakest signal: ${weakest.domain} → ${weakest.subdomain || 'general'}`;
    step.finishedAt = now();
    onUpdate({ ...step });

    if ((weakest.mastery_score ?? 100) < 50) {
      findings.push(`${weakest.domain} (${weakest.subdomain || 'general'}) is your weakest signal at ${weakest.mastery_score}% — I'll prioritize repair there.`);
    }
  } catch {
    step.status = 'error';
    step.result = 'Mastery lookup failed';
    step.finishedAt = now();
    onUpdate({ ...step });
  }
  return findings;
}

// ----------------------------------------------------------------------------
// Public: runAgentWorkstream
// ----------------------------------------------------------------------------

/**
 * Runs all autonomous startup actions in parallel, streaming updates to the UI.
 * Returns a final report the conversational briefing can reference.
 */
export async function runAgentWorkstream(
  userId: string,
  onUpdate: StepUpdate,
): Promise<AgentRunReport> {
  const steps: AgentStep[] = [
    makeStep({ id: 'memory',    label: 'Recalling what I know about you...',    category: 'memory'   }),
    makeStep({ id: 'profile',   label: 'Refreshing your current state...',      category: 'analysis' }),
    makeStep({ id: 'analyze',   label: 'Reviewing your pending submissions...', category: 'analysis' }),
    makeStep({ id: 'calendar',  label: 'Scanning your exam calendar...',        category: 'intel'    }),
    makeStep({ id: 'repair',    label: 'Identifying the highest-leverage gap...',category: 'repair'   }),
  ];

  // Emit initial pending states so UI can render the workstream skeleton
  steps.forEach((s) => onUpdate({ ...s }));

  const findings: string[] = [];
  let bookmark: string | undefined;

  // Run all in parallel; never throw
  const results = await Promise.allSettled([
    actionRecallMemory(userId, steps[0], onUpdate),
    actionRefreshProfile(userId, steps[1], onUpdate),
    actionAnalyzePendingOutputs(userId, steps[2], onUpdate),
    actionScanExamCalendar(userId, steps[3], onUpdate),
    actionIdentifyRepairTarget(userId, steps[4], onUpdate),
  ]);

  // Collect findings
  const r0 = results[0];
  if (r0.status === 'fulfilled') {
    findings.push(...r0.value.findings);
    bookmark = r0.value.bookmark;
  }
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') findings.push(...(r.value as string[]));
  }

  // Compose a proactive question (the agent asks YOU, not the other way round)
  const question = composeProactiveQuestion(steps, findings);

  return {
    steps,
    findings,
    proactiveQuestion: question,
    bookmark,
  };
}

function composeProactiveQuestion(steps: AgentStep[], findings: string[]): string | undefined {
  const profile = steps.find((s) => s.id === 'profile');
  if (profile?.result?.includes('missed days')) {
    return `You've been off for a few days — is something blocking you, or should I just trim today's plan to something manageable?`;
  }
  if (findings.some((f) => f.includes('weakest signal'))) {
    return `Should I spend tonight's session repairing that weak spot, or stay on roadmap?`;
  }
  return undefined;
}
