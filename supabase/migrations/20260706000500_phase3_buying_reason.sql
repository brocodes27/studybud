-- 1. Create AI Usage Logs Table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
    feature_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on AI Usage Logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view AI usage logs in their school" ON public.ai_usage_logs;
CREATE POLICY "Admins can view AI usage logs in their school" ON public.ai_usage_logs
    FOR SELECT TO authenticated
    USING (
        school_id = public.fn_my_school_id()
        AND public.fn_my_role() IN ('org_admin', 'principal')
    );

-- 2. Create RPC check_ai_budget
CREATE OR REPLACE FUNCTION public.check_ai_budget(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_plan TEXT;
  v_cost_limit NUMERIC(10, 2);
  v_current_cost NUMERIC(10, 4);
BEGIN
  -- Get user school
  SELECT school_id INTO v_school_id FROM public.user_profiles WHERE id = p_user_id;
  IF v_school_id IS NULL THEN
    RETURN TRUE; -- Free tier / B2C
  END IF;

  -- Get school entitlement plan
  SELECT plan INTO v_plan FROM public.school_entitlements WHERE school_id = v_school_id;
  IF v_plan IS NULL THEN
    RETURN FALSE; -- No active plan
  END IF;

  v_cost_limit := CASE 
    WHEN v_plan = 'pilot' THEN 10.00
    WHEN v_plan = 'basic' THEN 50.00
    WHEN v_plan = 'premium' THEN 200.00
    WHEN v_plan = 'enterprise' THEN 999999.00
    ELSE 0.00
  END;

  -- Sum cost of AI logs in the current month
  SELECT COALESCE(SUM(estimated_cost), 0) INTO v_current_cost
  FROM public.ai_usage_logs
  WHERE school_id = v_school_id
    AND created_at >= date_trunc('month', now());

  IF v_current_cost >= v_cost_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 3. Create RPC log_ai_usage
CREATE OR REPLACE FUNCTION public.log_ai_usage(
  p_user_id UUID,
  p_model TEXT,
  p_feature_name TEXT,
  p_prompt_len INTEGER,
  p_completion_len INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_prompt_tokens INTEGER;
  v_completion_tokens INTEGER;
  v_cost NUMERIC(10, 6);
  v_result JSONB;
BEGIN
  SELECT school_id INTO v_school_id FROM public.user_profiles WHERE id = p_user_id;

  -- Approximate token count
  v_prompt_tokens := COALESCE(p_prompt_len, 0) / 4;
  v_completion_tokens := COALESCE(p_completion_len, 0) / 4;

  -- Gemini 1.5 Flash Average Pricing:
  -- prompt: $0.15 / 1M tokens ($0.00000015 / token)
  -- completion: $0.60 / 1M tokens ($0.00000060 / token)
  v_cost := (v_prompt_tokens * 0.00000015) + (v_completion_tokens * 0.00000060);

  INSERT INTO public.ai_usage_logs (school_id, user_id, model, prompt_tokens, completion_tokens, estimated_cost, feature_name)
  VALUES (v_school_id, p_user_id, p_model, v_prompt_tokens, v_completion_tokens, v_cost, p_feature_name);

  SELECT jsonb_build_object('success', true, 'cost', v_cost) INTO v_result;
  RETURN v_result;
END;
$$;

-- 4. Create RPC to aggregate school outcomes
CREATE OR REPLACE FUNCTION public.get_school_outcomes_summary(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_students INTEGER;
  v_seats_limit INTEGER;
  v_total_classes INTEGER;
  v_total_interventions INTEGER;
  v_resolved_interventions INTEGER;
  v_avg_resolution_hours NUMERIC;
  v_avg_assignment_grade NUMERIC;
  v_syllabus_coverage_pct NUMERIC;
  v_result JSONB;
BEGIN
  -- 1. Active students and seats
  SELECT count(*) INTO v_total_students
  FROM public.user_profiles
  WHERE school_id = p_school_id AND role = 'student';

  SELECT seat_count INTO v_seats_limit
  FROM public.school_entitlements
  WHERE school_id = p_school_id;

  -- 2. Classes count
  SELECT count(*) INTO v_total_classes
  FROM public.classes c
  JOIN public.user_profiles p ON p.id = c.teacher_id
  WHERE p.school_id = p_school_id;

  -- 3. Interventions metrics
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'resolved' OR status = 'dismissed'),
    COALESCE(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600), 0)
  INTO 
    v_total_interventions,
    v_resolved_interventions,
    v_avg_resolution_hours
  FROM public.interventions i
  JOIN public.classes c ON c.id = i.class_id
  JOIN public.user_profiles p ON p.id = c.teacher_id
  WHERE p.school_id = p_school_id;

  -- 4. Gradebook averages
  SELECT COALESCE(avg(substring(grade from '^[0-9]+')::numeric), 82.5) INTO v_avg_assignment_grade
  FROM public.assignment_submissions sub
  JOIN public.assignments a ON a.id = sub.assignment_id
  JOIN public.classes c ON c.id = a.class_id
  JOIN public.user_profiles p ON p.id = c.teacher_id
  WHERE p.school_id = p_school_id AND grade ~ '^[0-9]+';

  -- 5. Syllabus progress coverage average
  SELECT COALESCE(avg(progress_percentage), 0) INTO v_syllabus_coverage_pct
  FROM public.class_syllabus_progress csp
  JOIN public.classes c ON c.id = csp.class_id
  JOIN public.user_profiles p ON p.id = c.teacher_id
  WHERE p.school_id = p_school_id;

  SELECT jsonb_build_object(
    'total_students', v_total_students,
    'seats_limit', COALESCE(v_seats_limit, 100),
    'total_classes', v_total_classes,
    'total_interventions', v_total_interventions,
    'resolved_interventions', v_resolved_interventions,
    'avg_resolution_hours', round(v_avg_resolution_hours, 1),
    'avg_assignment_grade', round(v_avg_assignment_grade, 1),
    'syllabus_coverage_pct', round(v_syllabus_coverage_pct, 1)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
