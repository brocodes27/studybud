-- ============================================
-- Persistent user memory (agentic long-term KB)
-- Captures: communication style, preferences,
-- factual details, emotional cues, and
-- "where I left off" bookmarks.
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What kind of memory this is
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'preference',         -- "prefers morning study"
    'communication_style',-- "uses Hinglish", "likes bullet points"
    'factual',            -- "targeting JEE 2027", "lives in Pune"
    'emotional',          -- "feels anxious about Physics"
    'skill',              -- "strong at kinematics"
    'bookmark',           -- "left off on Rotational Dynamics Q3"
    'goal',               -- "wants 95%+ in boards"
    'other'
  )),

  -- Canonical key so duplicates collapse (e.g., "preferred_study_time", "target_exam")
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  context TEXT,                         -- optional extra detail (e.g., the sentence it came from)

  -- Confidence & freshness
  confidence NUMERIC DEFAULT 0.6,       -- 0..1, how sure Gemini is
  seen_count INTEGER DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source trail
  source TEXT DEFAULT 'chat',           -- chat | task_output | test_result | manual | ...
  source_id TEXT,                       -- e.g. chat_id or task_id
  extracted_from TEXT,                  -- short excerpt the memory was mined from

  -- Semantic retrieval
  embedding vector(768),                -- Gemini text-embedding-004 dim

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, memory_type, key)
);
CREATE INDEX IF NOT EXISTS idx_user_memory_user
  ON public.user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_type
  ON public.user_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_last_seen
  ON public.user_memory(user_id, last_seen_at DESC);
-- Semantic similarity index (IVFFLAT for speed).
-- Note: run `CREATE INDEX ... WITH (lists = 100)` once table has enough rows for best perf.
CREATE INDEX IF NOT EXISTS idx_user_memory_embedding
  ON public.user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memory' AND policyname='user_memory_select_own'
  ) THEN
    CREATE POLICY user_memory_select_own ON public.user_memory
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memory' AND policyname='user_memory_insert_own'
  ) THEN
    CREATE POLICY user_memory_insert_own ON public.user_memory
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memory' AND policyname='user_memory_update_own'
  ) THEN
    CREATE POLICY user_memory_update_own ON public.user_memory
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_memory' AND policyname='user_memory_delete_own'
  ) THEN
    CREATE POLICY user_memory_delete_own ON public.user_memory
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
-- ============================================
-- Semantic recall RPC: top-k by cosine similarity.
-- Falls back gracefully when embedding is NULL.
-- ============================================
CREATE OR REPLACE FUNCTION public.match_user_memory(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_match_count INTEGER DEFAULT 12,
  p_min_similarity NUMERIC DEFAULT 0.5,
  p_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  key TEXT,
  value TEXT,
  context TEXT,
  confidence NUMERIC,
  seen_count INTEGER,
  last_seen_at TIMESTAMPTZ,
  similarity NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.memory_type,
    m.key,
    m.value,
    m.context,
    m.confidence,
    m.seen_count,
    m.last_seen_at,
    (1 - (m.embedding <=> p_query_embedding))::NUMERIC AS similarity
  FROM public.user_memory m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
    AND (p_types IS NULL OR m.memory_type = ANY(p_types))
    AND (1 - (m.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
-- ============================================
-- Upsert-or-reinforce: if key exists, bump seen_count & last_seen_at
-- and refresh value/confidence. Otherwise insert.
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_user_memory(
  p_user_id UUID,
  p_memory_type TEXT,
  p_key TEXT,
  p_value TEXT,
  p_context TEXT DEFAULT NULL,
  p_confidence NUMERIC DEFAULT 0.6,
  p_source TEXT DEFAULT 'chat',
  p_source_id TEXT DEFAULT NULL,
  p_extracted_from TEXT DEFAULT NULL,
  p_embedding vector(768) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.user_memory (
    user_id, memory_type, key, value, context,
    confidence, source, source_id, extracted_from, embedding,
    seen_count, last_seen_at
  )
  VALUES (
    p_user_id, p_memory_type, p_key, p_value, p_context,
    p_confidence, p_source, p_source_id, p_extracted_from, p_embedding,
    1, NOW()
  )
  ON CONFLICT (user_id, memory_type, key) DO UPDATE
    SET value         = EXCLUDED.value,
        context       = COALESCE(EXCLUDED.context, public.user_memory.context),
        confidence    = GREATEST(public.user_memory.confidence, EXCLUDED.confidence),
        source        = EXCLUDED.source,
        source_id     = COALESCE(EXCLUDED.source_id, public.user_memory.source_id),
        extracted_from= COALESCE(EXCLUDED.extracted_from, public.user_memory.extracted_from),
        embedding     = COALESCE(EXCLUDED.embedding, public.user_memory.embedding),
        seen_count    = public.user_memory.seen_count + 1,
        last_seen_at  = NOW(),
        updated_at    = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
NOTIFY pgrst, 'reload schema';
