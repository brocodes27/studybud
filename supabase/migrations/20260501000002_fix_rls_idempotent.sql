-- Fix idempotent policy creation for unified_student_intelligence_layer
-- The original migration assumed tables/policies didn't exist. They may partially exist.

DO $$
BEGIN
  -- student_topic_mastery
  ALTER TABLE public.student_topic_mastery ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_topic_mastery' AND policyname = 'topic_mastery_select_own') THEN
    CREATE POLICY "topic_mastery_select_own" ON public.student_topic_mastery FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_topic_mastery' AND policyname = 'topic_mastery_select_teacher') THEN
    CREATE POLICY "topic_mastery_select_teacher" ON public.student_topic_mastery
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_topic_mastery.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_topic_mastery' AND policyname = 'topic_mastery_modify_service') THEN
    CREATE POLICY "topic_mastery_modify_service" ON public.student_topic_mastery FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- student_misconceptions
  ALTER TABLE public.student_misconceptions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_misconceptions' AND policyname = 'misconceptions_select_own') THEN
    CREATE POLICY "misconceptions_select_own" ON public.student_misconceptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_misconceptions' AND policyname = 'misconceptions_select_teacher') THEN
    CREATE POLICY "misconceptions_select_teacher" ON public.student_misconceptions
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_misconceptions.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_misconceptions' AND policyname = 'misconceptions_modify_service') THEN
    CREATE POLICY "misconceptions_modify_service" ON public.student_misconceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- student_learning_velocity
  ALTER TABLE public.student_learning_velocity ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_learning_velocity' AND policyname = 'velocity_select_own') THEN
    CREATE POLICY "velocity_select_own" ON public.student_learning_velocity FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_learning_velocity' AND policyname = 'velocity_select_teacher') THEN
    CREATE POLICY "velocity_select_teacher" ON public.student_learning_velocity
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_learning_velocity.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_learning_velocity' AND policyname = 'velocity_modify_service') THEN
    CREATE POLICY "velocity_modify_service" ON public.student_learning_velocity FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- student_avoidance_patterns
  ALTER TABLE public.student_avoidance_patterns ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_avoidance_patterns' AND policyname = 'avoidance_select_own') THEN
    CREATE POLICY "avoidance_select_own" ON public.student_avoidance_patterns FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_avoidance_patterns' AND policyname = 'avoidance_select_teacher') THEN
    CREATE POLICY "avoidance_select_teacher" ON public.student_avoidance_patterns
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_avoidance_patterns.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_avoidance_patterns' AND policyname = 'avoidance_modify_service') THEN
    CREATE POLICY "avoidance_modify_service" ON public.student_avoidance_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- student_twin_snapshots
  ALTER TABLE public.student_twin_snapshots ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_snapshots' AND policyname = 'twin_select_own') THEN
    CREATE POLICY "twin_select_own" ON public.student_twin_snapshots FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_snapshots' AND policyname = 'twin_select_teacher') THEN
    CREATE POLICY "twin_select_teacher" ON public.student_twin_snapshots
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_twin_snapshots.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_snapshots' AND policyname = 'twin_modify_service') THEN
    CREATE POLICY "twin_modify_service" ON public.student_twin_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- student_twin_summaries
  ALTER TABLE public.student_twin_summaries ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_summaries' AND policyname = 'summary_select_own') THEN
    CREATE POLICY "summary_select_own" ON public.student_twin_summaries FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_summaries' AND policyname = 'summary_select_teacher') THEN
    CREATE POLICY "summary_select_teacher" ON public.student_twin_summaries
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = student_twin_summaries.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'student_twin_summaries' AND policyname = 'summary_modify_service') THEN
    CREATE POLICY "summary_modify_service" ON public.student_twin_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- task_rationales
  ALTER TABLE public.task_rationales ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_rationales' AND policyname = 'rationale_select_own') THEN
    CREATE POLICY "rationale_select_own" ON public.task_rationales FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_rationales' AND policyname = 'rationale_select_teacher') THEN
    CREATE POLICY "rationale_select_teacher" ON public.task_rationales
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.classes c
          JOIN public.student_roadmaps sr ON sr.class_id = c.id
          WHERE sr.user_id = task_rationales.user_id AND c.teacher_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_rationales' AND policyname = 'rationale_modify_service') THEN
    CREATE POLICY "rationale_modify_service" ON public.task_rationales FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
