-- Fix daily mission generation for classes that use custom_curriculum instead of coaching_templates.

DO $$
DECLARE
  v_member_col TEXT;
BEGIN
  SELECT column_name INTO v_member_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'class_members'
    AND column_name IN ('user_id', 'student_id')
  ORDER BY CASE column_name WHEN 'user_id' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_member_col IS NOT NULL THEN
    EXECUTE format($sql$
      UPDATE public.student_roadmaps sr
      SET
        scope = 'school',
        class_id = c.id,
        locked_by_school = TRUE,
        created_from = COALESCE(sr.created_from, 'join_class_backfill'),
        custom_overrides = CASE
          WHEN (sr.custom_overrides IS NULL OR sr.custom_overrides = '{}'::jsonb) AND c.custom_curriculum IS NOT NULL
          THEN c.custom_curriculum
          ELSE sr.custom_overrides
        END,
        updated_at = COALESCE(sr.updated_at, now())
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE sr.user_id = cm.%I
        AND (sr.class_id IS NULL OR sr.class_id = c.id)
        AND (
          sr.template_id = c.template_id
          OR (sr.template_id IS NULL AND c.custom_curriculum IS NOT NULL)
          OR (sr.institute_name = c.name)
        )
        AND (sr.scope IS DISTINCT FROM 'school' OR sr.class_id IS DISTINCT FROM c.id)
    $sql$, v_member_col);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_unified_weekly_schedule(p_user_id UUID)
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
BEGIN
  RETURN QUERY
  WITH roadmaps AS (
    SELECT sr.id, sr.template_id, sr.class_id, sr.custom_overrides
    FROM public.student_roadmaps sr
    WHERE sr.user_id = p_user_id
      AND (sr.scope = 'school' OR sr.class_id IS NOT NULL)
  ),
  schedule_sources AS (
    SELECT
      r.id AS roadmap_id,
      COALESCE(
        NULLIF(ct.weekly_schedule, '[]'::jsonb),
        CASE
          WHEN jsonb_typeof(c.custom_curriculum) = 'object' THEN c.custom_curriculum->'weekly_schedule'
          WHEN jsonb_typeof(c.custom_curriculum) = 'array' THEN c.custom_curriculum
          ELSE NULL
        END,
        CASE
          WHEN jsonb_typeof(r.custom_overrides) = 'object' THEN r.custom_overrides->'weekly_schedule'
          WHEN jsonb_typeof(r.custom_overrides) = 'array' THEN r.custom_overrides
          ELSE NULL
        END
      ) AS schedule
    FROM roadmaps r
    LEFT JOIN public.coaching_templates ct ON ct.id = r.template_id
    LEFT JOIN public.classes c ON c.id = r.class_id
  ),
  week_items AS (
    SELECT ss.roadmap_id, elem AS week_json
    FROM schedule_sources ss
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(ss.schedule) = 'array' THEN ss.schedule ELSE '[]'::jsonb END
    ) elem
  ),
  normalized AS (
    SELECT
      COALESCE((week_json->>'week')::INTEGER, 1) AS week,
      subject,
      topic,
      subtopics
    FROM week_items
    CROSS JOIN LATERAL (
      VALUES
        ('physics', week_json->'physics'),
        ('chemistry', week_json->'chemistry'),
        ('mathematics', COALESCE(week_json->'mathematics', week_json->'maths', week_json->'math'))
    ) AS subject_obj(subject, obj)
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(obj->>'topic', obj->>'title', obj->>'name') AS topic,
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(obj->'subtopics') = 'array' THEN obj->'subtopics' ELSE '[]'::jsonb END)),
          ARRAY[]::TEXT[]
        ) AS subtopics
      WHERE obj IS NOT NULL AND jsonb_typeof(obj) = 'object'
    ) parsed

    UNION ALL

    SELECT
      COALESCE((week_json->>'week')::INTEGER, 1) AS week,
      lower(replace(week_json->>'subject', ' ', '_')) AS subject,
      COALESCE(week_json->>'topic', week_json->>'title', week_json->>'name') AS topic,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(week_json->'subtopics') = 'array' THEN week_json->'subtopics' ELSE '[]'::jsonb END)),
        ARRAY[]::TEXT[]
      ) AS subtopics
    FROM week_items
    WHERE week_json ? 'subject'
  ),
  cleaned AS (
    SELECT
      week,
      CASE WHEN subject IN ('math', 'maths') THEN 'mathematics' ELSE subject END AS subject,
      topic,
      subtopics,
      ROW_NUMBER() OVER (PARTITION BY week, CASE WHEN subject IN ('math', 'maths') THEN 'mathematics' ELSE subject END ORDER BY topic) AS rn
    FROM normalized
    WHERE topic IS NOT NULL AND btrim(topic) <> ''
  )
  SELECT
    c.week,
    MAX(c.topic) FILTER (WHERE c.subject = 'physics' AND c.rn = 1) AS physics_topic,
    (ARRAY_AGG(c.subtopics) FILTER (WHERE c.subject = 'physics' AND c.rn = 1))[1] AS physics_subtopics,
    MAX(c.topic) FILTER (WHERE c.subject = 'chemistry' AND c.rn = 1) AS chemistry_topic,
    (ARRAY_AGG(c.subtopics) FILTER (WHERE c.subject = 'chemistry' AND c.rn = 1))[1] AS chemistry_subtopics,
    MAX(c.topic) FILTER (WHERE c.subject = 'mathematics' AND c.rn = 1) AS mathematics_topic,
    (ARRAY_AGG(c.subtopics) FILTER (WHERE c.subject = 'mathematics' AND c.rn = 1))[1] AS mathematics_subtopics
  FROM cleaned c
  GROUP BY c.week
  ORDER BY c.week;
END;
$$;
