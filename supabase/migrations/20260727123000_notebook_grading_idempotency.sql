-- Make notebook grading safe against repeated commands, agent restarts, and
-- concurrent edge-function invocations.
ALTER TABLE public.grading_sessions
  ADD COLUMN IF NOT EXISTS grading_run_token UUID,
  ADD COLUMN IF NOT EXISTS grading_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_command_seq INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_command_seq INTEGER,
  ADD COLUMN IF NOT EXISTS active_command TEXT,
  ADD COLUMN IF NOT EXISTS command_run_token UUID,
  ADD COLUMN IF NOT EXISTS command_started_at TIMESTAMPTZ;

ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS grading_session_id UUID
    REFERENCES public.grading_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_results_grading_session_unique
  ON public.test_results(grading_session_id)
  WHERE grading_session_id IS NOT NULL;

-- Replace broad teacher mutation access with a narrow command dispatcher.
DROP POLICY IF EXISTS grading_sessions_teacher_all ON public.grading_sessions;

DROP POLICY IF EXISTS grading_sessions_teacher_select ON public.grading_sessions;
CREATE POLICY grading_sessions_teacher_select ON public.grading_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS grading_sessions_teacher_insert ON public.grading_sessions;
CREATE POLICY grading_sessions_teacher_insert ON public.grading_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE OR REPLACE FUNCTION public.send_grading_session_command(
  p_session_id UUID,
  p_command TEXT
)
RETURNS public.grading_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.grading_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_command NOT IN ('capture_page', 'retake_last', 'start_checking', 'resume', 'pause') THEN
    RAISE EXCEPTION 'Invalid grading command';
  END IF;

  SELECT *
  INTO v_session
  FROM public.grading_sessions
  WHERE id = p_session_id
    AND teacher_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grading session not found or access denied';
  END IF;

  IF v_session.status IN ('graded', 'cancelled') THEN
    RAISE EXCEPTION 'Completed grading sessions are read-only';
  END IF;

  IF p_command = 'pause' AND v_session.status <> 'capturing' THEN
    RAISE EXCEPTION 'Only a capturing session can be paused';
  END IF;

  IF p_command = 'resume' AND v_session.status NOT IN ('paused', 'failed') THEN
    RAISE EXCEPTION 'Only a paused or failed session can be resumed';
  END IF;

  IF p_command = 'start_checking' AND v_session.status NOT IN ('capturing', 'failed') THEN
    RAISE EXCEPTION 'This session cannot start checking';
  END IF;

  IF p_command IN ('capture_page', 'retake_last')
    AND v_session.status NOT IN ('capturing', 'failed') THEN
    RAISE EXCEPTION 'Pages can only be changed before checking starts';
  END IF;

  UPDATE public.grading_sessions
  SET command = p_command,
      command_seq = command_seq + 1
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.send_grading_session_command(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_grading_session_command(UUID, TEXT) TO authenticated;

-- Atomically acquire a grading lease. A stale lease can be reclaimed after
-- thirty minutes; the unique result key below remains the final duplicate guard.
CREATE OR REPLACE FUNCTION public.claim_notebook_grading(
  p_session_id UUID,
  p_run_token UUID
)
RETURNS public.grading_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.grading_sessions;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT *
  INTO v_session
  FROM public.grading_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grading session not found';
  END IF;

  IF v_session.status = 'graded' THEN
    RETURN v_session;
  END IF;

  IF v_session.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled sessions cannot be graded';
  END IF;

  IF v_session.grading_run_token IS NOT NULL
    AND v_session.grading_started_at >= NOW() - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'Grading is already in progress' USING ERRCODE = '55P03';
  END IF;

  UPDATE public.grading_sessions
  SET status = 'checking',
      grading_run_token = p_run_token,
      grading_started_at = NOW(),
      error_message = NULL
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notebook_grading(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notebook_grading(UUID, UUID) TO service_role;

-- Serialize physical-device commands across duplicate agents. Callers retry
-- "busy" claims; a crashed command lease can be reclaimed after thirty minutes.
CREATE OR REPLACE FUNCTION public.claim_grading_command(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_command TEXT,
  p_run_token UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.grading_sessions;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT *
  INTO v_session
  FROM public.grading_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;

  IF v_session.status IN ('graded', 'cancelled') THEN
    RETURN 'read_only';
  END IF;

  IF v_session.handled_command_seq >= p_command_seq THEN
    RETURN 'handled';
  END IF;

  IF v_session.command_seq <> p_command_seq
    OR v_session.command IS DISTINCT FROM p_command THEN
    RETURN 'superseded';
  END IF;

  IF p_command NOT IN ('capture_page', 'retake_last', 'start_checking', 'resume', 'pause') THEN
    RETURN 'invalid_command';
  END IF;

  IF v_session.command_run_token IS NOT NULL
    AND v_session.command_started_at >= NOW() - INTERVAL '30 minutes' THEN
    RETURN 'busy';
  END IF;

  IF p_command = 'pause' AND v_session.status <> 'capturing'
    OR p_command = 'resume' AND v_session.status NOT IN ('paused', 'failed')
    OR p_command = 'start_checking' AND v_session.status NOT IN ('capturing', 'failed')
    OR p_command IN ('capture_page', 'retake_last')
      AND v_session.status NOT IN ('capturing', 'failed') THEN
    RETURN 'invalid_state';
  END IF;

  UPDATE public.grading_sessions
  SET active_command_seq = p_command_seq,
      active_command = p_command,
      command_run_token = p_run_token,
      command_started_at = NOW()
  WHERE id = p_session_id;

  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_grading_command(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_run_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.grading_sessions
  SET handled_command_seq = GREATEST(handled_command_seq, p_command_seq),
      active_command_seq = NULL,
      active_command = NULL,
      command_run_token = NULL,
      command_started_at = NULL
  WHERE id = p_session_id
    AND active_command_seq = p_command_seq
    AND command_run_token = p_run_token;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_grading_command(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_grading_command(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_grading_command(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_grading_command(UUID, INTEGER, UUID) TO service_role;

-- Fence every command-side database mutation to the command lease. Captures
-- upload to token-specific storage paths first; a stale worker therefore
-- cannot overwrite the current page even if it resumes after lease expiry.
CREATE OR REPLACE FUNCTION public.commit_grading_page_capture(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_run_token UUID,
  p_page_number INTEGER,
  p_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  PERFORM 1
  FROM public.grading_sessions s
  WHERE s.id = p_session_id
    AND s.active_command_seq = p_command_seq
    AND s.command_run_token = p_run_token
    AND s.status IN ('capturing', 'failed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The command lease was lost before committing the captured page';
  END IF;

  INSERT INTO public.grading_pages (session_id, page_number, storage_path)
  VALUES (p_session_id, p_page_number, p_storage_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_grading_page_retake(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_run_token UUID,
  p_page_id UUID,
  p_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  PERFORM 1
  FROM public.grading_sessions s
  WHERE s.id = p_session_id
    AND s.active_command_seq = p_command_seq
    AND s.command_run_token = p_run_token
    AND s.status IN ('capturing', 'failed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The command lease was lost before committing the retaken page';
  END IF;

  UPDATE public.grading_pages gp
  SET storage_path = p_storage_path,
      ocr_text = NULL,
      annotations = '[]'::jsonb,
      annotation_review_status = 'pending'
  WHERE gp.id = p_page_id
    AND gp.session_id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The grading page no longer exists';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_grading_session_command(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_run_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.grading_sessions
  SET status = 'paused'
  WHERE id = p_session_id
    AND active_command_seq = p_command_seq
    AND command_run_token = p_run_token
    AND status = 'capturing';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The command lease was lost before pausing the session';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_grading_session_command(
  p_session_id UUID,
  p_command_seq INTEGER,
  p_run_token UUID,
  p_error_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.grading_sessions
  SET status = 'failed',
      error_message = LEFT(COALESCE(p_error_message, 'Grader command failed'), 2000)
  WHERE id = p_session_id
    AND active_command_seq = p_command_seq
    AND command_run_token = p_run_token
    AND status NOT IN ('graded', 'cancelled');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_grading_page_capture(UUID, INTEGER, UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_grading_page_retake(UUID, INTEGER, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pause_grading_session_command(UUID, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_grading_session_command(UUID, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_grading_page_capture(UUID, INTEGER, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_grading_page_retake(UUID, INTEGER, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.pause_grading_session_command(UUID, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_grading_session_command(UUID, INTEGER, UUID, TEXT) TO service_role;

-- Every AI page write verifies the active grading lease in the same database
-- statement, so a reclaimed stale run cannot overwrite the current run.
CREATE OR REPLACE FUNCTION public.set_notebook_page_ocr(
  p_page_id UUID,
  p_run_token UUID,
  p_ocr_text TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  PERFORM 1
  FROM public.grading_sessions s
  JOIN public.grading_pages gp ON gp.session_id = s.id
  WHERE gp.id = p_page_id
    AND s.grading_run_token = p_run_token
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The grading lease was lost before the OCR write';
  END IF;

  UPDATE public.grading_pages
  SET ocr_text = p_ocr_text
  WHERE id = p_page_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_notebook_page_annotations(
  p_page_id UUID,
  p_run_token UUID,
  p_annotations JSONB,
  p_review_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  IF jsonb_typeof(COALESCE(p_annotations, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_annotations, '[]'::jsonb)) > 80
    OR p_review_status NOT IN ('pending', 'review') THEN
    RAISE EXCEPTION 'Invalid service annotation update';
  END IF;

  PERFORM 1
  FROM public.grading_sessions s
  JOIN public.grading_pages gp ON gp.session_id = s.id
  WHERE gp.id = p_page_id
    AND s.grading_run_token = p_run_token
  FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The grading lease was lost before the annotation write';
  END IF;

  UPDATE public.grading_pages
  SET annotations = COALESCE(p_annotations, '[]'::jsonb),
      annotation_review_status = p_review_status
  WHERE id = p_page_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_notebook_page_ocr(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_notebook_page_annotations(UUID, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_notebook_page_ocr(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_notebook_page_annotations(UUID, UUID, JSONB, TEXT) TO service_role;

-- Check the grading lease and create/reuse the durable result in one
-- transaction. The session row lock prevents a lease handoff mid-insert.
CREATE OR REPLACE FUNCTION public.create_notebook_test_result(
  p_session_id UUID,
  p_run_token UUID,
  p_roadmap_id UUID,
  p_score_obtained INTEGER,
  p_score_total INTEGER,
  p_weak_topics JSONB
)
RETURNS TABLE(result_id UUID, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.grading_sessions;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT *
  INTO v_session
  FROM public.grading_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.grading_run_token IS DISTINCT FROM p_run_token THEN
    RAISE EXCEPTION 'The grading lease was lost before creating the test result';
  END IF;

  IF v_session.student_user_id IS NULL THEN
    RAISE EXCEPTION 'This grading session has no student';
  END IF;

  INSERT INTO public.test_results (
    user_id,
    roadmap_id,
    class_id,
    test_name,
    test_date,
    score_obtained,
    score_total,
    weak_topics,
    status,
    grading_session_id
  )
  VALUES (
    v_session.student_user_id,
    p_roadmap_id,
    v_session.class_id,
    COALESCE(NULLIF(v_session.test_name, ''), 'Notebook Check'),
    NOW(),
    p_score_obtained,
    p_score_total,
    COALESCE(p_weak_topics, '[]'::jsonb),
    'analyzed',
    p_session_id
  )
  ON CONFLICT (grading_session_id) WHERE grading_session_id IS NOT NULL
  DO NOTHING
  RETURNING id, TRUE INTO result_id, created;

  IF result_id IS NULL THEN
    SELECT tr.id, FALSE
    INTO result_id, created
    FROM public.test_results tr
    WHERE tr.grading_session_id = p_session_id;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notebook_test_result(UUID, UUID, UUID, INTEGER, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notebook_test_result(UUID, UUID, UUID, INTEGER, INTEGER, JSONB) TO service_role;

COMMENT ON COLUMN public.grading_sessions.grading_run_token IS
  'Service-only lease token that prevents concurrent notebook grading runs.';
COMMENT ON COLUMN public.grading_sessions.command_run_token IS
  'Service-only lease token that serializes physical grader commands.';
COMMENT ON COLUMN public.test_results.grading_session_id IS
  'Durable idempotency key: at most one student result per notebook grading session.';
