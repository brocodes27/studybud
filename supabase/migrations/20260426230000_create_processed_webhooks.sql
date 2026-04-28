-- Create table for idempotent webhook processing
CREATE TABLE IF NOT EXISTS processed_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK (source IN ('dodo', 'paypal', 'razorpay')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT,
    payload JSONB
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event_id ON processed_webhooks(event_id);

-- RLS: disable for service role access from edge functions
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processed_webhooks'
      AND policyname = 'Allow service role full access'
  ) THEN
    EXECUTE 'DROP POLICY "Allow service role full access" ON public.processed_webhooks';
  END IF;
END $$;

CREATE POLICY "Allow service role full access" ON processed_webhooks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
