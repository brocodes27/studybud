# Ranjan Sir Execution Control Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the school/coaching-first Execution Control Room: teacher class truth drives student daily missions, automated Level 1-2 interventions, a mentor risk queue, mission variants/proof, and class-level proof metrics.

**Architecture:** Add a small intervention domain model and pure rule engine, then wire it into existing Supabase functions and React surfaces. Reuse `class_sessions`, `daily_prescriptions`, `task_completions_v2`, `student_behavioral_profiles`, `correction_sprints`, and `TeacherClassDashboard` rather than creating a parallel system.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Supabase Postgres/RLS/RPC, Supabase Edge Functions, `tsx` for focused TypeScript rule tests, `npm run build` for integration verification.

---

## File Structure

- Create `supabase/migrations/20260429110000_create_interventions.sql`
  - Owns the `interventions` table, RLS policies, indexes, and helper RPCs for creating/resolving interventions.
- Create `src/lib/interventionRules.ts`
  - Pure TypeScript rule engine that turns behavioral/completion/test signals into intervention recommendations.
- Create `src/lib/interventionRules.test.ts`
  - Fast `tsx` tests using Node `assert` for Level 1, Level 2, and escalation behavior.
- Modify `supabase/functions/plan-daily-mission/index.ts`
  - Reads active interventions and emits low/normal/beast mission variants plus proof metadata.
- Modify `src/lib/dailyBriefing.ts`
  - Exposes mission variants, proof requirements, and active intervention state to the UI.
- Modify `src/components/DailyBriefing/TaskDashboard.tsx`
  - Displays mission variants, explicit "why this today," and proof-required state.
- Modify `src/components/DailyBriefing/TaskFocusView.tsx`
  - Prevents proof-required tasks from being silently completed without proof or debrief submission.
- Create `src/lib/classExecutionMetrics.ts`
  - Fetches class-level execution metrics and risk queue data.
- Modify `src/pages/TeacherClassDashboard.tsx`
  - Adds risk queue and metric cards to the existing Daily Teaching Loop tab.
- Create `supabase/functions/refresh-class-interventions/index.ts`
  - Service-role function for batch/cron refresh of intervention records for active class students.
- Modify `src/lib/dailyBriefing.ts`
  - Resolves active proof/rescue/compressed-plan interventions after successful proof-backed completion.

## Task 1: Intervention Data Model

**Files:**
- Create: `supabase/migrations/20260429110000_create_interventions.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260429110000_create_interventions.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  roadmap_id UUID REFERENCES public.student_roadmaps(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'missed_mission',
    'subject_avoidance',
    'shrinking_sessions',
    'backlog_growth',
    'test_avoidance',
    'correction_sprint_stalled',
    'attendance_risk',
    'proof_pending'
  )),
  trigger_source TEXT,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  intervention_level INTEGER NOT NULL CHECK (intervention_level BETWEEN 1 AND 4),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'compress_plan',
    'rescue_block',
    'proof_required',
    'correction_sprint_priority',
    'teacher_review',
    'parent_summary'
  )),
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'failed', 'dismissed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_type TEXT NOT NULL DEFAULT 'system' CHECK (created_by_type IN ('system', 'teacher', 'mentor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  outcome TEXT,
  outcome_metric JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (student_user_id, trigger_type, action_type, status)
);

CREATE INDEX IF NOT EXISTS idx_interventions_student_status
  ON public.interventions(student_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_class_status
  ON public.interventions(class_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_roadmap_status
  ON public.interventions(roadmap_id, status, created_at DESC);

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interventions_select_student ON public.interventions;
CREATE POLICY interventions_select_student
  ON public.interventions
  FOR SELECT
  USING (auth.uid() = student_user_id);

DROP POLICY IF EXISTS interventions_select_teacher ON public.interventions;
CREATE POLICY interventions_select_teacher
  ON public.interventions
  FOR SELECT
  USING (
    class_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = interventions.class_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS interventions_insert_system_or_teacher ON public.interventions;
CREATE POLICY interventions_insert_system_or_teacher
  ON public.interventions
  FOR INSERT
  WITH CHECK (
    created_by_type = 'system'
    OR created_by = auth.uid()
    OR (
      class_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = interventions.class_id
          AND c.teacher_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS interventions_update_teacher ON public.interventions;
CREATE POLICY interventions_update_teacher
  ON public.interventions
  FOR UPDATE
  USING (
    auth.uid() = student_user_id
    OR (
      class_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = interventions.class_id
          AND c.teacher_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.upsert_intervention(
  p_student_user_id UUID,
  p_class_id UUID,
  p_roadmap_id UUID,
  p_trigger_type TEXT,
  p_trigger_source TEXT,
  p_severity TEXT,
  p_intervention_level INTEGER,
  p_action_type TEXT,
  p_action_payload JSONB DEFAULT '{}'::jsonb,
  p_created_by_type TEXT DEFAULT 'system'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.interventions (
    student_user_id,
    class_id,
    roadmap_id,
    trigger_type,
    trigger_source,
    severity,
    intervention_level,
    action_type,
    action_payload,
    created_by,
    created_by_type
  )
  VALUES (
    p_student_user_id,
    p_class_id,
    p_roadmap_id,
    p_trigger_type,
    p_trigger_source,
    p_severity,
    p_intervention_level,
    p_action_type,
    COALESCE(p_action_payload, '{}'::jsonb),
    auth.uid(),
    p_created_by_type
  )
  ON CONFLICT (student_user_id, trigger_type, action_type, status)
  DO UPDATE SET
    class_id = COALESCE(EXCLUDED.class_id, public.interventions.class_id),
    roadmap_id = COALESCE(EXCLUDED.roadmap_id, public.interventions.roadmap_id),
    trigger_source = COALESCE(EXCLUDED.trigger_source, public.interventions.trigger_source),
    severity = EXCLUDED.severity,
    intervention_level = EXCLUDED.intervention_level,
    action_payload = EXCLUDED.action_payload,
    created_at = NOW(),
    outcome = NULL,
    outcome_metric = '{}'::jsonb
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_intervention(
  p_intervention_id UUID,
  p_status TEXT,
  p_outcome TEXT DEFAULT NULL,
  p_outcome_metric JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.interventions
  SET
    status = p_status,
    outcome = p_outcome,
    outcome_metric = COALESCE(p_outcome_metric, '{}'::jsonb),
    resolved_at = NOW()
  WHERE id = p_intervention_id
    AND p_status IN ('resolved', 'failed', 'dismissed');
END;
$$;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Verify migration syntax locally**

Run:

```bash
npx supabase db diff --local
```

Expected: the CLI either prints a diff or reports local Supabase is not running. If local Supabase is not running, run the SQL through the project SQL editor before deploying.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260429110000_create_interventions.sql
git commit -m "feat: add intervention records"
```

## Task 2: Pure Intervention Rule Engine

**Files:**
- Create: `src/lib/interventionRules.ts`
- Create: `src/lib/interventionRules.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/interventionRules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx tsx src/lib/interventionRules.test.ts
```

Expected: FAIL with `Cannot find module './interventionRules'`.

- [ ] **Step 3: Implement the rule engine**

Create `src/lib/interventionRules.ts`:

```ts
export type RiskLevel = 'low' | 'medium' | 'high';

export type TriggerType =
  | 'missed_mission'
  | 'subject_avoidance'
  | 'shrinking_sessions'
  | 'backlog_growth'
  | 'test_avoidance'
  | 'correction_sprint_stalled'
  | 'attendance_risk'
  | 'proof_pending';

export type ActionType =
  | 'compress_plan'
  | 'rescue_block'
  | 'proof_required'
  | 'correction_sprint_priority'
  | 'teacher_review'
  | 'parent_summary';

export interface InterventionSignalInput {
  studentUserId: string;
  classId?: string | null;
  roadmapId?: string | null;
  missedMissionDays: number;
  backlogCount: number;
  previousBacklogCount: number;
  avoidedSubjects: string[];
  shrinkingSession: boolean;
  correctionSprintStalled: boolean;
  attendanceRiskLevel: RiskLevel;
  unresolvedLevel3Count: number;
}

export interface InterventionRecommendation {
  studentUserId: string;
  classId: string | null;
  roadmapId: string | null;
  triggerType: TriggerType;
  triggerSource: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  interventionLevel: 1 | 2 | 3 | 4;
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
}

export function chooseIntervention(input: InterventionSignalInput): InterventionRecommendation | null {
  const base = {
    studentUserId: input.studentUserId,
    classId: input.classId ?? null,
    roadmapId: input.roadmapId ?? null,
  };

  if (input.attendanceRiskLevel === 'high' && input.unresolvedLevel3Count >= 2) {
    return {
      ...base,
      triggerType: 'attendance_risk',
      triggerSource: 'student_behavioral_profiles.attendance_risk_level',
      severity: 'critical',
      interventionLevel: 4,
      actionType: 'teacher_review',
      actionPayload: {
        message: 'Repeated execution risk and attendance risk require human review.',
      },
    };
  }

  if (input.correctionSprintStalled) {
    return {
      ...base,
      triggerType: 'correction_sprint_stalled',
      triggerSource: 'correction_sprints.status',
      severity: 'high',
      interventionLevel: 3,
      actionType: 'proof_required',
      actionPayload: {
        proof_type: 'correction_sprint_work',
        message: 'Upload correction work or complete a Prove-It attempt before marking this repaired.',
      },
    };
  }

  if (input.avoidedSubjects.length > 0 && input.missedMissionDays >= 2) {
    return {
      ...base,
      triggerType: 'subject_avoidance',
      triggerSource: 'task_completions_v2.subject',
      severity: 'medium',
      interventionLevel: 2,
      actionType: 'rescue_block',
      actionPayload: {
        subject: input.avoidedSubjects[0],
        duration_min: 20,
        proof_required: true,
        message: `Do a 20-minute rescue block for ${input.avoidedSubjects[0]}.`,
      },
    };
  }

  if (input.backlogCount >= input.previousBacklogCount + 3 && input.backlogCount > 0) {
    return {
      ...base,
      triggerType: 'backlog_growth',
      triggerSource: 'student_behavioral_profiles.backlog_count',
      severity: input.backlogCount >= 10 ? 'high' : 'medium',
      interventionLevel: 2,
      actionType: 'rescue_block',
      actionPayload: {
        duration_min: 25,
        proof_required: true,
        message: 'Clear the oldest pending task first. Stop after one clean proof submission.',
      },
    };
  }

  if (input.shrinkingSession) {
    return {
      ...base,
      triggerType: 'shrinking_sessions',
      triggerSource: 'session_signals.elapsed_sec',
      severity: 'low',
      interventionLevel: 1,
      actionType: 'compress_plan',
      actionPayload: {
        mode: 'low',
        message: 'Tomorrow starts with the minimum required mission to rebuild momentum.',
      },
    };
  }

  if (input.missedMissionDays >= 1) {
    return {
      ...base,
      triggerType: 'missed_mission',
      triggerSource: 'task_completions_v2.scheduled_date',
      severity: 'low',
      interventionLevel: 1,
      actionType: 'compress_plan',
      actionPayload: {
        mode: 'low',
        message: 'You missed yesterday, so today is compressed to the minimum required mission.',
      },
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
npx tsx src/lib/interventionRules.test.ts
```

Expected: PASS and prints `interventionRules tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/interventionRules.ts src/lib/interventionRules.test.ts
git commit -m "feat: add intervention rule engine"
```

## Task 3: Edge Function For Batch Intervention Refresh

**Files:**
- Create: `supabase/functions/refresh-class-interventions/index.ts`

- [ ] **Step 1: Write function scaffold**

Create `supabase/functions/refresh-class-interventions/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCors } from '../_shared/cors.ts';

type RiskLevel = 'low' | 'medium' | 'high';

function chooseAction(profile: any, completions: any[], sprints: any[]) {
  const missedMissionDays = Number(profile?.missed_days_streak || 0);
  const backlogCount = Number(profile?.backlog_count || 0);
  const attendanceRiskLevel = (profile?.attendance_risk_level || 'low') as RiskLevel;
  const correctionSprintStalled = sprints.some((s: any) => {
    const tasks = Array.isArray(s.sprint_tasks) ? s.sprint_tasks : [];
    return tasks.length > 0 && tasks.every((t: any) => !t.completed);
  });

  const subjectsCompleted = new Set(completions.map((c: any) => c.subject).filter(Boolean));
  const weakSubjects = Array.isArray(profile?.weak_subjects) ? profile.weak_subjects : [];
  const avoidedSubjects = weakSubjects.filter((subject: string) => !subjectsCompleted.has(subject));

  if (attendanceRiskLevel === 'high' && missedMissionDays >= 3) {
    return {
      trigger_type: 'attendance_risk',
      trigger_source: 'student_behavioral_profiles',
      severity: 'critical',
      intervention_level: 4,
      action_type: 'teacher_review',
      action_payload: { message: 'High attendance risk and repeated missed missions need teacher review.' },
    };
  }

  if (correctionSprintStalled) {
    return {
      trigger_type: 'correction_sprint_stalled',
      trigger_source: 'correction_sprints',
      severity: 'high',
      intervention_level: 3,
      action_type: 'proof_required',
      action_payload: { proof_type: 'correction_sprint_work', message: 'Correction sprint has not started.' },
    };
  }

  if (avoidedSubjects.length > 0 && missedMissionDays >= 2) {
    return {
      trigger_type: 'subject_avoidance',
      trigger_source: 'task_completions_v2',
      severity: 'medium',
      intervention_level: 2,
      action_type: 'rescue_block',
      action_payload: { subject: avoidedSubjects[0], duration_min: 20, proof_required: true },
    };
  }

  if (backlogCount >= 5) {
    return {
      trigger_type: 'backlog_growth',
      trigger_source: 'student_behavioral_profiles',
      severity: backlogCount >= 10 ? 'high' : 'medium',
      intervention_level: 2,
      action_type: 'rescue_block',
      action_payload: { duration_min: 25, proof_required: true },
    };
  }

  if (missedMissionDays >= 1) {
    return {
      trigger_type: 'missed_mission',
      trigger_source: 'task_completions_v2',
      severity: 'low',
      intervention_level: 1,
      action_type: 'compress_plan',
      action_payload: { mode: 'low' },
    };
  }

  return null;
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { class_id } = await req.json().catch(() => ({}));
    if (!class_id) throw new Error('class_id required');

    const { data: classRow, error: classErr } = await sb
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .single();
    if (classErr || !classRow) throw new Error('Class not found');

    const { data: members, error: memberErr } = await sb
      .from('class_members')
      .select('user_id, student_id')
      .eq('class_id', class_id);
    if (memberErr) throw memberErr;

    const studentIds = (members || [])
      .map((m: any) => m.user_id || m.student_id)
      .filter(Boolean);

    let created = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const studentId of studentIds) {
      await sb.rpc('refresh_behavioral_profile', { p_user_id: studentId });

      const [{ data: profile }, { data: roadmap }, { data: completions }, { data: sprints }] = await Promise.all([
        sb.from('student_behavioral_profiles').select('*').eq('user_id', studentId).maybeSingle(),
        sb.from('student_roadmaps').select('id').eq('user_id', studentId).eq('is_active', true).maybeSingle(),
        sb.from('task_completions_v2').select('*').eq('user_id', studentId).gte('scheduled_date', today),
        sb.from('correction_sprints').select('*').eq('user_id', studentId).eq('status', 'active'),
      ]);

      const action = chooseAction(profile, completions || [], sprints || []);
      if (!action) continue;

      const { error } = await sb.rpc('upsert_intervention', {
        p_student_user_id: studentId,
        p_class_id: class_id,
        p_roadmap_id: roadmap?.id || null,
        p_trigger_type: action.trigger_type,
        p_trigger_source: action.trigger_source,
        p_severity: action.severity,
        p_intervention_level: action.intervention_level,
        p_action_type: action.action_type,
        p_action_payload: action.action_payload,
        p_created_by_type: 'system',
      });
      if (!error) created += 1;
    }

    return new Response(JSON.stringify({ success: true, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Verify TypeScript shape**

Run:

```bash
npx supabase functions serve refresh-class-interventions --no-verify-jwt
```

Expected: function starts without TypeScript parse errors. Stop the function with `Ctrl+C` after it starts.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/refresh-class-interventions/index.ts
git commit -m "feat: refresh class interventions"
```

## Task 4: Mission Variants And Active Intervention Context

**Files:**
- Modify: `supabase/functions/plan-daily-mission/index.ts`
- Modify: `src/lib/dailyBriefing.ts`

- [ ] **Step 1: Extend frontend types**

In `src/lib/dailyBriefing.ts`, extend `TodayTask`:

```ts
export interface MissionVariant {
  mode: 'low' | 'normal' | 'beast';
  label: string;
  durationMin: number;
  taskLimit?: number;
  description: string;
}

export interface ActiveIntervention {
  id: string;
  triggerType: string;
  severity: string;
  interventionLevel: number;
  actionType: string;
  actionPayload: Record<string, any>;
}
```

Add these fields to `TodayTask`:

```ts
  whyToday?: string;
  proofRequired?: boolean;
  interventionId?: string | null;
  missionVariants?: MissionVariant[];
  activeIntervention?: ActiveIntervention | null;
```

- [ ] **Step 2: Fetch active interventions in daily briefing**

Inside `fetchDailyBriefing`, after the roadmap/prescription data has been loaded, add:

```ts
  const activeInterventions = await safeQuery(
    supabase
      .from('interventions')
      .select('id, trigger_type, severity, intervention_level, action_type, action_payload')
      .eq('student_user_id', userId)
      .eq('status', 'active')
      .order('intervention_level', { ascending: false })
      .order('created_at', { ascending: false }),
    []
  );
  const primaryIntervention = (activeInterventions as any[])[0] || null;
```

When mapping prescription tasks into `TodayTask`, add:

```ts
        whyToday: task.why_today || task.whyToday || task.details || task.description,
        proofRequired: Boolean(task.proof_required || primaryIntervention?.action_payload?.proof_required),
        interventionId: primaryIntervention?.id || null,
        activeIntervention: primaryIntervention
          ? {
              id: primaryIntervention.id,
              triggerType: primaryIntervention.trigger_type,
              severity: primaryIntervention.severity,
              interventionLevel: primaryIntervention.intervention_level,
              actionType: primaryIntervention.action_type,
              actionPayload: primaryIntervention.action_payload || {},
            }
          : null,
        missionVariants: task.mission_variants || task.missionVariants || [],
```

- [ ] **Step 3: Emit variants from planner**

In `supabase/functions/plan-daily-mission/index.ts`, after `tasks` are built and before `const totalMin`, fetch interventions:

```ts
    const { data: activeInterventions } = await sb
      .from('interventions')
      .select('id, intervention_level, action_type, action_payload, trigger_type, severity')
      .eq('student_user_id', user.id)
      .eq('status', 'active')
      .order('intervention_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    const activeIntervention = (activeInterventions || [])[0] || null;
```

Then map tasks:

```ts
    tasks = tasks.map((task: any) => {
      const duration = Number(task.duration_min || task.estimated_minutes || 30);
      const lowDuration = Math.max(12, Math.round(duration * 0.45));
      const normalDuration = duration;
      const beastDuration = Math.round(duration * 1.45);
      const proofRequired = Boolean(activeIntervention?.action_payload?.proof_required);
      return {
        ...task,
        proof_required: proofRequired,
        intervention_id: activeIntervention?.id || null,
        why_today: [
          activeIntervention ? `Intervention: ${activeIntervention.trigger_type.replaceAll('_', ' ')}.` : null,
          task.details || task.description || `${task.subject || 'Study'} is next in your roadmap.`,
        ].filter(Boolean).join(' '),
        mission_variants: [
          {
            mode: 'low',
            label: 'Low energy',
            durationMin: lowDuration,
            taskLimit: 1,
            description: 'Do the smallest version that keeps the chain alive.',
          },
          {
            mode: 'normal',
            label: 'Normal',
            durationMin: normalDuration,
            description: 'Do the mission exactly as prescribed.',
          },
          {
            mode: 'beast',
            label: 'Beast mode',
            durationMin: beastDuration,
            description: 'Add one extra retrieval check or timed mini-set after completion.',
          },
        ],
      };
    });
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/plan-daily-mission/index.ts src/lib/dailyBriefing.ts
git commit -m "feat: add mission variants and intervention context"
```

## Task 5: Student Mission UI For Variants And Proof

**Files:**
- Modify: `src/components/DailyBriefing/TaskDashboard.tsx`
- Modify: `src/components/DailyBriefing/TaskFocusView.tsx`

- [ ] **Step 1: Add variant display in `TaskDashboard`**

In the expanded task content, below the reason text, render:

```tsx
{task.missionVariants && task.missionVariants.length > 0 && (
  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
    {task.missionVariants.map((variant) => (
      <div
        key={variant.mode}
        className={`rounded-xl border p-3 ${
          variant.mode === 'normal'
            ? 'bg-[#F5F0E8] border-[#8B7355]/20'
            : 'bg-white border-[#E8E2D9]'
        }`}
      >
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#8A8279]">
          {variant.label}
        </div>
        <div className="mt-1 text-sm font-bold text-[#2D2A26]">
          {variant.durationMin} min
        </div>
        <p className="mt-1 text-xs text-[#8A8279] leading-relaxed">
          {variant.description}
        </p>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Show proof-required state**

In `TaskDashboard`, near the task title/metadata, add:

```tsx
{task.proofRequired && (
  <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-bold text-amber-700">
    <Upload className="w-3.5 h-3.5" />
    Proof required before this task counts as repaired.
  </div>
)}
```

- [ ] **Step 3: Block silent completion when proof is required**

At the start of `handleToggleTask`, after `if (task.completed) return;`, add:

```ts
    if (task.proofRequired && !task.outputSubmitted) {
      setUploadingTask(index);
      showToast('Upload proof first so Ranjan Sir can count this repair properly.', 'info');
      return;
    }
```

- [ ] **Step 4: Add proof reminder in `TaskFocusView`**

In the preflight phase, below the instructions card, add:

```tsx
{task.proofRequired && (
  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">
      Proof required
    </div>
    <p className="text-sm text-amber-800 leading-relaxed">
      This task is part of an intervention. Complete the focus run and submit the debrief so it can be counted as repaired.
    </p>
  </div>
)}
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/DailyBriefing/TaskDashboard.tsx src/components/DailyBriefing/TaskFocusView.tsx
git commit -m "feat: show mission variants and proof requirements"
```

## Task 6: Class Metrics And Risk Queue Data Helper

**Files:**
- Create: `src/lib/classExecutionMetrics.ts`

- [ ] **Step 1: Create data helper**

Create `src/lib/classExecutionMetrics.ts`:

```ts
import { supabase } from './supabase';

export interface ClassRiskQueueItem {
  id: string;
  studentUserId: string;
  studentName: string;
  triggerType: string;
  severity: string;
  interventionLevel: number;
  actionType: string;
  actionPayload: Record<string, any>;
  createdAt: string;
  backlogCount: number;
  missedDaysStreak: number;
}

export interface ClassExecutionMetrics {
  missionCompletionRate: number;
  completedTasks: number;
  totalTasks: number;
  backlogCount: number;
  unresolvedRiskCount: number;
  teacherActionsSaved: number;
  correctionSprintActiveCount: number;
  riskQueue: ClassRiskQueueItem[];
}

export async function fetchClassExecutionMetrics(classId: string): Promise<ClassExecutionMetrics> {
  const { data: members } = await supabase
    .from('class_members')
    .select('user_id, student_id')
    .eq('class_id', classId);

  const studentIds = (members || [])
    .map((member: any) => member.user_id || member.student_id)
    .filter(Boolean);

  if (studentIds.length === 0) {
    return {
      missionCompletionRate: 0,
      completedTasks: 0,
      totalTasks: 0,
      backlogCount: 0,
      unresolvedRiskCount: 0,
      teacherActionsSaved: 0,
      correctionSprintActiveCount: 0,
      riskQueue: [],
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const [profilesRes, prescriptionsRes, completionsRes, interventionsRes, sprintRes, userRes] = await Promise.all([
    supabase.from('student_behavioral_profiles').select('*').in('user_id', studentIds),
    supabase.from('daily_prescriptions').select('id, user_id, tasks').in('user_id', studentIds).eq('prescription_date', today),
    supabase.from('task_completions_v2').select('*').in('user_id', studentIds).eq('scheduled_date', today),
    supabase.from('interventions').select('*').eq('class_id', classId).eq('status', 'active').order('intervention_level', { ascending: false }),
    supabase.from('correction_sprints').select('id, user_id').in('user_id', studentIds).eq('status', 'active'),
    supabase.from('user_profiles').select('id, full_name, email').in('id', studentIds),
  ]);

  const prescriptions = prescriptionsRes.data || [];
  const completions = completionsRes.data || [];
  const profiles = profilesRes.data || [];
  const interventions = interventionsRes.data || [];
  const activeSprints = sprintRes.data || [];
  const userMap = new Map((userRes.data || []).map((user: any) => [user.id, user]));
  const profileMap = new Map(profiles.map((profile: any) => [profile.user_id, profile]));

  const totalTasks = prescriptions.reduce((sum: number, row: any) => {
    const tasks = Array.isArray(row.tasks) ? row.tasks : [];
    return sum + tasks.length;
  }, 0);

  const completedTasks = completions.length;
  const missionCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const backlogCount = profiles.reduce((sum: number, profile: any) => sum + Number(profile.backlog_count || 0), 0);

  const riskQueue: ClassRiskQueueItem[] = interventions.map((row: any) => {
    const profile = profileMap.get(row.student_user_id) || {};
    const user = userMap.get(row.student_user_id) || {};
    return {
      id: row.id,
      studentUserId: row.student_user_id,
      studentName: user.full_name || user.email || 'Student',
      triggerType: row.trigger_type,
      severity: row.severity,
      interventionLevel: row.intervention_level,
      actionType: row.action_type,
      actionPayload: row.action_payload || {},
      createdAt: row.created_at,
      backlogCount: Number(profile.backlog_count || 0),
      missedDaysStreak: Number(profile.missed_days_streak || 0),
    };
  });

  return {
    missionCompletionRate,
    completedTasks,
    totalTasks,
    backlogCount,
    unresolvedRiskCount: interventions.length,
    teacherActionsSaved: interventions.filter((row: any) => row.created_by_type === 'system').length,
    correctionSprintActiveCount: activeSprints.length,
    riskQueue,
  };
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/classExecutionMetrics.ts
git commit -m "feat: add class execution metrics helper"
```

## Task 7: Teacher Dashboard Control Room

**Files:**
- Modify: `src/pages/TeacherClassDashboard.tsx`

- [ ] **Step 1: Import helper and icons**

Add:

```ts
import { fetchClassExecutionMetrics, type ClassExecutionMetrics } from '../lib/classExecutionMetrics';
```

Ensure these icons are imported from `lucide-react`:

```ts
ShieldCheck, Gauge, ClipboardCheck
```

- [ ] **Step 2: Add state and loader**

Inside the component state section:

```ts
  const [executionMetrics, setExecutionMetrics] = useState<ClassExecutionMetrics | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
```

Add loader:

```ts
  const loadExecutionMetrics = async () => {
    if (!id) return;
    setExecutionLoading(true);
    try {
      const metrics = await fetchClassExecutionMetrics(id);
      setExecutionMetrics(metrics);
    } finally {
      setExecutionLoading(false);
    }
  };

  useEffect(() => {
    if (id && tab === 'Daily Teaching Loop') {
      loadExecutionMetrics();
    }
  }, [id, tab]);
```

- [ ] **Step 3: Refresh interventions after class log**

At the end of the successful class session logging handler, add:

```ts
      await supabase.functions.invoke('refresh-class-interventions', {
        body: { class_id: id },
      });
      await loadExecutionMetrics();
```

- [ ] **Step 4: Render metric cards**

At the top of the Daily Teaching Loop tab content, add:

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-4">
    <ClipboardCheck className="h-5 w-5 text-emerald-600 mb-2" />
    <p className="text-xs font-bold text-[#8A8279] uppercase">Mission completion</p>
    <p className="text-2xl font-bold text-[#2D2A26]">
      {executionMetrics?.missionCompletionRate ?? 0}%
    </p>
    <p className="text-xs text-[#8A8279]">
      {executionMetrics?.completedTasks ?? 0}/{executionMetrics?.totalTasks ?? 0} tasks today
    </p>
  </div>
  <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-4">
    <Target className="h-5 w-5 text-[#00D1FF] mb-2" />
    <p className="text-xs font-bold text-[#8A8279] uppercase">Backlog health</p>
    <p className="text-2xl font-bold text-[#2D2A26]">
      {executionMetrics?.backlogCount ?? 0}
    </p>
    <p className="text-xs text-[#8A8279]">pending items across class</p>
  </div>
  <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-4">
    <ShieldCheck className="h-5 w-5 text-amber-600 mb-2" />
    <p className="text-xs font-bold text-[#8A8279] uppercase">Risk queue</p>
    <p className="text-2xl font-bold text-[#2D2A26]">
      {executionMetrics?.unresolvedRiskCount ?? 0}
    </p>
    <p className="text-xs text-[#8A8279]">active interventions</p>
  </div>
  <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-4">
    <Gauge className="h-5 w-5 text-indigo-600 mb-2" />
    <p className="text-xs font-bold text-[#8A8279] uppercase">Actions saved</p>
    <p className="text-2xl font-bold text-[#2D2A26]">
      {executionMetrics?.teacherActionsSaved ?? 0}
    </p>
    <p className="text-xs text-[#8A8279]">automated mentor actions</p>
  </div>
</div>
```

- [ ] **Step 5: Render risk queue**

Below the class log card, add:

```tsx
<div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-6 shadow-sm">
  <div className="flex items-center justify-between gap-4 mb-4">
    <div>
      <h3 className="text-lg font-bold text-[#2D2A26]">Mentor Risk Queue</h3>
      <p className="text-sm text-[#8A8279]">Automated interventions already taken, plus cases needing human review.</p>
    </div>
    <button
      onClick={loadExecutionMetrics}
      disabled={executionLoading}
      className="px-4 py-2 rounded-xl bg-[#2D2A26] text-white text-xs font-bold disabled:opacity-60"
    >
      Refresh
    </button>
  </div>

  {executionMetrics?.riskQueue.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[#8A8279] border-b border-[#E8E4DF]">
            <th className="py-3 pr-4">Student</th>
            <th className="py-3 pr-4">Trigger</th>
            <th className="py-3 pr-4">Level</th>
            <th className="py-3 pr-4">Action taken</th>
            <th className="py-3 pr-4">Backlog</th>
            <th className="py-3 pr-4">Missed days</th>
          </tr>
        </thead>
        <tbody>
          {executionMetrics.riskQueue.map((item) => (
            <tr key={item.id} className="border-b border-[#F1ECE6]">
              <td className="py-3 pr-4 font-bold text-[#2D2A26]">{item.studentName}</td>
              <td className="py-3 pr-4 text-[#8A8279]">{item.triggerType.replaceAll('_', ' ')}</td>
              <td className="py-3 pr-4">
                <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-xs font-bold">
                  L{item.interventionLevel} · {item.severity}
                </span>
              </td>
              <td className="py-3 pr-4 text-[#2D2A26]">
                {item.actionType.replaceAll('_', ' ')}
              </td>
              <td className="py-3 pr-4">{item.backlogCount}</td>
              <td className="py-3 pr-4">{item.missedDaysStreak}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="rounded-2xl bg-[#F8FAF9] border border-[#E8E4DF] p-6 text-center">
      <p className="text-sm font-bold text-[#2D2A26]">No active risk items.</p>
      <p className="text-xs text-[#8A8279] mt-1">Ranjan Sir will add students here when execution drift appears.</p>
    </div>
  )}
</div>
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/pages/TeacherClassDashboard.tsx
git commit -m "feat: add execution control room to teacher dashboard"
```

## Task 8: Resolve Interventions On Completion

**Files:**
- Modify: `src/lib/dailyBriefing.ts`

- [ ] **Step 1: Resolve intervention after successful proof/completion**

Inside `markTaskCompleted`, after `if (!success) return ...` and before XP award, add:

```ts
    if (options?.notes?.includes('AI analysis') || options?.notes?.includes('proof')) {
      try {
        const { data: active } = await supabase
          .from('interventions')
          .select('id')
          .eq('student_user_id', userId)
          .eq('status', 'active')
          .in('action_type', ['proof_required', 'rescue_block', 'compress_plan'])
          .order('intervention_level', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (active?.id) {
          await supabase.rpc('resolve_intervention', {
            p_intervention_id: active.id,
            p_status: 'resolved',
            p_outcome: 'Task completed with proof or debrief.',
            p_outcome_metric: {
              source_type: sourceType,
              source_id: sourceId,
              task_order: taskOrder,
              completed_at: new Date().toISOString(),
            },
          });
        }
      } catch {
        // Intervention resolution is best-effort; completion remains source of truth.
      }
    }
```

- [ ] **Step 2: Pass proof note from upload success**

In `TaskDashboard.handleUploadSuccess`, when calling `markTaskCompleted`, pass:

```ts
{ taskTitle: task.title, subject: task.subject, notes: 'proof uploaded' }
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dailyBriefing.ts src/components/DailyBriefing/TaskDashboard.tsx
git commit -m "feat: resolve interventions from proof completion"
```

## Task 9: Final Verification And Demo Notes

**Files:**
- Modify: `docs/superpowers/plans/2026-04-29-ranjan-sir-execution-control-room.md` only if implementation discoveries require plan corrections.

- [ ] **Step 1: Run intervention rule tests**

Run:

```bash
npx tsx src/lib/interventionRules.test.ts
```

Expected: PASS and prints `interventionRules tests passed`.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds without TypeScript or Vite errors.

- [ ] **Step 3: Start local app**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a localhost URL.

- [ ] **Step 4: Manual smoke test**

In the browser:

- Visit the teacher class dashboard.
- Open Daily Teaching Loop.
- Confirm metric cards render.
- Log a class session.
- Click Refresh in Mentor Risk Queue.
- Confirm empty and active-risk states both render without crashing.
- Visit the student daily briefing.
- Confirm tasks show the reason and mission variants.
- Confirm proof-required tasks prompt for upload instead of silent completion.

- [ ] **Step 5: Commit verification notes if code changed during smoke test**

```bash
git status --short
git add src/pages/TeacherClassDashboard.tsx src/components/DailyBriefing/TaskDashboard.tsx src/components/DailyBriefing/TaskFocusView.tsx src/lib/dailyBriefing.ts src/lib/classExecutionMetrics.ts src/lib/interventionRules.ts src/lib/interventionRules.test.ts supabase/functions/plan-daily-mission/index.ts supabase/functions/refresh-class-interventions/index.ts supabase/migrations/20260429110000_create_interventions.sql
git commit -m "fix: polish execution control room verification"
```

Expected: skip this commit if no files changed during smoke testing.
