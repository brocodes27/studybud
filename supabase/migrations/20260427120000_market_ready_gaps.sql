-- ============================================
-- Market-Ready Gap Fill: Test Telemetry, Knowledge Graph, Question Metadata
-- Idempotent migration: safe to re-run
-- ============================================

-- 1. Test Attempt Questions (Per-Question Telemetry)
CREATE TABLE IF NOT EXISTS public.test_attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID NOT NULL REFERENCES public.test_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  time_spent_sec INTEGER DEFAULT 0,
  was_skipped BOOLEAN DEFAULT FALSE,
  was_answer_changed BOOLEAN DEFAULT FALSE,
  error_type TEXT CHECK (error_type IN ('concept', 'speed', 'careless', 'panic', null)),
  topic_tag TEXT,
  marks_obtained NUMERIC DEFAULT 0,
  marks_total NUMERIC DEFAULT 0,
  original_mistake_id UUID REFERENCES public.test_attempt_questions(id) ON DELETE SET NULL,
  mistake_fixed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_attempt_questions_test ON public.test_attempt_questions(test_result_id);
CREATE INDEX IF NOT EXISTS idx_test_attempt_questions_user ON public.test_attempt_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempt_questions_topic ON public.test_attempt_questions(topic_tag);
CREATE INDEX IF NOT EXISTS idx_test_attempt_questions_mistake ON public.test_attempt_questions(original_mistake_id) WHERE original_mistake_id IS NOT NULL;
ALTER TABLE public.test_attempt_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_attempt_questions' AND policyname='taq_select_own') THEN
    CREATE POLICY taq_select_own ON public.test_attempt_questions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_attempt_questions' AND policyname='taq_insert_own') THEN
    CREATE POLICY taq_insert_own ON public.test_attempt_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='test_attempt_questions' AND policyname='taq_update_own') THEN
    CREATE POLICY taq_update_own ON public.test_attempt_questions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
-- 2. Knowledge Graph Edges (Prerequisite Map)
CREATE TABLE IF NOT EXISTS public.knowledge_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_kc_id UUID NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  child_kc_id UUID NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'prerequisite' CHECK (edge_type IN ('prerequisite', 'related', 'builds_on', 'similar_to')),
  weight NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_kc_id, child_kc_id, edge_type)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_edges_parent ON public.knowledge_graph_edges(parent_kc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_edges_child ON public.knowledge_graph_edges(child_kc_id);
ALTER TABLE public.knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_graph_edges' AND policyname='kge_select_all') THEN
    CREATE POLICY kge_select_all ON public.knowledge_graph_edges FOR SELECT USING (true);
  END IF;
END $$;
-- 3. Question Metadata (Rich Question Tagging)
CREATE TABLE IF NOT EXISTS public.question_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('coaching_module', 'dpp', 'test', 'past_paper', 'custom')),
  source_id TEXT,
  module_level INTEGER,
  kc_id UUID REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard')),
  expected_time_sec INTEGER,
  error_type_hint TEXT,
  question_text TEXT,
  solution_text TEXT,
  marks INTEGER DEFAULT 4,
  negative_marks NUMERIC DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  exam_type TEXT DEFAULT 'JEE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_metadata_kc ON public.question_metadata(kc_id);
CREATE INDEX IF NOT EXISTS idx_question_metadata_source ON public.question_metadata(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_question_metadata_difficulty ON public.question_metadata(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_metadata_tags ON public.question_metadata USING GIN(tags);
ALTER TABLE public.question_metadata ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_metadata' AND policyname='qm_select_all') THEN
    CREATE POLICY qm_select_all ON public.question_metadata FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='question_metadata' AND policyname='qm_insert_admin') THEN
    CREATE POLICY qm_insert_admin ON public.question_metadata
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND COALESCE(up.is_admin, false) = true
        )
      );
  END IF;
END $$;
-- 4. Revision Schedule Rules (Spaced Repetition for Prescriptions)
CREATE TABLE IF NOT EXISTS public.revision_schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_task_id UUID,
  source_topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  revision_type TEXT NOT NULL CHECK (revision_type IN ('same_day', 'plus_2d', 'plus_7d', 'pre_test')),
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revision_schedule_user ON public.revision_schedule_rules(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_revision_schedule_status ON public.revision_schedule_rules(status) WHERE status = 'pending';
ALTER TABLE public.revision_schedule_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='revision_schedule_rules' AND policyname='rsr_select_own') THEN
    CREATE POLICY rsr_select_own ON public.revision_schedule_rules FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='revision_schedule_rules' AND policyname='rsr_insert_own') THEN
    CREATE POLICY rsr_insert_own ON public.revision_schedule_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- 5. Add generated_by column to daily_prescriptions if not exists
ALTER TABLE public.daily_prescriptions ADD COLUMN IF NOT EXISTS generated_by TEXT DEFAULT 'llm_full';
-- 6. Add prescription_source column to track deterministic vs voice vs llm
ALTER TABLE public.daily_prescriptions ADD COLUMN IF NOT EXISTS prescription_source JSONB DEFAULT '{}';
