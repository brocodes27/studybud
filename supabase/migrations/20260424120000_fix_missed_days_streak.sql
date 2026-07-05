-- Fix missed-days streak so it:
-- 1) Caps lookback at user creation date (new users don't immediately show 14 missed days)
-- 2) Also counts completed curriculum_tasks as activity

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
  v_earliest_date DATE;
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
  -- Cap at user creation so brand-new users don't show 14 missed days immediately
  BEGIN
    SELECT COALESCE(created_at::DATE, CURRENT_DATE - 14)
    INTO v_earliest_date
    FROM auth.users
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_earliest_date := CURRENT_DATE - 14;
  END;

  BEGIN
    WHILE v_probe_date >= GREATEST(CURRENT_DATE - 14, v_earliest_date) LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.task_completions_v2
        WHERE user_id = p_user_id
          AND scheduled_date = v_probe_date
      )
      OR EXISTS (
        SELECT 1
        FROM public.curriculum_tasks
        WHERE user_id = p_user_id
          AND task_date = v_probe_date
          AND status = 'completed'
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
