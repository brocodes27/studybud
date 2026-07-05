-- Phase 1: get_unified_weekly_schedule RPC
-- Merges weekly schedules across all school-scope roadmaps for a user.

DO $$ BEGIN
  CREATE TYPE pipeline_health_status AS ENUM ('never_run', 'stale', 'healthy');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
CREATE OR REPLACE FUNCTION get_unified_weekly_schedule(p_user_id UUID)
RETURNS TABLE (
  week INTEGER,
  physics_topic TEXT,
  physics_subtopics TEXT[],
  chemistry_topic TEXT,
  chemistry_subtopics TEXT[],
  mathematics_topic TEXT,
  mathematics_subtopics TEXT[]
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  roadmap_ids UUID[];
BEGIN
  -- Collect all school-scope roadmap IDs for this user
  SELECT array_agg(id) INTO roadmap_ids
  FROM student_roadmaps
  WHERE user_id = p_user_id AND scope = 'school';

  IF roadmap_ids IS NULL OR array_length(roadmap_ids, 1) IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, NULL::TEXT[], NULL::TEXT, NULL::TEXT[], NULL::TEXT, NULL::TEXT[] LIMIT 0;
    RETURN;
  END IF;

  RETURN QUERY
  WITH all_schedules AS (
    SELECT ct.weekly_schedule
    FROM student_roadmaps sr
    JOIN coaching_templates ct ON ct.id = sr.template_id
    WHERE sr.id = ANY(roadmap_ids)
  ),
  merged AS (
    SELECT (sched->>'week')::INTEGER AS week,
           lower(replace((sched->>'subject')::TEXT, ' ', '_')) AS subject,
           (sched->>'topic')::TEXT AS topic,
           (sched->>'subtopics')::TEXT[] AS subtopics
    FROM all_schedules, jsonb_array_elements(all_schedules.weekly_schedule) AS sched
  ),
  grouped AS (
    SELECT week,
           subject,
           topic,
           subtopics,
           ROW_NUMBER() OVER (PARTITION BY week, subject ORDER BY (SELECT NULL)) AS rn
    FROM merged
  ),
  pivoted AS (
    SELECT week,
           MAX(CASE WHEN subject = 'physics' THEN topic END) AS physics_topic,
           MAX(CASE WHEN subject = 'physics' THEN subtopics END) AS physics_subtopics,
           MAX(CASE WHEN subject = 'chemistry' THEN topic END) AS chemistry_topic,
           MAX(CASE WHEN subject = 'chemistry' THEN subtopics END) AS chemistry_subtopics,
           MAX(CASE WHEN subject = 'mathematics' THEN topic END) AS mathematics_topic,
           MAX(CASE WHEN subject = 'mathematics' THEN subtopics END) AS mathematics_subtopics
    FROM grouped
    WHERE rn = 1
    GROUP BY week
  )
  SELECT * FROM pivoted ORDER BY week;
END;
$$;
-- RLS for get_unified_weekly_schedule
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'get_unified_weekly_schedule_owner'
  ) THEN
    CREATE POLICY get_unified_weekly_schedule_owner
    ON student_roadmaps FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;
-- Phase 2: class_session_bpp table for BPP tracking
CREATE TABLE IF NOT EXISTS class_session_bpp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id UUID NOT NULL REFERENCES class_attendance_sessions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes INTEGER,
  processed BOOLEAN NOT NULL DEFAULT false,
  question_count INTEGER,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
-- BPP storage policies (curriculums bucket already exists, we need bpp/ subfolder policy)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'class_session_bpp_owner_all'
  ) THEN
    CREATE POLICY class_session_bpp_owner_all
    ON class_session_bpp FOR ALL
    TO authenticated
    USING (created_by = auth.uid() OR created_by IN (
      SELECT cas.teacher_id FROM class_attendance_sessions cas
      WHERE cas.id = class_session_bpp.class_session_id
    ));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'class_session_bpp_select_own'
  ) THEN
    CREATE POLICY class_session_bpp_select_own
    ON class_session_bpp FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
-- Add source_type = 'bpp' support to question_metadata (already exists as valid value)
-- Add bpp_session_id to question_metadata (optional FK, allows BPP questions to link back)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'question_metadata' AND column_name = 'bpp_session_id'
  ) THEN
    ALTER TABLE question_metadata ADD COLUMN bpp_session_id UUID;
  END IF;
END $$;
