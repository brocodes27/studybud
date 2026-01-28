-- Migration: Create Knowledge Base for Semantic Memory
-- This table will store "chunks" of knowledge from chat and journal
-- It uses pgvector (assumed enabled in your Supabase project)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'chat', 'journal', 'research'
  embedding vector(1536), -- Standard size for OpenAI or Gemini embeddings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast similarity search
CREATE INDEX ON user_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE user_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge chunks"
  ON user_knowledge
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_user_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_type TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_knowledge.id,
    user_knowledge.content,
    user_knowledge.source_type,
    1 - (user_knowledge.embedding <=> query_embedding) AS similarity
  FROM user_knowledge
  WHERE user_knowledge.user_id = p_user_id
    AND 1 - (user_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
