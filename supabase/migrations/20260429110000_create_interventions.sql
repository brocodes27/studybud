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
  outcome_metric JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_interventions_student_status
  ON public.interventions(student_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_class_status
  ON public.interventions(class_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_roadmap_status
  ON public.interventions(roadmap_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_one_active_action
  ON public.interventions(student_user_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid), trigger_type, action_type)
  WHERE status = 'active';
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.intervention_student_in_class(
  p_class_id UUID,
  p_student_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_col TEXT;
  v_exists BOOLEAN;
BEGIN
  IF p_class_id IS NULL OR p_student_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT column_name
  INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'class_members'
    AND column_name IN ('user_id', 'student_id')
  ORDER BY CASE column_name WHEN 'user_id' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_col IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
      SELECT 1
      FROM public.class_members cm
      WHERE cm.class_id = $1
        AND cm.%I = $2
    )',
    v_col
  )
  USING p_class_id, p_student_user_id
  INTO v_exists;

  RETURN COALESCE(v_exists, FALSE);
END;
$$;
CREATE OR REPLACE FUNCTION public.intervention_roadmap_matches(
  p_roadmap_id UUID,
  p_student_user_id UUID,
  p_class_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_roadmap_id IS NULL THEN
    RETURN TRUE;
  END IF;

  IF p_student_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.student_roadmaps sr
    WHERE sr.id = p_roadmap_id
      AND sr.user_id = p_student_user_id
      AND (sr.class_id IS NULL OR sr.class_id = p_class_id)
  );
END;
$$;
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
    auth.role() = 'service_role'
    OR (
      class_id IS NOT NULL
      AND created_by = auth.uid()
      AND created_by_type IN ('teacher', 'mentor')
      AND public.intervention_student_in_class(class_id, student_user_id)
      AND public.intervention_roadmap_matches(roadmap_id, student_user_id, class_id)
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
    auth.role() = 'service_role'
    OR (
      class_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = interventions.class_id
          AND c.teacher_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      class_id IS NOT NULL
      AND public.intervention_student_in_class(class_id, student_user_id)
      AND public.intervention_roadmap_matches(roadmap_id, student_user_id, class_id)
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
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
  v_is_service_role BOOLEAN;
  v_is_class_teacher BOOLEAN;
  v_student_in_class BOOLEAN;
  v_roadmap_matches BOOLEAN;
  v_created_by_type TEXT;
BEGIN
  v_is_service_role := auth.role() = 'service_role';

  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_class_id
      AND c.teacher_id = auth.uid()
  ) INTO v_is_class_teacher;

  v_student_in_class := public.intervention_student_in_class(p_class_id, p_student_user_id);
  v_roadmap_matches := public.intervention_roadmap_matches(p_roadmap_id, p_student_user_id, p_class_id);

  IF NOT v_is_service_role
    AND NOT (v_is_class_teacher AND v_student_in_class AND v_roadmap_matches)
  THEN
    RAISE EXCEPTION 'Not authorized to upsert intervention';
  END IF;

  IF v_is_service_role THEN
    v_created_by_type := COALESCE(p_created_by_type, 'system');
  ELSE
    v_created_by_type := CASE
      WHEN p_created_by_type = 'mentor' THEN 'mentor'
      ELSE 'teacher'
    END;
  END IF;

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
    v_created_by_type
  )
  ON CONFLICT (student_user_id, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid), trigger_type, action_type) WHERE status = 'active'
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
SET search_path = public, auth
AS $$
DECLARE
  v_student_user_id UUID;
  v_class_id UUID;
  v_is_authorized BOOLEAN;
BEGIN
  IF p_status NOT IN ('resolved', 'failed', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid intervention status: %', p_status;
  END IF;

  SELECT student_user_id, class_id
  INTO v_student_user_id, v_class_id
  FROM public.interventions
  WHERE id = p_intervention_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intervention not found: %', p_intervention_id;
  END IF;

  v_is_authorized := auth.role() = 'service_role'
    OR auth.uid() = v_student_user_id
    OR (
      v_class_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = v_class_id
          AND c.teacher_id = auth.uid()
      )
    );

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to resolve intervention';
  END IF;

  UPDATE public.interventions
  SET
    status = p_status,
    outcome = p_outcome,
    outcome_metric = COALESCE(p_outcome_metric, '{}'::jsonb),
    resolved_at = NOW()
  WHERE id = p_intervention_id;
END;
$$;
NOTIFY pgrst, 'reload schema';
