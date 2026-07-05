-- Align task_completions_v2 with the production shape used by the app.

CREATE TABLE IF NOT EXISTS public.task_completions_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  task_order INTEGER NOT NULL DEFAULT 0,
  task_title TEXT,
  subject TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_duration_min INTEGER,
  engagement_score INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.task_completions_v2
  ADD COLUMN IF NOT EXISTS task_title TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_completions_v2_unique_task
  ON public.task_completions_v2(user_id, source_type, source_id, task_order, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_v2_user_date
  ON public.task_completions_v2(user_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_task_completions_v2_source
  ON public.task_completions_v2(source_type, source_id);
