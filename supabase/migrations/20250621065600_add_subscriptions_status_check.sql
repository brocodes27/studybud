-- Add check constraint to subscriptions table for status field

-- First check if the constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'subscriptions_status_check'
    ) THEN
        -- Add the constraint if it doesn't exist
        ALTER TABLE public.subscriptions
        ADD CONSTRAINT subscriptions_status_check
        CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'pending'));
        
        -- Add a comment to the constraint
        COMMENT ON CONSTRAINT subscriptions_status_check ON public.subscriptions
        IS 'Ensures that status is one of the allowed values: active, cancelled, expired, trial, pending';
    END IF;
END
$$;