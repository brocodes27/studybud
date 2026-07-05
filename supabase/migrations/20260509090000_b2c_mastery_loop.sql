-- B2C Learn Anything: Evidence-Based Mastery Loop primitives.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.learning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_level text NOT NULL DEFAULT 'beginner' CHECK (target_level IN ('beginner', 'intermediate', 'advanced')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_goals_user_status ON public.learning_goals(user_id, status);
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_goals' AND policyname='learning_goals_select_own') THEN
    CREATE POLICY learning_goals_select_own ON public.learning_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_goals' AND policyname='learning_goals_insert_own') THEN
    CREATE POLICY learning_goals_insert_own ON public.learning_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_goals' AND policyname='learning_goals_update_own') THEN
    CREATE POLICY learning_goals_update_own ON public.learning_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_goals' AND policyname='learning_goals_delete_own') THEN
    CREATE POLICY learning_goals_delete_own ON public.learning_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_goals' AND policyname='learning_goals_service_all') THEN
    CREATE POLICY learning_goals_service_all ON public.learning_goals FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.goal_knowledge_components (
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'ai_generated' CHECK (source IN ('template', 'user', 'ai_generated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, kc_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_kcs_kc ON public.goal_knowledge_components(kc_id);
ALTER TABLE public.goal_knowledge_components ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_knowledge_components' AND policyname='goal_kcs_select_own') THEN
    CREATE POLICY goal_kcs_select_own ON public.goal_knowledge_components
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_knowledge_components' AND policyname='goal_kcs_write_own') THEN
    CREATE POLICY goal_kcs_write_own ON public.goal_knowledge_components
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_knowledge_components' AND policyname='goal_kcs_service_all') THEN
    CREATE POLICY goal_kcs_service_all ON public.goal_knowledge_components FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  material_type text NOT NULL CHECK (material_type IN ('template', 'upload', 'link', 'web_search', 'note')),
  title text NOT NULL,
  source_url text,
  storage_path text,
  mime_type text,
  raw_text text,
  extracted_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_owner ON public.materials(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_materials_visibility_type ON public.materials(visibility, material_type);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials' AND policyname='materials_select_available') THEN
    CREATE POLICY materials_select_available ON public.materials
      FOR SELECT TO authenticated
      USING (owner_user_id = auth.uid() OR visibility = 'public');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials' AND policyname='materials_insert_own') THEN
    CREATE POLICY materials_insert_own ON public.materials
      FOR INSERT TO authenticated
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials' AND policyname='materials_update_own') THEN
    CREATE POLICY materials_update_own ON public.materials
      FOR UPDATE TO authenticated
      USING (owner_user_id = auth.uid())
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials' AND policyname='materials_delete_own') THEN
    CREATE POLICY materials_delete_own ON public.materials
      FOR DELETE TO authenticated
      USING (owner_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials' AND policyname='materials_service_all') THEN
    CREATE POLICY materials_service_all ON public.materials FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.material_kc_links (
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  relevance numeric NOT NULL DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, kc_id)
);
ALTER TABLE public.material_kc_links ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.material_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  embedding vector(768),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_chunks_material ON public.material_chunks(material_id);
CREATE INDEX IF NOT EXISTS idx_material_chunks_embedding ON public.material_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE public.material_chunks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_kc_links' AND policyname='material_kc_links_select_available') THEN
    CREATE POLICY material_kc_links_select_available ON public.material_kc_links
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND (m.owner_user_id = auth.uid() OR m.visibility = 'public')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_kc_links' AND policyname='material_kc_links_service_all') THEN
    CREATE POLICY material_kc_links_service_all ON public.material_kc_links FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_chunks' AND policyname='material_chunks_select_available') THEN
    CREATE POLICY material_chunks_select_available ON public.material_chunks
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND (m.owner_user_id = auth.uid() OR m.visibility = 'public')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_chunks' AND policyname='material_chunks_service_all') THEN
    CREATE POLICY material_chunks_service_all ON public.material_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.goal_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'superseded'))
);
CREATE INDEX IF NOT EXISTS idx_goal_prescriptions_goal_created ON public.goal_prescriptions(goal_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.focus_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  prescription_id uuid REFERENCES public.goal_prescriptions(id) ON DELETE SET NULL,
  planned_minutes integer,
  elapsed_sec integer,
  pause_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  stuck_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_step_index integer,
  client_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_focus_runs_goal_created ON public.focus_runs(goal_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  focus_run_id uuid REFERENCES public.focus_runs(id) ON DELETE SET NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('focus_run', 'quiz', 'voice', 'coding', 'prove_it')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'grading', 'graded', 'failed')),
  score numeric CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  grader_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_evidence_items_goal_created ON public.evidence_items(goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_items_kc ON public.evidence_items(kc_id);
ALTER TABLE public.goal_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_prescriptions' AND policyname='goal_prescriptions_select_own') THEN
    CREATE POLICY goal_prescriptions_select_own ON public.goal_prescriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_prescriptions' AND policyname='goal_prescriptions_service_all') THEN
    CREATE POLICY goal_prescriptions_service_all ON public.goal_prescriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_runs' AND policyname='focus_runs_select_own') THEN
    CREATE POLICY focus_runs_select_own ON public.focus_runs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_runs' AND policyname='focus_runs_insert_own') THEN
    CREATE POLICY focus_runs_insert_own ON public.focus_runs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_runs' AND policyname='focus_runs_service_all') THEN
    CREATE POLICY focus_runs_service_all ON public.focus_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='evidence_items' AND policyname='evidence_items_select_own') THEN
    CREATE POLICY evidence_items_select_own ON public.evidence_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='evidence_items' AND policyname='evidence_items_service_all') THEN
    CREATE POLICY evidence_items_service_all ON public.evidence_items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.mastery_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  source_type text,
  source_id uuid,
  prev_mastery numeric CHECK (prev_mastery IS NULL OR (prev_mastery >= 0 AND prev_mastery <= 1)),
  new_mastery numeric CHECK (new_mastery IS NULL OR (new_mastery >= 0 AND new_mastery <= 1)),
  delta numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mastery_updates_user_created ON public.mastery_updates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_updates_kc ON public.mastery_updates(kc_id);
ALTER TABLE public.mastery_updates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mastery_updates' AND policyname='mastery_updates_select_own') THEN
    CREATE POLICY mastery_updates_select_own ON public.mastery_updates FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mastery_updates' AND policyname='mastery_updates_service_all') THEN
    CREATE POLICY mastery_updates_service_all ON public.mastery_updates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.coding_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'typescript' CHECK (language IN ('javascript', 'typescript')),
  instructions text NOT NULL,
  starter_code text,
  test_code text NOT NULL,
  ai_rubric_prompt text,
  time_limit_ms integer NOT NULL DEFAULT 2000,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.coding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.coding_challenges(id) ON DELETE CASCADE,
  code text NOT NULL,
  test_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  verdict text NOT NULL CHECK (verdict IN ('pass', 'fail')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_user_created ON public.coding_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_goal ON public.coding_submissions(goal_id);
ALTER TABLE public.coding_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coding_challenges' AND policyname='coding_challenges_select_authenticated') THEN
    CREATE POLICY coding_challenges_select_authenticated ON public.coding_challenges FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coding_challenges' AND policyname='coding_challenges_service_all') THEN
    CREATE POLICY coding_challenges_service_all ON public.coding_challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coding_submissions' AND policyname='coding_submissions_select_own') THEN
    CREATE POLICY coding_submissions_select_own ON public.coding_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='coding_submissions' AND policyname='coding_submissions_service_all') THEN
    CREATE POLICY coding_submissions_service_all ON public.coding_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.match_material_chunks(
  p_query_embedding vector(768),
  p_match_count integer DEFAULT 8,
  p_match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  material_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    mc.id,
    mc.material_id,
    mc.chunk_text,
    mc.metadata,
    1 - (mc.embedding <=> p_query_embedding) AS similarity
  FROM public.material_chunks mc
  JOIN public.materials m ON m.id = mc.material_id
  WHERE mc.embedding IS NOT NULL
    AND (m.owner_user_id = auth.uid() OR m.visibility = 'public')
    AND 1 - (mc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY mc.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'learning_goals_set_updated_at') THEN
      CREATE TRIGGER learning_goals_set_updated_at BEFORE UPDATE ON public.learning_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'materials_set_updated_at') THEN
      CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.sync_topic_mastery_from_bkt()
RETURNS TRIGGER AS $$
DECLARE
    new_consecutive_correct int := 0;
    new_consecutive_incorrect int := 0;
    new_correct_count int := 0;
    mapped_tier text := 'novice';
BEGIN
    IF NEW.last_correct THEN
        new_consecutive_correct := 1;
        new_consecutive_incorrect := 0;
    ELSE
        new_consecutive_correct := 0;
        new_consecutive_incorrect := 1;
    END IF;

    new_correct_count := CASE WHEN NEW.last_correct THEN COALESCE(NEW.interaction_count, 0) ELSE 0 END;
    mapped_tier := CASE
      WHEN NEW.cognitive_tier IN ('expert', 'autonoetic') THEN 'expert'
      WHEN NEW.cognitive_tier IN ('proficient') THEN 'proficient'
      WHEN NEW.cognitive_tier IN ('developing', 'noetic') THEN 'developing'
      WHEN NEW.cognitive_tier IN ('emerging', 'anoetic') THEN 'emerging'
      ELSE 'novice'
    END;

    INSERT INTO public.student_topic_mastery (
        user_id, kc_id, mastery_probability, confidence, cognitive_tier,
        questions_attempted, questions_correct, consecutive_correct, consecutive_incorrect,
        last_interaction_result, last_practiced_at, updated_by
    )
    VALUES (
        NEW.user_id, NEW.kc_id, COALESCE(NEW.p_mastery, 0.1), COALESCE(NEW.confidence_interval, 0.1),
        mapped_tier, COALESCE(NEW.interaction_count, 0),
        new_correct_count, new_consecutive_correct, new_consecutive_incorrect,
        NEW.last_correct, NEW.last_interaction_at, 'bkt'
    )
    ON CONFLICT (user_id, kc_id) DO UPDATE SET
        mastery_probability = EXCLUDED.mastery_probability,
        confidence = EXCLUDED.confidence,
        cognitive_tier = EXCLUDED.cognitive_tier,
        questions_attempted = EXCLUDED.questions_attempted,
        questions_correct = EXCLUDED.questions_correct,
        consecutive_correct = EXCLUDED.consecutive_correct,
        consecutive_incorrect = EXCLUDED.consecutive_incorrect,
        last_interaction_result = EXCLUDED.last_interaction_result,
        last_practiced_at = EXCLUDED.last_practiced_at,
        updated_by = 'bkt',
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
