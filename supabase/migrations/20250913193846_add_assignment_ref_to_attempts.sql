-- Link exam attempts to assignments for grouping by mock test
ALTER TABLE public.cbse_exam_attempts
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL;

-- Optional helper index
CREATE INDEX IF NOT EXISTS cbse_exam_attempts_assignment_id_idx
  ON public.cbse_exam_attempts (assignment_id);
