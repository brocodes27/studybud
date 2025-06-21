-- Add pabbly_subscription_id column to subscriptions table

-- First check if the column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'subscriptions'
        AND column_name = 'pabbly_subscription_id'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.subscriptions
        ADD COLUMN pabbly_subscription_id TEXT;
        
        -- Add a comment to the column
        COMMENT ON COLUMN public.subscriptions.pabbly_subscription_id IS 'The subscription ID from Pabbly payment system';
    END IF;
END
$$;