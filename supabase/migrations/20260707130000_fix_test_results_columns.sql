-- Fix missing columns on pre-existing test_results table
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS test_name TEXT;
ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS test_date TIMESTAMPTZ DEFAULT NOW();
