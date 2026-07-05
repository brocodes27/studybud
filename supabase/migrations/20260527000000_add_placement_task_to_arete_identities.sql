-- ============================================
-- Arete Skill Placement: Dynamic Placement Task
-- ============================================

-- 1. Add placement_task JSONB column to arete_identities
ALTER TABLE public.arete_identities 
  ADD COLUMN IF NOT EXISTS placement_task JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
