-- Coschool-style homework drafts on assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS homework_type TEXT,
  ADD COLUMN IF NOT EXISTS draft_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS topic TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_homework_type_check'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_homework_type_check
      CHECK (
        homework_type IS NULL
        OR homework_type IN ('guided_practice', 'assessment_practice')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.assignments.draft_questions IS
  'Teacher-approved sanitized question prompts for guided/assessment homework (no answer keys).';
COMMENT ON COLUMN public.assignments.homework_type IS
  'guided_practice | assessment_practice';
COMMENT ON COLUMN public.assignments.topic IS
  'Concept/topic used when drafting homework questions';
