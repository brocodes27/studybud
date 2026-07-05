-- Foundation tables referenced by the market-ready and intelligence-layer migrations.
-- Kept idempotent so projects that already have these tables are left intact.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.knowledge_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT 'General',
  topic text NOT NULL,
  subtopic text,
  description text,
  difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard')),
  prerequisite_ids uuid[] DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject, topic, subtopic)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_components_subject ON public.knowledge_components(subject);
CREATE INDEX IF NOT EXISTS idx_knowledge_components_topic ON public.knowledge_components(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_components_prereqs ON public.knowledge_components USING gin(prerequisite_ids);
ALTER TABLE public.knowledge_components ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'knowledge_components'
      AND policyname = 'knowledge_components_read_authenticated'
  ) THEN
    CREATE POLICY knowledge_components_read_authenticated
      ON public.knowledge_components
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'knowledge_components'
      AND policyname = 'knowledge_components_service_all'
  ) THEN
    CREATE POLICY knowledge_components_service_all
      ON public.knowledge_components
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'knowledge_components_set_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'knowledge_components'
  ) THEN
    CREATE TRIGGER knowledge_components_set_updated_at
      BEFORE UPDATE ON public.knowledge_components
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.student_cognitive_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  p_mastery numeric NOT NULL DEFAULT 0.1 CHECK (p_mastery >= 0 AND p_mastery <= 1),
  p_guess numeric NOT NULL DEFAULT 0.2 CHECK (p_guess >= 0 AND p_guess <= 1),
  p_slip numeric NOT NULL DEFAULT 0.1 CHECK (p_slip >= 0 AND p_slip <= 1),
  p_transit numeric NOT NULL DEFAULT 0.2 CHECK (p_transit >= 0 AND p_transit <= 1),
  confidence_interval numeric NOT NULL DEFAULT 0.1 CHECK (confidence_interval >= 0 AND confidence_interval <= 1),
  interaction_count integer NOT NULL DEFAULT 0,
  last_correct boolean,
  last_interaction_at timestamptz,
  cognitive_tier text NOT NULL DEFAULT 'novice',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, kc_id)
);
CREATE INDEX IF NOT EXISTS idx_student_cognitive_profiles_user ON public.student_cognitive_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_cognitive_profiles_kc ON public.student_cognitive_profiles(kc_id);
ALTER TABLE public.student_cognitive_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_cognitive_profiles'
      AND policyname = 'student_cognitive_profiles_select_own'
  ) THEN
    CREATE POLICY student_cognitive_profiles_select_own
      ON public.student_cognitive_profiles
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_cognitive_profiles'
      AND policyname = 'student_cognitive_profiles_service_all'
  ) THEN
    CREATE POLICY student_cognitive_profiles_service_all
      ON public.student_cognitive_profiles
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.interaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  is_correct boolean,
  response_time_ms integer,
  difficulty_presented text,
  source text,
  emotional_state_detected text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_user_created ON public.interaction_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_kc ON public.interaction_logs(kc_id);
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interaction_logs'
      AND policyname = 'interaction_logs_select_own'
  ) THEN
    CREATE POLICY interaction_logs_select_own
      ON public.interaction_logs
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interaction_logs'
      AND policyname = 'interaction_logs_insert_own'
  ) THEN
    CREATE POLICY interaction_logs_insert_own
      ON public.interaction_logs
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interaction_logs'
      AND policyname = 'interaction_logs_service_all'
  ) THEN
    CREATE POLICY interaction_logs_service_all
      ON public.interaction_logs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
