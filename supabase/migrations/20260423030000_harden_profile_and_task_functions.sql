-- ============================================
-- Harden profile & task-completion functions
-- Makes them resilient when auxiliary tables
-- (user_subject_mastery, class_members, etc.)
-- are missing or the unique index on
-- task_completions_v2 is not yet applied.
-- ============================================

-- Ensure the unique index exists (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_completions_v2_unique_task
  ON public.task_completions_v2(user_id, source_type, source_id, task_order, scheduled_date);
-- Drop old signatures safely in case they differ
DROP FUNCTION IF EXISTS public.refresh_behavioral_profile(UUID);
CREATE OR REPLACE FUNCTION public.refresh_behavioral_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.student_behavioral_profiles%ROWTYPE;
  v_avg_duration INTEGER;
  v_weak_subjects TEXT[] := ARRAY[]::TEXT[];
  v_backlog_count INTEGER := 0;
  v_missed_days_streak INTEGER := 0;
  v_probe_date DATE := CURRENT_DATE - 1;
  v_had_activity BOOLEAN;
BEGIN
  -- 1. Read existing profile (no error if none)
  BEGIN
    SELECT *
    INTO v_existing
    FROM public.student_behavioral_profiles
    WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_existing := NULL;
  END;

  -- 2. Average duration from completions (safe if table missing)
  BEGIN
    SELECT ROUND(AVG(actual_duration_min))::INTEGER
    INTO v_avg_duration
    FROM public.task_completions_v2
    WHERE user_id = p_user_id
      AND actual_duration_min IS NOT NULL
      AND actual_duration_min > 0
      AND created_at >= NOW() - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN
    v_avg_duration := NULL;
  END;

  -- 3. Weak subjects (safe if user_subject_mastery missing)
  BEGIN
    SELECT COALESCE(array_agg(subject), ARRAY[]::TEXT[])
    INTO v_weak_subjects
    FROM (
      SELECT DISTINCT subject
      FROM public.user_subject_mastery
      WHERE user_id = p_user_id
        AND subject IS NOT NULL
        AND mastery_score < 60
      ORDER BY subject
      LIMIT 5
    ) weak_subjects;
  EXCEPTION WHEN OTHERS THEN
    v_weak_subjects := ARRAY[]::TEXT[];
  END;

  -- 4. Backlog count (safe if assignments/class_members missing)
  BEGIN
    SELECT
      COALESCE((
        SELECT COUNT(*)
        FROM public.assignments a
        JOIN public.class_members cm ON cm.class_id = a.class_id
        WHERE cm.user_id = p_user_id
          AND a.due_date IS NOT NULL
          AND a.due_date::DATE < CURRENT_DATE
          AND NOT EXISTS (
            SELECT 1
            FROM public.task_completions_v2 tc
            WHERE tc.user_id = p_user_id
              AND tc.source_type = 'assignment'
              AND tc.source_id = a.id::TEXT
          )
      ), 0)
      +
      COALESCE((
        SELECT COUNT(*)
        FROM public.daily_prescriptions dp,
             LATERAL jsonb_array_elements(COALESCE(dp.tasks, '[]'::jsonb)) WITH ORDINALITY AS task(item, ord)
        WHERE dp.user_id = p_user_id
          AND dp.prescription_date <= CURRENT_DATE
          AND COALESCE((task.item->>'completed')::BOOLEAN, FALSE) = FALSE
          AND NOT EXISTS (
            SELECT 1
            FROM public.task_completions_v2 tc
            WHERE tc.user_id = p_user_id
              AND tc.source_type = 'prescription'
              AND tc.source_id = dp.id::TEXT
              AND tc.task_order = COALESCE((task.item->>'order')::INTEGER, task.ord - 1)
              AND tc.scheduled_date = dp.prescription_date
          )
      ), 0)
    INTO v_backlog_count;
  EXCEPTION WHEN OTHERS THEN
    v_backlog_count := 0;
  END;

  -- 5. Missed-days streak (safe if task_completions_v2 missing)
  BEGIN
    WHILE v_probe_date >= CURRENT_DATE - 14 LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.task_completions_v2
        WHERE user_id = p_user_id
          AND scheduled_date = v_probe_date
      )
      INTO v_had_activity;

      EXIT WHEN v_had_activity;
      v_missed_days_streak := v_missed_days_streak + 1;
      v_probe_date := v_probe_date - 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    v_missed_days_streak := 0;
  END;

  -- 6. Upsert profile row (guaranteed to work because we control the table)
  INSERT INTO public.student_behavioral_profiles (
    user_id,
    preferred_time,
    typical_session_duration_min,
    weak_subjects,
    strong_subjects,
    stress_signals,
    backlog_count,
    missed_days_streak,
    typical_slump_day,
    response_to_low_score,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(v_existing.preferred_time, 'evening'),
    COALESCE(v_avg_duration, v_existing.typical_session_duration_min, 90),
    COALESCE(v_weak_subjects, v_existing.weak_subjects, ARRAY[]::TEXT[]),
    COALESCE(v_existing.strong_subjects, ARRAY[]::TEXT[]),
    COALESCE(v_existing.stress_signals, '{}'::jsonb),
    COALESCE(v_backlog_count, 0),
    COALESCE(v_missed_days_streak, 0),
    v_existing.typical_slump_day,
    v_existing.response_to_low_score,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    typical_session_duration_min = EXCLUDED.typical_session_duration_min,
    weak_subjects = EXCLUDED.weak_subjects,
    backlog_count = EXCLUDED.backlog_count,
    missed_days_streak = EXCLUDED.missed_days_streak,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'backlog_count', v_backlog_count,
    'missed_days_streak', v_missed_days_streak,
    'weak_subjects', COALESCE(v_weak_subjects, ARRAY[]::TEXT[]),
    'typical_session_duration_min', COALESCE(v_avg_duration, v_existing.typical_session_duration_min, 90)
  );
END;
$$;
-- ============================================
-- Harden mark_prescription_task_complete:
--   - Safe fallback if unique index missing
--   - Wraps all auxiliary queries in exception blocks
-- ============================================
DROP FUNCTION IF EXISTS public.mark_prescription_task_complete(UUID, UUID, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.mark_prescription_task_complete(
  p_user_id UUID,
  p_prescription_id UUID,
  p_task_order INTEGER DEFAULT 0,
  p_actual_duration_min INTEGER DEFAULT NULL,
  p_engagement_score INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tasks JSONB := '[]'::jsonb;
  v_updated_tasks JSONB := '[]'::jsonb;
  v_task_count INTEGER := 0;
  v_completed_count INTEGER := 0;
BEGIN
  -- 1. Upsert completion row (fallback to plain insert if conflict clause fails)
  BEGIN
    INSERT INTO public.task_completions_v2 (
      user_id, source_type, source_id, task_order,
      scheduled_date, actual_duration_min, engagement_score
    )
    VALUES (
      p_user_id, 'prescription', p_prescription_id::TEXT,
      COALESCE(p_task_order, 0), CURRENT_DATE,
      p_actual_duration_min, p_engagement_score
    )
    ON CONFLICT (user_id, source_type, source_id, task_order, scheduled_date)
    DO UPDATE
    SET
      actual_duration_min = COALESCE(EXCLUDED.actual_duration_min, public.task_completions_v2.actual_duration_min),
      engagement_score = COALESCE(EXCLUDED.engagement_score, public.task_completions_v2.engagement_score),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- If unique constraint is missing, just insert (may create dupes, but at least lands)
    INSERT INTO public.task_completions_v2 (
      user_id, source_type, source_id, task_order,
      scheduled_date, actual_duration_min, engagement_score
    )
    VALUES (
      p_user_id, 'prescription', p_prescription_id::TEXT,
      COALESCE(p_task_order, 0), CURRENT_DATE,
      p_actual_duration_min, p_engagement_score
    );
  END;

  -- 2. Update prescription JSON safely
  BEGIN
    SELECT COALESCE(tasks, '[]'::jsonb)
    INTO v_tasks
    FROM public.daily_prescriptions
    WHERE id = p_prescription_id
      AND user_id = p_user_id;

    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE((task.item->>'order')::INTEGER, task.ord - 1) = COALESCE(p_task_order, 0)
          THEN jsonb_set(task.item, '{completed}', 'true'::jsonb, true)
        ELSE task.item
      END
      ORDER BY task.ord
    ), '[]'::jsonb)
    INTO v_updated_tasks
    FROM jsonb_array_elements(v_tasks) WITH ORDINALITY AS task(item, ord);

    SELECT COUNT(*) INTO v_task_count
    FROM jsonb_array_elements(v_updated_tasks);

    SELECT COUNT(*) INTO v_completed_count
    FROM jsonb_array_elements(v_updated_tasks) AS task(item)
    WHERE COALESCE((task.item->>'completed')::BOOLEAN, FALSE) = TRUE;

    UPDATE public.daily_prescriptions
    SET
      tasks = v_updated_tasks,
      status = CASE
        WHEN v_task_count > 0 AND v_completed_count = v_task_count THEN 'completed'
        ELSE status
      END
    WHERE id = p_prescription_id
      AND user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Prescription JSON sync is best-effort
  END;

  -- 3. Refresh behavioral profile (fire-and-forget)
  BEGIN
    PERFORM public.refresh_behavioral_profile(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'completed_tasks', v_completed_count,
    'total_tasks', v_task_count
  );
END;
$$;
-- ============================================
-- Harden mark_sprint_task_complete (same pattern)
-- ============================================
DROP FUNCTION IF EXISTS public.mark_sprint_task_complete(UUID, UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.mark_sprint_task_complete(
  p_user_id UUID,
  p_sprint_id UUID,
  p_task_order INTEGER DEFAULT 0,
  p_actual_duration_min INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tasks JSONB := '[]'::jsonb;
  v_updated_tasks JSONB := '[]'::jsonb;
  v_task_count INTEGER := 0;
  v_completed_count INTEGER := 0;
BEGIN
  BEGIN
    INSERT INTO public.task_completions_v2 (
      user_id, source_type, source_id, task_order,
      scheduled_date, actual_duration_min
    )
    VALUES (
      p_user_id, 'sprint', p_sprint_id::TEXT,
      COALESCE(p_task_order, 0), CURRENT_DATE,
      p_actual_duration_min
    )
    ON CONFLICT (user_id, source_type, source_id, task_order, scheduled_date)
    DO UPDATE
    SET
      actual_duration_min = COALESCE(EXCLUDED.actual_duration_min, public.task_completions_v2.actual_duration_min),
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.task_completions_v2 (
      user_id, source_type, source_id, task_order,
      scheduled_date, actual_duration_min
    )
    VALUES (
      p_user_id, 'sprint', p_sprint_id::TEXT,
      COALESCE(p_task_order, 0), CURRENT_DATE,
      p_actual_duration_min
    );
  END;

  BEGIN
    SELECT COALESCE(sprint_tasks, '[]'::jsonb)
    INTO v_tasks
    FROM public.correction_sprints
    WHERE id = p_sprint_id
      AND user_id = p_user_id;

    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE((task.item->>'order')::INTEGER, task.ord - 1) = COALESCE(p_task_order, 0)
          THEN jsonb_set(task.item, '{completed}', 'true'::jsonb, true)
        ELSE task.item
      END
      ORDER BY task.ord
    ), '[]'::jsonb)
    INTO v_updated_tasks
    FROM jsonb_array_elements(v_tasks) WITH ORDINALITY AS task(item, ord);

    SELECT COUNT(*) INTO v_task_count
    FROM jsonb_array_elements(v_updated_tasks);

    SELECT COUNT(*) INTO v_completed_count
    FROM jsonb_array_elements(v_updated_tasks) AS task(item)
    WHERE COALESCE((task.item->>'completed')::BOOLEAN, FALSE) = TRUE;

    UPDATE public.correction_sprints
    SET
      sprint_tasks = v_updated_tasks,
      status = CASE
        WHEN v_task_count > 0 AND v_completed_count = v_task_count THEN 'completed'
        ELSE status
      END,
      completed_at = CASE
        WHEN v_task_count > 0 AND v_completed_count = v_task_count THEN NOW()
        ELSE completed_at
      END
    WHERE id = p_sprint_id
      AND user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.refresh_behavioral_profile(p_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'completed_tasks', v_completed_count,
    'total_tasks', v_task_count
  );
END;
$$;
-- ============================================
-- Ensure user_knowledge has all columns the
-- frontend is writing, and backfill defaults.
-- ============================================
ALTER TABLE public.user_knowledge
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_type TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE public.user_knowledge
SET
  knowledge_type = COALESCE(knowledge_type, source_type),
  source = COALESCE(source, source_type),
  topic = COALESCE(topic, LEFT(content, 80)),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE knowledge_type IS NULL
   OR source IS NULL
   OR topic IS NULL
   OR updated_at IS NULL;
-- Ensure RLS allows users to insert/update their own knowledge
ALTER TABLE public.user_knowledge ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_knowledge'
      AND policyname = 'user_knowledge_insert_own'
  ) THEN
    CREATE POLICY user_knowledge_insert_own
      ON public.user_knowledge
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_knowledge'
      AND policyname = 'user_knowledge_update_own'
  ) THEN
    CREATE POLICY user_knowledge_update_own
      ON public.user_knowledge
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
