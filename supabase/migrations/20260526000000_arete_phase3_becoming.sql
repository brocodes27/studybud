-- ============================================
-- Arete Phase 3: Becoming Schema Upgrades
-- ============================================

-- 1. Upgrade arete_identities with 1-Year Vision and Identity Layers
ALTER TABLE public.arete_identities 
  ADD COLUMN IF NOT EXISTS one_year_vision TEXT,
  ADD COLUMN IF NOT EXISTS core_identity TEXT,
  ADD COLUMN IF NOT EXISTS current_identity TEXT,
  ADD COLUMN IF NOT EXISTS emerging_identity TEXT;
-- 2. Upgrade arete_growth_profiles with Mastery tracking and Graduation state
ALTER TABLE public.arete_growth_profiles
  ADD COLUMN IF NOT EXISTS mastery_domains TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mastery_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_graduated BOOLEAN NOT NULL DEFAULT false;
-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
