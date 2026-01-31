-- Migration: Setup Questions Bank with Gemini Embeddings (768 dim)

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
