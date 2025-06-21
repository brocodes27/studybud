-- Add check constraint to subscriptions table for status field

-- Drop the existing constraint if it exists to ensure it can be updated
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

-- Add the new constraint with all required statuses
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'pending'));

-- Add a comment to the constraint
COMMENT ON CONSTRAINT subscriptions_status_check ON public.subscriptions
IS 'Ensures that status is one of the allowed values: active, cancelled, expired, trial, pending';