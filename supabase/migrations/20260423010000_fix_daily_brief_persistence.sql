-- ============================================
-- Daily Briefing Persistence Fixes
-- ============================================

-- Task completion source of truth used by the daily briefing UI.
CREATE TABLE IF NOT EXISTS public.task_completions_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('prescription', 'sprint', 'assignment', 'weak_area', 'plan_task')),
  source_id TEXT NOT NULL,
  task_order INTEGER NOT NULL DEFAULT 0,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_duration_min INTEGER,
  engagement_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_type, source_id, task_order, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_v2_user_date
  ON public.task_completions_v2(user_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_task_completions_v2_source
  ON public.task_completions_v2(source_type, source_id);

ALTER TABLE public.task_completions_v2 ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_completions_v2'
      AND policyname = 'task_completions_v2_select_own'
  ) THEN
    CREATE POLICY task_completions_v2_select_own
      ON public.task_completions_v2
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_completions_v2'
      AND policyname = 'task_completions_v2_insert_own'
  ) THEN
    CREATE POLICY task_completions_v2_insert_own
      ON public.task_completions_v2
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_completions_v2'
      AND policyname = 'task_completions_v2_update_own'
  ) THEN
    CREATE POLICY task_completions_v2_update_own
      ON public.task_completions_v2
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_completions_v2'
      AND policyname = 'task_completions_v2_delete_own'
  ) THEN
    CREATE POLICY task_completions_v2_delete_own
      ON public.task_completions_v2
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.task_outputs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_outputs'
      AND policyname = 'task_outputs_update_own'
  ) THEN
    CREATE POLICY task_outputs_update_own
      ON public.task_outputs
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.user_knowledge
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_type TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_knowledge_user_created_at
  ON public.user_knowledge(user_id, created_at DESC);

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

DROP FUNCTION IF EXISTS public.refresh_behavioral_profile(UUID);

CREATE FUNCTION public.refresh_behavioral_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing public.student_behavioral_profiles%ROWTYPE;
  v_avg_duration INTEGER;
  v_weak_subjects TEXT[];
  v_backlog_count INTEGER := 0;
  v_missed_days_streak INTEGER := 0;
  v_probe_date DATE := CURRENT_DATE - 1;
  v_had_activity BOOLEAN;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.student_behavioral_profiles
  WHERE user_id = p_user_id;

  SELECT ROUND(AVG(actual_duration_min))::INTEGER
  INTO v_avg_duration
  FROM public.task_completions_v2
  WHERE user_id = p_user_id
    AND actual_duration_min IS NOT NULL
    AND actual_duration_min > 0
    AND created_at >= NOW() - INTERVAL '30 days';

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

DROP FUNCTION IF EXISTS public.mark_prescription_task_complete(UUID, UUID, INTEGER, INTEGER, INTEGER);

CREATE FUNCTION public.mark_prescription_task_complete(
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
  INSERT INTO public.task_completions_v2 (
    user_id,
    source_type,
    source_id,
    task_order,
    scheduled_date,
    actual_duration_min,
    engagement_score
  )
  VALUES (
    p_user_id,
    'prescription',
    p_prescription_id::TEXT,
    COALESCE(p_task_order, 0),
    CURRENT_DATE,
    p_actual_duration_min,
    p_engagement_score
  )
  ON CONFLICT (user_id, source_type, source_id, task_order, scheduled_date)
  DO UPDATE
  SET
    actual_duration_min = COALESCE(EXCLUDED.actual_duration_min, public.task_completions_v2.actual_duration_min),
    engagement_score = COALESCE(EXCLUDED.engagement_score, public.task_completions_v2.engagement_score),
    updated_at = NOW();

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

  SELECT COUNT(*)
  INTO v_task_count
  FROM jsonb_array_elements(v_updated_tasks);

  SELECT COUNT(*)
  INTO v_completed_count
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

  PERFORM public.refresh_behavioral_profile(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'completed_tasks', v_completed_count,
    'total_tasks', v_task_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.mark_sprint_task_complete(UUID, UUID, INTEGER, INTEGER);

CREATE FUNCTION public.mark_sprint_task_complete(
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
  INSERT INTO public.task_completions_v2 (
    user_id,
    source_type,
    source_id,
    task_order,
    scheduled_date,
    actual_duration_min
  )
  VALUES (
    p_user_id,
    'sprint',
    p_sprint_id::TEXT,
    COALESCE(p_task_order, 0),
    CURRENT_DATE,
    p_actual_duration_min
  )
  ON CONFLICT (user_id, source_type, source_id, task_order, scheduled_date)
  DO UPDATE
  SET
    actual_duration_min = COALESCE(EXCLUDED.actual_duration_min, public.task_completions_v2.actual_duration_min),
    updated_at = NOW();

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

  SELECT COUNT(*)
  INTO v_task_count
  FROM jsonb_array_elements(v_updated_tasks);

  SELECT COUNT(*)
  INTO v_completed_count
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

  PERFORM public.refresh_behavioral_profile(p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'completed_tasks', v_completed_count,
    'total_tasks', v_task_count
  );
END;
$$;
