-- EBML V1 Enforcement Layer: goal_materials, goal_task_states, adaptation_events

-- 1. goal_materials — links materials to goals with roles
CREATE TABLE IF NOT EXISTS public.goal_materials (
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user_added' CHECK (role IN ('primary','reference','diagnostic','user_added','template_seed')),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_materials_material ON public.goal_materials(material_id);
ALTER TABLE public.goal_materials ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_materials' AND policyname='goal_materials_select_own') THEN
    CREATE POLICY goal_materials_select_own ON public.goal_materials
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_materials' AND policyname='goal_materials_write_own') THEN
    CREATE POLICY goal_materials_write_own ON public.goal_materials
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_materials' AND policyname='goal_materials_service_all') THEN
    CREATE POLICY goal_materials_service_all ON public.goal_materials FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
-- 2. goal_task_states — enforcement layer for task lifecycle
CREATE TABLE IF NOT EXISTS public.goal_task_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL REFERENCES public.goal_prescriptions(id) ON DELETE CASCADE,
  task_id text NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('locked','ready','running','awaiting_evidence','graded','passed','failed','superseded')),
  required_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(prescription_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_task_states_goal ON public.goal_task_states(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_task_states_prescription ON public.goal_task_states(prescription_id);
ALTER TABLE public.goal_task_states ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_task_states' AND policyname='goal_task_states_select_own') THEN
    CREATE POLICY goal_task_states_select_own ON public.goal_task_states
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='goal_task_states' AND policyname='goal_task_states_service_all') THEN
    CREATE POLICY goal_task_states_service_all ON public.goal_task_states FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
-- 3. adaptation_events — audit trail for mastery loop decisions
CREATE TABLE IF NOT EXISTS public.adaptation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  trigger_evidence_id uuid REFERENCES public.evidence_items(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('correction_sprint','advance_difficulty','space_repetition','interleave','diagnose_more','retry_with_hint')),
  reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_prescription_id uuid REFERENCES public.goal_prescriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adaptation_events_goal ON public.adaptation_events(goal_id, created_at DESC);
ALTER TABLE public.adaptation_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='adaptation_events' AND policyname='adaptation_events_select_own') THEN
    CREATE POLICY adaptation_events_select_own ON public.adaptation_events
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.learning_goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='adaptation_events' AND policyname='adaptation_events_service_all') THEN
    CREATE POLICY adaptation_events_service_all ON public.adaptation_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'set_updated_at') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'goal_task_states_set_updated_at') THEN
      CREATE TRIGGER goal_task_states_set_updated_at BEFORE UPDATE ON public.goal_task_states FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
  END IF;
END $$;
