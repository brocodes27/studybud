-- ============================================
-- Roadmap-Synced Preparation OS — Task Outputs
-- ============================================

CREATE TABLE IF NOT EXISTS public.task_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.daily_prescriptions(id) ON DELETE CASCADE,
  task_order INTEGER NOT NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('text', 'image', 'pdf')),
  text_content TEXT,
  file_url TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_outputs_user_prescription ON public.task_outputs(user_id, prescription_id);

ALTER TABLE public.task_outputs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_outputs' AND policyname='task_outputs_select_own') THEN
    CREATE POLICY task_outputs_select_own ON public.task_outputs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_outputs' AND policyname='task_outputs_insert_own') THEN
    CREATE POLICY task_outputs_insert_own ON public.task_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
