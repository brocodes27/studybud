-- Add mock flags and expiry timestamp to assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_mock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;
-- Helpful partial index for fast cleanup queries
CREATE INDEX IF NOT EXISTS assignments_expires_at_idx
  ON public.assignments (expires_at)
  WHERE is_mock = true;
