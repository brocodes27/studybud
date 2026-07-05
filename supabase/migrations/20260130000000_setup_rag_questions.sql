-- Migration: Setup Questions Bank with Gemini Embeddings (768 dim)

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- Enable gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Create questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  question TEXT NOT NULL,
  marks INTEGER,
  type TEXT, -- 'mcq', 'short', 'long'
  options JSONB, -- For MCQs
  difficulty TEXT, -- 'Easy', 'Medium', 'Hard'
  embedding vector(768), -- Gemini text-embedding-004 dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Index for fast similarity search
CREATE INDEX IF NOT EXISTS questions_embedding_idx ON questions USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
-- Function for similarity search
-- NOTE: Postgres does not allow changing function return types via CREATE OR REPLACE.
-- We drop any existing overload(s) first to avoid "cannot change return type" errors.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'match_questions'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION match_questions (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_class text,
  filter_subject text
)
RETURNS SETOF questions
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM questions
  WHERE 1 - (questions.embedding <=> query_embedding) > match_threshold
  AND questions.class = filter_class
  AND questions.subject = filter_subject
  ORDER BY questions.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
