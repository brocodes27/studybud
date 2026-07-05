-- ============================================
-- Arete Phase 2.1: Add Love Tags Column
-- ============================================

ALTER TABLE public.arete_identities 
ADD COLUMN IF NOT EXISTS love_tags TEXT[] NOT NULL DEFAULT '{}';
NOTIFY pgrst, 'reload schema';
