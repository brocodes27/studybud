-- Add trial fields to user_profiles if not already present
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS trial_active BOOLEAN DEFAULT true;
