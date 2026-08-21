-- Governed learning loop: policies are versioned, teacher decisions are explicit,
-- and outcome evidence is retained independently from the intervention prompt.

CREATE TABLE IF NOT EXISTS public.intervention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  key text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  retired_at timestamptz,
  UNIQUE (school_id, key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intervention_policies_one_active
  ON public.intervention_policies (school_id, key)
  WHERE status = 'active';

INSERT INTO public.intervention_policies (school_id, key, version, status, rules, activated_at)
SELECT NULL, 'teacher_repair', 1, 'active',
  jsonb_build_object('requires_teacher_approval', true, 'minimum_equivalent_evidence_quality', 0.7), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.intervention_policies
  WHERE school_id IS NULL AND key = 'teacher_repair' AND version = 1
);

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.intervention_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_version integer,
  ADD COLUMN IF NOT EXISTS teacher_decision text CHECK (teacher_decision IN ('approved', 'edited', 'rejected', 'dismissed')),
  ADD COLUMN IF NOT EXISTS teacher_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_decision_note text,
  ADD COLUMN IF NOT EXISTS baseline_confidence numeric CHECK (baseline_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS baseline_evidence_quality numeric CHECK (baseline_evidence_quality BETWEEN 0 AND 1);

CREATE TABLE IF NOT EXISTS public.intervention_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('baseline', 'post_assessment', 'teacher_verification', 'observation')),
  score numeric CHECK (score BETWEEN 0 AND 1),
  evidence_quality numeric CHECK (evidence_quality BETWEEN 0 AND 1),
  assessment_equivalent boolean NOT NULL DEFAULT false,
  model_confidence numeric CHECK (model_confidence BETWEEN 0 AND 1),
  teacher_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_intervention_evidence_intervention
  ON public.intervention_evidence(intervention_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.approve_intervention_repair(
  p_intervention_id uuid,
  p_assignment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intervention public.interventions%ROWTYPE;
  v_baseline numeric;
  v_policy public.intervention_policies%ROWTYPE;
BEGIN
  SELECT * INTO v_intervention FROM public.interventions WHERE id = p_intervention_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intervention not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = v_intervention.class_id AND c.teacher_id = auth.uid()
  ) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not allowed to approve this intervention';
  END IF;

  SELECT * INTO v_policy
  FROM public.intervention_policies
  WHERE status = 'active' AND key = 'teacher_repair'
  ORDER BY (school_id IS NULL), version DESC
  LIMIT 1;

  SELECT confidence INTO v_baseline
  FROM public.user_knowledge
  WHERE user_id = v_intervention.student_user_id
    AND lower(topic) LIKE '%' || lower(COALESCE(v_intervention.action_payload->>'concept', '')) || '%'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  UPDATE public.interventions
  SET action_payload = COALESCE(action_payload, '{}'::jsonb) || jsonb_build_object('repair_assignment_id', p_assignment_id),
      policy_id = v_policy.id,
      policy_version = v_policy.version,
      teacher_decision = 'approved',
      teacher_decided_at = now(),
      baseline_confidence = v_baseline,
      baseline_evidence_quality = CASE WHEN v_baseline IS NULL THEN NULL ELSE 0.4 END
  WHERE id = p_intervention_id;

  IF v_baseline IS NOT NULL THEN
    INSERT INTO public.intervention_evidence (
      intervention_id, student_user_id, evidence_kind, score, evidence_quality,
      assessment_equivalent, model_confidence, metadata
    ) VALUES (
      p_intervention_id, v_intervention.student_user_id, 'baseline', v_baseline, 0.4,
      false, 0.4, jsonb_build_object('source', 'latest_knowledge_signal')
    );
  END IF;

  RETURN jsonb_build_object('policy_version', v_policy.version, 'baseline_confidence', v_baseline);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_intervention_repair(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_intervention_evidence_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intervention public.interventions%ROWTYPE;
BEGIN
  IF NEW.assignment_id IS NULL OR NEW.mastery_after IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_intervention
  FROM public.interventions
  WHERE student_user_id = NEW.user_id
    AND action_payload->>'repair_assignment_id' = NEW.assignment_id::text
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.intervention_evidence (
    intervention_id, assignment_id, student_user_id, evidence_kind, score,
    evidence_quality, assessment_equivalent, model_confidence, metadata
  ) VALUES (
    v_intervention.id, NEW.assignment_id, NEW.user_id, 'post_assessment', NEW.mastery_after,
    NEW.evidence_quality, NEW.evidence_quality >= 0.7, NEW.evidence_quality,
    jsonb_build_object('source_key', NEW.source_key, 'mastery_delta', NEW.mastery_delta)
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.interventions
  SET status = 'resolved',
      resolved_at = now(),
      outcome = CASE
        WHEN NEW.evidence_quality >= 0.7 THEN 'Independent post-assessment recorded.'
        ELSE 'Post-assessment recorded; teacher verification still needed.'
      END,
      outcome_metric = jsonb_build_object(
        'post_score', NEW.mastery_after,
        'evidence_quality', NEW.evidence_quality,
        'assessment_equivalent', NEW.evidence_quality >= 0.7,
        'mastery_delta', NEW.mastery_delta
      )
  WHERE id = v_intervention.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intervention_evidence_from_assignment ON public.learning_session_metrics;
CREATE TRIGGER intervention_evidence_from_assignment
  AFTER INSERT OR UPDATE OF mastery_after, evidence_quality ON public.learning_session_metrics
  FOR EACH ROW EXECUTE FUNCTION public.record_intervention_evidence_from_assignment();

ALTER TABLE public.intervention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY intervention_policies_access
  ON public.intervention_policies FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR public.fn_can_access_school(school_id)
    OR public.fn_is_platform_admin()
  );

CREATE POLICY intervention_evidence_teacher_access
  ON public.intervention_evidence FOR SELECT TO authenticated
  USING (
    auth.uid() = student_user_id
    OR EXISTS (
      SELECT 1 FROM public.interventions i
      JOIN public.classes c ON c.id = i.class_id
      WHERE i.id = intervention_evidence.intervention_id
        AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.parent_student_links link
      WHERE link.parent_user_id = auth.uid()
        AND link.student_user_id = intervention_evidence.student_user_id
        AND link.status = 'active'
    )
  );
