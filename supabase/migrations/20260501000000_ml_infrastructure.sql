-- ML Pipeline Infrastructure
-- Tables for IRT calibration, BKT tuning, agent corrections learning, score prediction model

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================
-- 1. IRT CALIBRATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.irt_calibration_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempt_count integer NOT NULL DEFAULT 0,
    last_calibrated_at timestamptz,
    last_error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_irt_queue_status ON public.irt_calibration_queue(status);
CREATE INDEX IF NOT EXISTS idx_irt_queue_question ON public.irt_calibration_queue(question_id);

CREATE TABLE IF NOT EXISTS public.irt_item_parameters_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    irt_difficulty numeric NOT NULL,
    irt_discrimination numeric NOT NULL,
    irt_guessing numeric NOT NULL DEFAULT 0.25,
    sample_size integer NOT NULL,
    log_likelihood numeric,
    converged boolean,
    iteration_count integer,
    calibrated_at timestamptz DEFAULT now(),
    CONSTRAINT fk_question FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_irt_history_question ON public.irt_item_parameters_history(question_id);
CREATE INDEX IF NOT EXISTS idx_irt_history_time ON public.irt_item_parameters_history(calibrated_at);

-- ============================================================
-- 2. BKT PARAMETER TUNING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bkt_kc_parameters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kc_id text NOT NULL,
    p_guess numeric NOT NULL DEFAULT 0.2,
    p_slip numeric NOT NULL DEFAULT 0.1,
    p_transit numeric NOT NULL DEFAULT 0.2,
    sample_size integer NOT NULL DEFAULT 0,
    confidence_interval numeric NOT NULL DEFAULT 0.1,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT unique_kc UNIQUE (kc_id)
);

CREATE INDEX IF NOT EXISTS idx_bkt_kc ON public.bkt_kc_parameters(kc_id);

CREATE TABLE IF NOT EXISTS public.bkt_parameter_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kc_id text NOT NULL,
    p_guess numeric NOT NULL,
    p_slip numeric NOT NULL,
    p_transit numeric NOT NULL,
    sample_size integer NOT NULL,
    log_likelihood numeric,
    converged boolean,
    iteration_count integer,
    calibrated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bkt_history_kc ON public.bkt_parameter_history(kc_id);
CREATE INDEX IF NOT EXISTS idx_bkt_history_time ON public.bkt_parameter_history(calibrated_at);

-- ============================================================
-- 3. AGENT CORRECTIONS LEARNING TABLES
-- ============================================================

-- agent_corrections: base table for logging AI corrections (was inserted but never created)
CREATE TABLE IF NOT EXISTS public.agent_corrections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    session_id text,
    original_response text,
    correction text,
    agent_responsible text,
    root_cause_analysis text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_corrections_user ON public.agent_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_corrections_agent ON public.agent_corrections(agent_responsible);

DO $$
BEGIN
  ALTER TABLE public.agent_corrections ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_corrections' AND policyname = 'corrections_select') THEN
    CREATE POLICY "corrections_select" ON public.agent_corrections FOR SELECT TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_corrections' AND policyname = 'corrections_insert') THEN
    CREATE POLICY "corrections_insert" ON public.agent_corrections FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_prompt_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_responsible text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    template_text text NOT NULL,
    template_hash text NOT NULL,
    correction_count integer NOT NULL DEFAULT 0,
    accuracy_before numeric,
    accuracy_after numeric,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_agent_version UNIQUE (agent_responsible, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_template_agent ON public.agent_prompt_templates(agent_responsible);
CREATE INDEX IF NOT EXISTS idx_prompt_template_active ON public.agent_prompt_templates(agent_responsible, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.agent_correction_analysis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_responsible text NOT NULL,
    root_cause_category text NOT NULL,
    frequency integer NOT NULL DEFAULT 1,
    affected_sessions integer NOT NULL DEFAULT 1,
    suggested_template_delta text,
    confidence numeric NOT NULL DEFAULT 0,
    pattern_embedding uuid,
    last_seen_at timestamptz DEFAULT now(),
    analyzed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correction_analysis_agent ON public.agent_correction_analysis(agent_responsible);
CREATE INDEX IF NOT EXISTS idx_correction_analysis_category ON public.agent_correction_analysis(root_cause_category);

-- ============================================================
-- 4. SCORE PREDICTION MODEL TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.score_model_coefficients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name text NOT NULL,
    coefficient numeric NOT NULL DEFAULT 0,
    subject text,
    band_intercept numeric NOT NULL DEFAULT 0,
    training_sample_size integer NOT NULL DEFAULT 0,
    accuracy numeric,
    trained_at timestamptz DEFAULT now(),
    model_version integer NOT NULL DEFAULT 1,
    CONSTRAINT unique_feature_version UNIQUE (feature_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_score_coef_version ON public.score_model_coefficients(model_version);
CREATE INDEX IF NOT EXISTS idx_score_coef_subject ON public.score_model_coefficients(subject) WHERE subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.score_prediction_features_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    subject text NOT NULL,
    feature_name text NOT NULL,
    feature_value numeric NOT NULL,
    computed_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_subject_feature UNIQUE (user_id, subject, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_score_features_user ON public.score_prediction_features_cache(user_id);

-- ============================================================
-- 5. PIPELINE MONITORING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ml_pipeline_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name text NOT NULL,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    records_processed integer,
    errors text,
    metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_function ON public.ml_pipeline_runs(function_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON public.ml_pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_time ON public.ml_pipeline_runs(started_at DESC);

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

DO $$
BEGIN
  -- irt_calibration_queue
  ALTER TABLE public.irt_calibration_queue ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'irt_calibration_queue' AND policyname = 'irt_queue_select') THEN
    CREATE POLICY "irt_queue_select" ON public.irt_calibration_queue FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'irt_calibration_queue' AND policyname = 'irt_queue_write') THEN
    CREATE POLICY "irt_queue_write" ON public.irt_calibration_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- irt_item_parameters_history
  ALTER TABLE public.irt_item_parameters_history ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'irt_item_parameters_history' AND policyname = 'irt_history_select') THEN
    CREATE POLICY "irt_history_select" ON public.irt_item_parameters_history FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'irt_item_parameters_history' AND policyname = 'irt_history_write') THEN
    CREATE POLICY "irt_history_write" ON public.irt_item_parameters_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- bkt_kc_parameters
  ALTER TABLE public.bkt_kc_parameters ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bkt_kc_parameters' AND policyname = 'bkt_kc_select') THEN
    CREATE POLICY "bkt_kc_select" ON public.bkt_kc_parameters FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bkt_kc_parameters' AND policyname = 'bkt_kc_write') THEN
    CREATE POLICY "bkt_kc_write" ON public.bkt_kc_parameters FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- bkt_parameter_history
  ALTER TABLE public.bkt_parameter_history ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bkt_parameter_history' AND policyname = 'bkt_history_select') THEN
    CREATE POLICY "bkt_history_select" ON public.bkt_parameter_history FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bkt_parameter_history' AND policyname = 'bkt_history_write') THEN
    CREATE POLICY "bkt_history_write" ON public.bkt_parameter_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- agent_prompt_templates
  ALTER TABLE public.agent_prompt_templates ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_prompt_templates' AND policyname = 'prompt_template_select') THEN
    CREATE POLICY "prompt_template_select" ON public.agent_prompt_templates FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_prompt_templates' AND policyname = 'prompt_template_write') THEN
    CREATE POLICY "prompt_template_write" ON public.agent_prompt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- agent_correction_analysis
  ALTER TABLE public.agent_correction_analysis ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_correction_analysis' AND policyname = 'correction_analysis_select') THEN
    CREATE POLICY "correction_analysis_select" ON public.agent_correction_analysis FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_correction_analysis' AND policyname = 'correction_analysis_write') THEN
    CREATE POLICY "correction_analysis_write" ON public.agent_correction_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- score_model_coefficients
  ALTER TABLE public.score_model_coefficients ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'score_model_coefficients' AND policyname = 'score_coef_select') THEN
    CREATE POLICY "score_coef_select" ON public.score_model_coefficients FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'score_model_coefficients' AND policyname = 'score_coef_write') THEN
    CREATE POLICY "score_coef_write" ON public.score_model_coefficients FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- score_prediction_features_cache
  ALTER TABLE public.score_prediction_features_cache ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'score_prediction_features_cache' AND policyname = 'score_features_select') THEN
    CREATE POLICY "score_features_select" ON public.score_prediction_features_cache FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'score_prediction_features_cache' AND policyname = 'score_features_write') THEN
    CREATE POLICY "score_features_write" ON public.score_prediction_features_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- ml_pipeline_runs
  ALTER TABLE public.ml_pipeline_runs ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ml_pipeline_runs' AND policyname = 'pipeline_runs_select') THEN
    CREATE POLICY "pipeline_runs_select" ON public.ml_pipeline_runs FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ml_pipeline_runs' AND policyname = 'pipeline_runs_write') THEN
    CREATE POLICY "pipeline_runs_write" ON public.ml_pipeline_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

-- Mark pipeline run complete
CREATE OR REPLACE FUNCTION public.mark_pipeline_complete(
    p_run_id uuid,
    p_status text,
    p_records_processed integer DEFAULT NULL,
    p_errors text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE public.ml_pipeline_runs
    SET status = p_status,
        completed_at = now(),
        records_processed = p_records_processed,
        errors = p_errors
    WHERE id = p_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start pipeline run
CREATE OR REPLACE FUNCTION public.start_pipeline_run(p_function_name text)
RETURNS uuid AS $$
DECLARE
    v_run_id uuid;
BEGIN
    INSERT INTO public.ml_pipeline_runs (function_name, status)
    VALUES (p_function_name, 'running')
    RETURNING id INTO v_run_id;
    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enqueue question for IRT calibration
CREATE OR REPLACE FUNCTION public.enqueue_irt_calibration(p_question_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO public.irt_calibration_queue (question_id, status)
    VALUES (p_question_id, 'pending')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active BKT params for a KC (fallback to defaults)
CREATE OR REPLACE FUNCTION public.get_bkt_params(p_kc_id text)
RETURNS jsonb AS $$
DECLARE
    v_params jsonb;
BEGIN
    SELECT jsonb_build_object(
        'p_guess', COALESCE(p_guess, 0.2),
        'p_slip', COALESCE(p_slip, 0.1),
        'p_transit', COALESCE(p_transit, 0.2),
        'source', CASE WHEN p_guess IS NOT NULL THEN 'calibrated' ELSE 'default' END
    ) INTO v_params
    FROM public.bkt_kc_parameters
    WHERE kc_id = p_kc_id;

    RETURN COALESCE(v_params, jsonb_build_object(
        'p_guess', 0.2,
        'p_slip', 0.1,
        'p_transit', 0.2,
        'source', 'default'
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get latest score model version
CREATE OR REPLACE FUNCTION public.get_latest_score_model_version()
RETURNS integer AS $$
DECLARE
    v_version integer;
BEGIN
    SELECT MAX(model_version) INTO v_version
    FROM public.score_model_coefficients;
    RETURN COALESCE(v_version, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get score model coefficients
CREATE OR REPLACE FUNCTION public.get_score_model_coefficients(p_version integer DEFAULT NULL)
RETURNS TABLE(feature_name text, coefficient numeric, subject text, band_intercept numeric) AS $$
BEGIN
    RETURN QUERY
    SELECT
        smc.feature_name,
        smc.coefficient,
        smc.subject,
        smc.band_intercept
    FROM public.score_model_coefficients smc
    WHERE smc.model_version = COALESCE(p_version, (SELECT MAX(model_version) FROM public.score_model_coefficients));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. CRON SCHEDULES (enabled separately per environment)
-- ============================================================

-- IRT Calibration: Sunday 3am UTC
-- BKT Tuning: 1st of month 4am UTC
-- Agent Corrections Analysis: Daily 6am UTC
-- Score Model Retraining: 15th of month 4am UTC

-- NOTE: Cron jobs are created via migrations per environment
-- because ANON_KEY and SERVICE_ROLE vars differ per project.
-- See 20260501000000_ml_cron_schedules.sql for active schedules.
