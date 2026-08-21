-- Persist per-question AI checks so teachers can inspect homework results.

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS assessment_details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.assignment_submissions.assessment_details IS
  'Service-generated assessment details including per-question status and feedback.';

-- A school has exactly one current academic year. Keep the most recently started
-- active row if older data contains duplicates, then enforce the invariant.
WITH ranked_active_years AS (
  SELECT id, row_number() OVER (
    PARTITION BY school_id
    ORDER BY start_date DESC, created_at DESC, id DESC
  ) AS position
  FROM public.academic_years
  WHERE is_active = true
)
UPDATE public.academic_years year
SET is_active = false
FROM ranked_active_years ranked
WHERE year.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_one_active_per_school
  ON public.academic_years (school_id)
  WHERE is_active = true;

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
      NEW.grade IS NOT NULL OR
      NEW.feedback IS NOT NULL OR
      NEW.graded_at IS NOT NULL OR
      NEW.graded_by IS NOT NULL OR
      COALESCE(NEW.assessment_details, '{}'::jsonb) <> '{}'::jsonb
    ) THEN
      RAISE EXCEPTION 'Students cannot set assessment fields';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.grade IS DISTINCT FROM OLD.grade OR
      NEW.feedback IS DISTINCT FROM OLD.feedback OR
      NEW.graded_at IS DISTINCT FROM OLD.graded_at OR
      NEW.graded_by IS DISTINCT FROM OLD.graded_by OR
      NEW.assessment_details IS DISTINCT FROM OLD.assessment_details
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
