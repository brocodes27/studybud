-- Add payment provider and subscription ID fields to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'razorpay',
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
