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
