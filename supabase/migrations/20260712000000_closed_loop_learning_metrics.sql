-- Closed-loop learning: outcome instrumentation and role-scoped visibility.

-- Historical environments used either student_id or user_id. Keep both readable
-- and backfill the current application-facing column.
ALTER TABLE public.class_members
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.class_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.class_members SET user_id = student_id WHERE user_id IS NULL;
UPDATE public.class_members SET student_id = user_id WHERE student_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_members_class_user
  ON public.class_members(class_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_class_member_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, NEW.student_id);
  NEW.student_id := COALESCE(NEW.student_id, NEW.user_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS class_member_identity_sync ON public.class_members;
CREATE TRIGGER class_member_identity_sync
  BEFORE INSERT OR UPDATE ON public.class_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_class_member_identity();

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_assignments_assignee_ids
  ON public.assignments USING gin(assignee_ids);

DROP POLICY IF EXISTS "Students can view assignments in their classes" ON public.assignments;
DROP POLICY IF EXISTS "Allow students to view assignments" ON public.assignments;
DROP POLICY IF EXISTS assignments_students_read_scoped ON public.assignments;
CREATE POLICY assignments_students_read_scoped
  ON public.assignments FOR SELECT TO authenticated
  USING (
    (COALESCE(array_length(assignee_ids, 1), 0) = 0 OR auth.uid() = ANY(assignee_ids))
    AND EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = assignments.class_id
        AND (cm.user_id = auth.uid() OR cm.student_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Students can view and manage their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_student_select ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_student_insert ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_student_update ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_student_delete ON public.assignment_submissions;

CREATE POLICY submissions_student_select
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY submissions_student_insert
  ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (COALESCE(array_length(a.assignee_ids, 1), 0) = 0 OR auth.uid() = ANY(a.assignee_ids))
    )
  );
CREATE POLICY submissions_student_update
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (COALESCE(array_length(a.assignee_ids, 1), 0) = 0 OR auth.uid() = ANY(a.assignee_ids))
    )
  );
CREATE POLICY submissions_student_delete
  ON public.assignment_submissions FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND graded_at IS NULL);

CREATE OR REPLACE FUNCTION public.protect_submission_assessment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() = NEW.student_id THEN
    IF TG_OP = 'UPDATE' AND (
      OLD.graded_at IS NOT NULL OR
      NEW.assignment_id IS DISTINCT FROM OLD.assignment_id OR
      NEW.student_id IS DISTINCT FROM OLD.student_id
    ) THEN
      RAISE EXCEPTION 'Assessed submissions and submission ownership are immutable';
    END IF;
    IF TG_OP = 'INSERT' AND (
      NEW.grade IS NOT NULL OR NEW.feedback IS NOT NULL OR
      NEW.graded_at IS NOT NULL OR NEW.graded_by IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Students cannot set assessment fields';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.grade IS DISTINCT FROM OLD.grade OR
      NEW.feedback IS DISTINCT FROM OLD.feedback OR
      NEW.graded_at IS DISTINCT FROM OLD.graded_at OR
      NEW.graded_by IS DISTINCT FROM OLD.graded_by
    ) THEN
      RAISE EXCEPTION 'Students cannot change assessment fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_submission_assessment_fields ON public.assignment_submissions;
CREATE TRIGGER protect_submission_assessment_fields
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_submission_assessment_fields();

-- Student work is private by default. Object names begin with the student's
-- user id, which is enforced for uploads and reads.
UPDATE storage.buckets SET public = false WHERE id = 'submissions';
DROP POLICY IF EXISTS "Allow users to upload submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read submissions" ON storage.objects;
DROP POLICY IF EXISTS submissions_owner_upload ON storage.objects;
DROP POLICY IF EXISTS submissions_relationship_read ON storage.objects;
CREATE POLICY submissions_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY submissions_relationship_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE (cm.user_id::text = (storage.foldername(name))[1]
            OR cm.student_id::text = (storage.foldername(name))[1])
          AND c.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.parent_user_id = auth.uid()
          AND psl.student_user_id::text = (storage.foldername(name))[1]
          AND psl.status = 'active'
      )
    )
  );

ALTER TABLE public.user_knowledge
  ADD COLUMN IF NOT EXISTS assessment_source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_knowledge_assessment_source
  ON public.user_knowledge(user_id, assessment_source_id);

ALTER TABLE public.task_outputs
  ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_outputs_user_source_key
  ON public.task_outputs(user_id, source_key);

CREATE TABLE IF NOT EXISTS public.learning_session_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text,
  concept text,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  mastery_before numeric CHECK (mastery_before BETWEEN 0 AND 1),
  mastery_after numeric CHECK (mastery_after BETWEEN 0 AND 1),
  mastery_delta numeric,
  evidence_quality numeric CHECK (evidence_quality BETWEEN 0 AND 1),
  source_key text,
  work_mode text NOT NULL DEFAULT 'type' CHECK (work_mode IN ('type', 'draw', 'notebook')),
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_session_metrics
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE INDEX IF NOT EXISTS idx_learning_session_metrics_user_created
  ON public.learning_session_metrics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_session_metrics_class_created
  ON public.learning_session_metrics(class_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_metrics_assignment_user
  ON public.learning_session_metrics(user_id, assignment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_metrics_user_source_key
  ON public.learning_session_metrics(user_id, source_key);

CREATE OR REPLACE FUNCTION public.finalize_assignment_assessment(
  p_submission_id uuid,
  p_student_id uuid,
  p_grade text,
  p_feedback text,
  p_concept text,
  p_subject text,
  p_score numeric,
  p_evidence_quality numeric,
  p_duration_seconds integer,
  p_work_mode text,
  p_misconception text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission public.assignment_submissions%ROWTYPE;
  v_class_id uuid;
  v_prior numeric;
  v_delta numeric;
  v_evidence record;
  v_metric record;
BEGIN
  SELECT s.*
    INTO v_submission
  FROM public.assignment_submissions s
  WHERE s.id = p_submission_id
    AND s.student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  SELECT a.class_id INTO v_class_id
  FROM public.assignments a
  WHERE a.id = v_submission.assignment_id;

  IF v_submission.graded_at IS NOT NULL THEN
    SELECT topic, confidence, metadata
      INTO v_evidence
    FROM public.user_knowledge
    WHERE user_id = p_student_id
      AND assessment_source_id = 'assignment:' || v_submission.assignment_id::text
    LIMIT 1;
    SELECT mastery_before, mastery_after, mastery_delta, evidence_quality
      INTO v_metric
    FROM public.learning_session_metrics
    WHERE user_id = p_student_id
      AND source_key = 'assignment:' || v_submission.assignment_id::text
    LIMIT 1;
    RETURN jsonb_build_object(
      'already_assessed', true,
      'grade', v_submission.grade,
      'feedback', v_submission.feedback,
      'concept', v_evidence.topic,
      'misconception', v_evidence.metadata->>'misconception',
      'evidence_quality', v_metric.evidence_quality,
      'mastery_before', v_metric.mastery_before,
      'mastery_after', v_metric.mastery_after,
      'mastery_delta', v_metric.mastery_delta
    );
  END IF;

  SELECT confidence INTO v_prior
  FROM public.user_knowledge
  WHERE user_id = p_student_id
    AND subject = p_subject
    AND topic = p_concept
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  v_delta := CASE WHEN v_prior IS NULL THEN NULL ELSE p_score - v_prior END;

  UPDATE public.assignment_submissions
  SET grade = p_grade,
      feedback = p_feedback,
      graded_at = now(),
      graded_by = NULL
  WHERE id = p_submission_id;

  INSERT INTO public.user_knowledge (
    user_id, content, source_type, topic, subject, knowledge_type,
    source, confidence, assessment_source_id, metadata, updated_at
  )
  VALUES (
    p_student_id,
    CASE
      WHEN p_misconception IS NOT NULL
        THEN 'Assessment evidence for ' || p_concept || '. Misconception: ' || left(p_misconception, 500)
      ELSE 'Assessment evidence for ' || p_concept || ': demonstrated ' || round(p_score * 100) || '% confidence.'
    END,
    'assignment_assessment',
    p_concept,
    p_subject,
    'formative_assessment',
    'closed_loop_homework',
    p_score,
    'assignment:' || v_submission.assignment_id::text,
    jsonb_build_object(
      'assignment_id', v_submission.assignment_id,
      'evidence_quality', p_evidence_quality,
      'misconception', p_misconception
    ),
    now()
  )
  ON CONFLICT (user_id, assessment_source_id)
  DO UPDATE SET
    content = EXCLUDED.content,
    topic = EXCLUDED.topic,
    subject = EXCLUDED.subject,
    confidence = EXCLUDED.confidence,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.learning_session_metrics (
    user_id, assignment_id, class_id, subject, concept, duration_seconds,
    mastery_before, mastery_after, mastery_delta, evidence_quality,
    source_key, work_mode, completed
  )
  VALUES (
    p_student_id, v_submission.assignment_id, v_class_id, p_subject, p_concept,
    GREATEST(1, LEAST(86400, p_duration_seconds)),
    v_prior, p_score, v_delta, p_evidence_quality,
    'assignment:' || v_submission.assignment_id::text,
    p_work_mode, true
  )
  ON CONFLICT (user_id, source_key)
  DO UPDATE SET
    duration_seconds = EXCLUDED.duration_seconds,
    mastery_before = EXCLUDED.mastery_before,
    mastery_after = EXCLUDED.mastery_after,
    mastery_delta = EXCLUDED.mastery_delta,
    evidence_quality = EXCLUDED.evidence_quality,
    work_mode = EXCLUDED.work_mode,
    created_at = now();

  IF p_score < 0.65 AND p_evidence_quality >= 0.5 THEN
    INSERT INTO public.interventions (
      student_user_id, class_id, trigger_type, trigger_source, severity,
      intervention_level, action_type, action_payload, created_by_type
    )
    SELECT
      p_student_id,
      v_class_id,
      'proof_pending',
      'assignment:' || v_submission.assignment_id::text,
      CASE WHEN p_score < 0.4 THEN 'high' ELSE 'medium' END,
      CASE WHEN p_score < 0.4 THEN 3 ELSE 2 END,
      'teacher_review',
      jsonb_build_object(
        'message', 'Review ' || p_concept || '. The latest evidence was ' || round(p_score * 100) || '% confident.',
        'assignment_id', v_submission.assignment_id,
        'concept', p_concept
      ),
      'system'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.interventions i
      WHERE i.student_user_id = p_student_id
        AND i.class_id = v_class_id
        AND i.trigger_type = 'proof_pending'
        AND i.trigger_source = 'assignment:' || v_submission.assignment_id::text
        AND i.action_type = 'teacher_review'
        AND i.status = 'active'
    );
  END IF;

  RETURN jsonb_build_object(
    'already_assessed', false,
    'mastery_before', v_prior,
    'mastery_after', p_score,
    'mastery_delta', v_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_assignment_assessment(
  uuid, uuid, text, text, text, text, numeric, numeric, integer, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_assignment_assessment(
  uuid, uuid, text, text, text, text, numeric, numeric, integer, text, text
) TO service_role;

ALTER TABLE public.learning_session_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_metrics_student_select ON public.learning_session_metrics;
CREATE POLICY learning_metrics_student_select
  ON public.learning_session_metrics FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS learning_metrics_student_insert ON public.learning_session_metrics;
CREATE POLICY learning_metrics_student_insert
  ON public.learning_session_metrics FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS learning_metrics_teacher_select ON public.learning_session_metrics;
CREATE POLICY learning_metrics_teacher_select
  ON public.learning_session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = learning_session_metrics.class_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS learning_metrics_parent_select ON public.learning_session_metrics;
CREATE POLICY learning_metrics_parent_select
  ON public.learning_session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = learning_session_metrics.user_id
        AND psl.status = 'active'
    )
  );

DROP POLICY IF EXISTS learning_metrics_school_leader_select ON public.learning_session_metrics;
CREATE POLICY learning_metrics_school_leader_select
  ON public.learning_session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships leader
      JOIN public.memberships student ON student.school_id = leader.school_id
      WHERE leader.user_id = auth.uid()
        AND leader.status = 'active'
        AND leader.role IN ('org_admin', 'principal')
        AND student.user_id = learning_session_metrics.user_id
        AND student.status = 'active'
    )
  );

-- Teachers, parents and leaders need read-only access to the same evidence
-- students already own. Each policy is scoped through an explicit relationship.
DROP POLICY IF EXISTS user_knowledge_teacher_select ON public.user_knowledge;
CREATE POLICY user_knowledge_teacher_select
  ON public.user_knowledge FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE (cm.user_id = user_knowledge.user_id OR cm.student_id = user_knowledge.user_id)
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS user_knowledge_parent_select ON public.user_knowledge;
CREATE POLICY user_knowledge_parent_select
  ON public.user_knowledge FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = user_knowledge.user_id
        AND psl.status = 'active'
    )
  );

DROP POLICY IF EXISTS user_knowledge_school_leader_select ON public.user_knowledge;
CREATE POLICY user_knowledge_school_leader_select
  ON public.user_knowledge FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships leader
      JOIN public.memberships student ON student.school_id = leader.school_id
      WHERE leader.user_id = auth.uid()
        AND leader.status = 'active'
        AND leader.role IN ('org_admin', 'principal')
        AND student.user_id = user_knowledge.user_id
        AND student.status = 'active'
    )
  );

DROP POLICY IF EXISTS prescriptions_teacher_select ON public.daily_prescriptions;
CREATE POLICY prescriptions_teacher_select
  ON public.daily_prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE (cm.user_id = daily_prescriptions.user_id OR cm.student_id = daily_prescriptions.user_id)
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS prescriptions_parent_select ON public.daily_prescriptions;
CREATE POLICY prescriptions_parent_select
  ON public.daily_prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = daily_prescriptions.user_id
        AND psl.status = 'active'
    )
  );

DROP POLICY IF EXISTS prescriptions_school_leader_select ON public.daily_prescriptions;
CREATE POLICY prescriptions_school_leader_select
  ON public.daily_prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships leader
      JOIN public.memberships student ON student.school_id = leader.school_id
      WHERE leader.user_id = auth.uid()
        AND leader.status = 'active'
        AND leader.role IN ('org_admin', 'principal')
        AND student.user_id = daily_prescriptions.user_id
        AND student.status = 'active'
    )
  );

-- Profile relationship reads go through SECURITY DEFINER to avoid RLS recursion
-- with class_members/classes policies that historically queried user_profiles.
CREATE OR REPLACE FUNCTION public.fn_can_select_user_profile(p_target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE (cm.user_id = p_target_id OR cm.student_id = p_target_id)
        AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = p_target_id
        AND psl.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships requester
      JOIN public.memberships target ON target.school_id = requester.school_id
      WHERE requester.user_id = auth.uid()
        AND requester.status = 'active'
        AND requester.role IN ('org_admin', 'principal')
        AND target.user_id = p_target_id
        AND target.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.fn_can_select_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_can_select_user_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_teacher_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_parent_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_school_member_select ON public.user_profiles;
DROP POLICY IF EXISTS profiles_related_select ON public.user_profiles;
CREATE POLICY profiles_related_select
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.fn_can_select_user_profile(id));

DROP POLICY IF EXISTS task_outputs_teacher_select ON public.task_outputs;
CREATE POLICY task_outputs_teacher_select
  ON public.task_outputs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE (cm.user_id = task_outputs.user_id OR cm.student_id = task_outputs.user_id)
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS interventions_parent_select ON public.interventions;
CREATE POLICY interventions_parent_select
  ON public.interventions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
        AND psl.student_user_id = interventions.student_user_id
        AND psl.status = 'active'
    )
  );
