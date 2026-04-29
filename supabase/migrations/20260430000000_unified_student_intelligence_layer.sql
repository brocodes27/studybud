-- Unified Student Intelligence Layer
-- Creates all tables, functions, and policies for the Student Twin system

-- ============================================================
-- 1. KNOWLEDGE GRAPH EDGES (adapted for existing schema)
-- ============================================================
-- knowledge_graph_edges already exists with: id, parent_kc_id, child_kc_id, edge_type, weight, created_at
-- We add curriculum_standard and updated_at
ALTER TABLE public.knowledge_graph_edges 
  ADD COLUMN IF NOT EXISTS curriculum_standard text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure RLS policies
ALTER TABLE public.knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'knowledge_graph_edges' AND policyname = 'edges_select_all') THEN
    CREATE POLICY "edges_select_all" ON public.knowledge_graph_edges FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'knowledge_graph_edges' AND policyname = 'edges_modify_service') THEN
    CREATE POLICY "edges_modify_service" ON public.knowledge_graph_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON public.knowledge_graph_edges(parent_kc_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON public.knowledge_graph_edges(child_kc_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON public.knowledge_graph_edges(edge_type);

-- Trigger: sync edges from knowledge_components.prerequisite_ids
CREATE OR REPLACE FUNCTION public.sync_kc_prerequisite_edges()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.prerequisite_ids IS NOT NULL THEN
        DELETE FROM public.knowledge_graph_edges 
        WHERE child_kc_id = NEW.id AND edge_type = 'prerequisite';
        INSERT INTO public.knowledge_graph_edges (parent_kc_id, child_kc_id, edge_type, weight)
        SELECT prereq_id, NEW.id, 'prerequisite', 1.0
        FROM unnest(NEW.prerequisite_ids) AS prereq_id
        ON CONFLICT (parent_kc_id, child_kc_id, edge_type) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_kc_prereq_edges_trigger ON public.knowledge_components;
CREATE TRIGGER sync_kc_prereq_edges_trigger
    AFTER INSERT OR UPDATE OF prerequisite_ids ON public.knowledge_components
    FOR EACH ROW EXECUTE FUNCTION public.sync_kc_prerequisite_edges();

-- ============================================================
-- 2. STUDENT TOPIC MASTERY (per-KC with confidence + evidence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_topic_mastery (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
    mastery_probability numeric NOT NULL DEFAULT 0.1 CHECK (mastery_probability >= 0 AND mastery_probability <= 1),
    confidence numeric NOT NULL DEFAULT 0.1 CHECK (confidence >= 0 AND confidence <= 1),
    cognitive_tier text CHECK (cognitive_tier IN ('novice', 'emerging', 'developing', 'proficient', 'expert')),
    questions_attempted integer NOT NULL DEFAULT 0,
    questions_correct integer NOT NULL DEFAULT 0,
    consecutive_correct integer NOT NULL DEFAULT 0,
    consecutive_incorrect integer NOT NULL DEFAULT 0,
    last_interaction_result boolean,
    first_seen_at timestamptz,
    last_practiced_at timestamptz,
    half_life_days numeric DEFAULT 7.0,
    predicted_retention numeric DEFAULT 0.1,
    prereq_mastery_required numeric DEFAULT 0.7,
    prereq_readiness_score numeric DEFAULT 0,
    updated_by text DEFAULT 'system' CHECK (updated_by IN ('system', 'bkt', 'teacher', 'self_assessment')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, kc_id)
);

ALTER TABLE public.student_topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topic_mastery_select_own" ON public.student_topic_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "topic_mastery_select_teacher" ON public.student_topic_mastery
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_topic_mastery.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "topic_mastery_modify_service" ON public.student_topic_mastery
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stm_user ON public.student_topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_stm_kc ON public.student_topic_mastery(kc_id);
CREATE INDEX IF NOT EXISTS idx_stm_mastery ON public.student_topic_mastery(mastery_probability DESC);
CREATE INDEX IF NOT EXISTS idx_stm_retention ON public.student_topic_mastery(predicted_retention);

-- ============================================================
-- 3. STUDENT MISCONCEPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_misconceptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
    misconception_label text NOT NULL,
    misconception_category text NOT NULL DEFAULT 'conceptual' 
        CHECK (misconception_category IN ('conceptual', 'procedural', 'notation', 'formula', 'definition', 'careless')),
    triggering_question_pattern text,
    example_wrong_answer text,
    correct_concept text,
    first_observed_at timestamptz DEFAULT now(),
    last_observed_at timestamptz DEFAULT now(),
    occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),
    resolved boolean NOT NULL DEFAULT false,
    resolved_at timestamptz,
    resolution_evidence_type text CHECK (resolution_evidence_type IN ('correct_streak', 'explanation', 'teacher_verified', 'self_reported')),
    resolution_evidence_id uuid,
    severity numeric DEFAULT 0.5,
    source_type text NOT NULL DEFAULT 'system' CHECK (source_type IN ('system', 'teacher', 'ai_analysis', 'self_reported')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, kc_id, misconception_label)
);

ALTER TABLE public.student_misconceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "misconceptions_select_own" ON public.student_misconceptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "misconceptions_select_teacher" ON public.student_misconceptions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_misconceptions.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "misconceptions_modify_service" ON public.student_misconceptions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sm_user ON public.student_misconceptions(user_id);
CREATE INDEX IF NOT EXISTS idx_sm_kc ON public.student_misconceptions(kc_id);
CREATE INDEX IF NOT EXISTS idx_sm_severity ON public.student_misconceptions(severity DESC);
CREATE INDEX IF NOT EXISTS idx_sm_unresolved ON public.student_misconceptions(user_id, resolved) WHERE resolved = false;

-- ============================================================
-- 4. STUDENT LEARNING VELOCITY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_learning_velocity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
    subject text,
    domain text,
    initial_mastery numeric NOT NULL DEFAULT 0.1,
    current_mastery numeric NOT NULL DEFAULT 0.1,
    first_interaction_at timestamptz,
    days_active integer NOT NULL DEFAULT 0,
    total_practice_minutes integer NOT NULL DEFAULT 0,
    total_attempts integer NOT NULL DEFAULT 0,
    mastery_delta numeric DEFAULT 0,
    velocity_per_day numeric DEFAULT 0,
    velocity_per_hour numeric DEFAULT 0,
    velocity_per_attempt numeric DEFAULT 0,
    velocity_tier text DEFAULT 'unknown',
    peer_percentile numeric CHECK (peer_percentile >= 0 AND peer_percentile <= 1),
    last_active_at timestamptz,
    days_since_active integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, kc_id)
);

ALTER TABLE public.student_learning_velocity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "velocity_select_own" ON public.student_learning_velocity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "velocity_select_teacher" ON public.student_learning_velocity
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_learning_velocity.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "velocity_modify_service" ON public.student_learning_velocity FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_slv_user ON public.student_learning_velocity(user_id);
CREATE INDEX IF NOT EXISTS idx_slv_kc ON public.student_learning_velocity(kc_id);
CREATE INDEX IF NOT EXISTS idx_slv_tier ON public.student_learning_velocity(velocity_tier);
CREATE INDEX IF NOT EXISTS idx_slv_stalled ON public.student_learning_velocity(user_id, velocity_tier) WHERE velocity_tier IN ('stalled', 'struggling');

-- ============================================================
-- 5. STUDENT AVOIDANCE PATTERNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_avoidance_patterns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    avoidance_type text NOT NULL CHECK (avoidance_type IN ('subject', 'topic', 'task_type', 'difficulty', 'assessment', 'review', 'prerequisite')),
    subject text,
    kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
    task_type text,
    difficulty_level text CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    first_observed_at timestamptz DEFAULT now(),
    last_observed_at timestamptz DEFAULT now(),
    scheduled_count integer NOT NULL DEFAULT 0,
    completed_count integer NOT NULL DEFAULT 0,
    skipped_count integer NOT NULL DEFAULT 0,
    postponed_count integer NOT NULL DEFAULT 0,
    avoidance_rate numeric DEFAULT 0,
    pattern_label text DEFAULT 'engaged',
    avoidance_hypothesis text CHECK (avoidance_hypothesis IN (
        'confidence_gap', 'boredom', 'time_pressure', 'anxiety', 'prereq_unready',
        'unclear_value', 'preference', 'external_conflict', 'unknown'
    )),
    hypothesis_confidence numeric DEFAULT 0.0 CHECK (hypothesis_confidence >= 0 AND hypothesis_confidence <= 1),
    hypothesis_evidence jsonb DEFAULT '{}',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sap_unique ON public.student_avoidance_patterns 
    (user_id, avoidance_type, COALESCE(subject, ''), COALESCE(kc_id::text, ''), COALESCE(task_type, ''), COALESCE(difficulty_level, ''));

ALTER TABLE public.student_avoidance_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avoidance_select_own" ON public.student_avoidance_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "avoidance_select_teacher" ON public.student_avoidance_patterns
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_avoidance_patterns.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "avoidance_modify_service" ON public.student_avoidance_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sap_user ON public.student_avoidance_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_sap_pattern ON public.student_avoidance_patterns(pattern_label);
CREATE INDEX IF NOT EXISTS idx_sap_active ON public.student_avoidance_patterns(user_id, active) WHERE active = true;

-- ============================================================
-- 6. STUDENT TWIN SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_twin_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    snapshot_version integer NOT NULL DEFAULT 1,
    display_name text,
    current_roadmap_id uuid REFERENCES public.student_roadmaps(id),
    current_class_id uuid REFERENCES public.classes(id),
    class_standings jsonb DEFAULT '{}',
    behavioral_profile jsonb NOT NULL DEFAULT '{}',
    mastery_landscape jsonb NOT NULL DEFAULT '{}',
    cognitive_state jsonb NOT NULL DEFAULT '{}',
    motivation_state jsonb NOT NULL DEFAULT '{}',
    persistent_memory jsonb NOT NULL DEFAULT '{}',
    recommended_next_actions jsonb NOT NULL DEFAULT '[]',
    evidence_sources jsonb NOT NULL DEFAULT '[]',
    twin_completeness_score numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, snapshot_version)
);

ALTER TABLE public.student_twin_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "twin_select_own" ON public.student_twin_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "twin_select_teacher" ON public.student_twin_snapshots
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_twin_snapshots.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "twin_modify_service" ON public.student_twin_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sts_user ON public.student_twin_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_sts_version ON public.student_twin_snapshots(user_id, snapshot_version DESC);

-- ============================================================
-- 7. STUDENT TWIN SUMMARIES (weekly)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_twin_summaries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    week_end date NOT NULL,
    for_student jsonb NOT NULL DEFAULT '{}',
    for_teacher jsonb NOT NULL DEFAULT '{}',
    for_parent jsonb NOT NULL DEFAULT '{}',
    raw_metrics jsonb NOT NULL DEFAULT '{}',
    ai_narrative text,
    ai_narrative_generated_at timestamptz,
    generated_by text NOT NULL DEFAULT 'system',
    acknowledged_by_student_at timestamptz,
    acknowledged_by_teacher_at timestamptz,
    acknowledged_by_parent_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, week_start)
);

ALTER TABLE public.student_twin_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "summary_select_own" ON public.student_twin_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "summary_select_teacher" ON public.student_twin_summaries
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = student_twin_summaries.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "summary_modify_service" ON public.student_twin_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stsum_user ON public.student_twin_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_stsum_week ON public.student_twin_summaries(user_id, week_start DESC);

-- ============================================================
-- 8. TASK RATIONALES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_rationales (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_source_type text NOT NULL,
    task_source_id uuid NOT NULL,
    task_title text,
    rationale_type text NOT NULL,
    grounding jsonb NOT NULL DEFAULT '{}',
    explanation_text text NOT NULL,
    explanation_short text,
    tone text DEFAULT 'encouraging',
    student_feedback text,
    student_feedback_at timestamptz,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, task_source_type, task_source_id, valid_from)
);

ALTER TABLE public.task_rationales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rationale_select_own" ON public.task_rationales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rationale_select_teacher" ON public.task_rationales
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classes c
            JOIN public.student_roadmaps sr ON sr.class_id = c.id
            WHERE sr.user_id = task_rationales.user_id AND c.teacher_id = auth.uid()
        )
    );
CREATE POLICY "rationale_modify_service" ON public.task_rationales FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tr_user ON public.task_rationales(user_id);
CREATE INDEX IF NOT EXISTS idx_tr_valid ON public.task_rationales(user_id, valid_from DESC) WHERE valid_until IS NULL;
