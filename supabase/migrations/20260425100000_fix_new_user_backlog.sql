-- Fix new-user phantom backlog and missed-days streak.
-- Caps both backlog and missed-days at auth.users.created_at so brand-new users
-- don't see imaginary 14 missed days or pre-signup pending tasks/assignments.

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
  v_user_created DATE;
  v_had_activity BOOLEAN;
BEGIN
  BEGIN
    SELECT *
    INTO v_existing
    FROM public.student_behavioral_profiles
    WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_existing := NULL;
  END;

  BEGIN
    SELECT created_at::DATE
    INTO v_user_created
    FROM auth.users
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_user_created := CURRENT_DATE;
  END;

  IF v_user_created IS NULL THEN
    v_user_created := CURRENT_DATE;
  END IF;

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

  -- Backlog: only count items whose due/scheduled date is AFTER the user signed up.
  BEGIN
    SELECT
      COALESCE((
        SELECT COUNT(*)
        FROM public.assignments a
        JOIN public.class_members cm ON cm.class_id = a.class_id
        WHERE cm.user_id = p_user_id
          AND a.due_date IS NOT NULL
          AND a.due_date::DATE < CURRENT_DATE
          AND a.due_date::DATE >= v_user_created
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
          AND dp.prescription_date >= v_user_created
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

  -- Missed-days streak: only look back to user creation date.
  BEGIN
    WHILE v_probe_date >= GREATEST(CURRENT_DATE - 14, v_user_created) LOOP
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
