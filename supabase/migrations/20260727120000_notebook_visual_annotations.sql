-- Store AI-generated visual marks separately from immutable notebook scans.
ALTER TABLE public.grading_pages
  ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS annotation_review_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'grading_pages_annotation_review_status_check'
      AND conrelid = 'public.grading_pages'::regclass
  ) THEN
    ALTER TABLE public.grading_pages
      ADD CONSTRAINT grading_pages_annotation_review_status_check
      CHECK (annotation_review_status IN ('pending', 'review', 'approved'));
  END IF;
END $$;

-- Teachers must not receive general UPDATE access to grading_pages because that
-- would also let the browser rewrite the immutable storage_path and OCR text.
-- This narrow function updates only the two reviewable annotation columns.
DROP POLICY IF EXISTS grading_pages_teacher_update_annotations ON public.grading_pages;

CREATE OR REPLACE FUNCTION public.update_grading_page_annotations(
  p_page_id UUID,
  p_annotations JSONB,
  p_review_status TEXT
)
RETURNS public.grading_pages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page public.grading_pages;
  v_annotations JSONB := COALESCE(p_annotations, '[]'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_review_status NOT IN ('review', 'approved') THEN
    RAISE EXCEPTION 'Invalid annotation review status';
  END IF;

  IF jsonb_typeof(v_annotations) <> 'array' THEN
    RAISE EXCEPTION 'Annotations must be a JSON array';
  END IF;

  IF jsonb_array_length(v_annotations) > 80 THEN
    RAISE EXCEPTION 'Too many annotations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_annotations) AS entry(item)
    WHERE jsonb_typeof(item) <> 'object'
      OR COALESCE(item->>'id', '') = ''
      OR length(item->>'id') > 500
      OR COALESCE(item->>'kind', '') NOT IN ('underline', 'circle', 'comment', 'score', 'tick', 'strike')
      OR COALESCE(item->>'tone', '') NOT IN ('correct', 'incorrect', 'guidance')
      OR COALESCE(item->>'status', '') NOT IN ('suggested', 'approved')
      OR jsonb_typeof(item->'text') <> 'string'
      OR length(item->>'text') > 500
      OR CASE
          WHEN jsonb_typeof(item->'confidence') = 'number'
            THEN (item->>'confidence')::NUMERIC NOT BETWEEN 0 AND 1
          ELSE TRUE
        END
      OR CASE
          WHEN jsonb_typeof(item->'x') = 'number'
            AND jsonb_typeof(item->'width') = 'number'
            THEN (item->>'x')::NUMERIC < 0
              OR (item->>'width')::NUMERIC < 0.015
              OR (item->>'x')::NUMERIC + (item->>'width')::NUMERIC > 1
          ELSE TRUE
        END
      OR CASE
          WHEN jsonb_typeof(item->'y') = 'number'
            AND jsonb_typeof(item->'height') = 'number'
            THEN (item->>'y')::NUMERIC < 0
              OR (item->>'height')::NUMERIC < 0.015
              OR (item->>'y')::NUMERIC + (item->>'height')::NUMERIC > 1
          ELSE TRUE
        END
      OR CASE
          WHEN item ? 'question_number' THEN
            CASE
              WHEN jsonb_typeof(item->'question_number') = 'number'
                THEN (item->>'question_number')::NUMERIC <= 0
              ELSE TRUE
            END
          ELSE FALSE
        END
  ) THEN
    RAISE EXCEPTION 'One or more annotations are invalid';
  END IF;

  IF p_review_status = 'approved' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_annotations) AS entry(item)
    WHERE item->>'status' <> 'approved'
  ) THEN
    RAISE EXCEPTION 'Every annotation must be approved before approving the page';
  END IF;

  UPDATE public.grading_pages gp
  SET annotations = v_annotations,
      annotation_review_status = p_review_status
  WHERE gp.id = p_page_id
    AND EXISTS (
      SELECT 1
      FROM public.grading_sessions s
      WHERE s.id = gp.session_id
        AND s.teacher_id = auth.uid()
    )
  RETURNING gp.* INTO v_page;

  IF v_page.id IS NULL THEN
    RAISE EXCEPTION 'Grading page not found or access denied';
  END IF;

  RETURN v_page;
END;
$$;

REVOKE ALL ON FUNCTION public.update_grading_page_annotations(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_grading_page_annotations(UUID, JSONB, TEXT) TO authenticated;

COMMENT ON COLUMN public.grading_pages.annotations IS
  'Validated, normalized (0..1) visual grading overlays. The original scan remains unchanged.';
COMMENT ON COLUMN public.grading_pages.annotation_review_status IS
  'Teacher review state for AI-generated visual annotations.';
