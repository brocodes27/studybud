# PayPal Integration for International Users

This document explains the PayPal payment integration that allows users outside India to pay for subscriptions using PayPal with their local currency.

## Overview

The application now supports two payment providers:
- **Razorpay**: For users in India (INR payments)
- **PayPal**: For users outside India (USD, EUR, GBP, etc.)

## How It Works

### 1. Location Detection
The system automatically detects the user's location using the `ipapi.co` service:
- If the user is in India (`country_code === 'IN'`), they see Razorpay payment options
- If the user is outside India, they see PayPal payment options with their local currency

### 2. Currency and Pricing
- **India (Razorpay)**: ₹199/month
- **United States (PayPal)**: $3/month
- **Europe (PayPal)**: €2.50/month
- **Other countries (PayPal)**: $3/month (default)

### 3. Payment Flow

#### For Indian Users (Razorpay):
1. User clicks "Subscribe Now"
2. System creates a Razorpay subscription
3. User is redirected to Razorpay payment page
4. After successful payment, webhook updates subscription status

#### For International Users (PayPal):
1. User clicks "Subscribe Now"
2. System creates a PayPal subscription
3. User is redirected to PayPal approval page
4. After approval, PayPal webhook updates subscription status

## Backend Implementation

### 1. PayPal Edge Functions

#### `create-paypal-subscription/index.ts`
- Creates PayPal subscriptions for international users
- Handles different currencies and pricing
- Returns PayPal approval URL

#### `paypal-webhook/index.ts`
- Processes PayPal webhook events
- Updates subscription status in database
- Handles subscription activation and cancellation

### 2. Database Changes

Added new fields to the `subscriptions` table:
```sql
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'razorpay',
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
```

## Frontend Implementation

### 1. Payment Hook (`usePayment.ts`)
- Detects user location and sets appropriate payment provider
- Handles payment creation for both Razorpay and PayPal
- Provides unified interface for payment initiation

### 2. Updated Components
All components that previously used hardcoded Razorpay logic now use the `usePayment` hook:
- `App.tsx` - Main paywall
- `SmartNotifications.tsx`
- `SocialFeatures.tsx`
- `PracticeTestEngine.tsx`
- `AdvancedAnalytics.tsx`
- `FlashcardGenerator.tsx`

## Environment Variables

Add these environment variables to your Supabase project:

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  # Use https://api-m.paypal.com for production

# Frontend URL (for PayPal return/cancel URLs)
FRONTEND_URL=https://your-app-domain.com
```

## PayPal Setup

### 1. Create PayPal App
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Create a new app
3. Get your Client ID and Secret
4. Set up webhook endpoints

### 2. Create Subscription Plans
1. In PayPal Developer Dashboard, create subscription plans
2. Set up plans for different currencies (USD, EUR, etc.)
3. Update the plan IDs in the `create-paypal-subscription` function

### 3. Configure Webhooks
1. Set up webhook endpoint: `https://your-supabase-project.supabase.co/functions/v1/paypal-webhook`
2. Subscribe to these events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `PAYMENT.SALE.COMPLETED`

## Testing

### Sandbox Testing
1. Use PayPal sandbox environment for testing
2. Create sandbox accounts for testing payments
3. Test both successful and failed payment scenarios

### Production Deployment
1. Switch to PayPal production environment
2. Update environment variables
3. Test with real PayPal accounts

## Security Considerations

1. **Webhook Verification**: In production, implement proper webhook signature verification
2. **Environment Variables**: Keep PayPal credentials secure
3. **Error Handling**: Implement proper error handling for failed payments
4. **Logging**: Log payment events for debugging and monitoring

## Troubleshooting

### Common Issues

1. **Payment Not Processing**: Check PayPal webhook configuration
2. **Currency Issues**: Verify currency codes and pricing
3. **Webhook Failures**: Check Supabase function logs
4. **Location Detection**: Fallback to default payment method if detection fails

### Debug Steps

1. Check browser console for payment errors
2. Verify Supabase Edge Function logs
3. Test PayPal webhook endpoint
4. Verify environment variables are set correctly

## Future Enhancements

1. **More Payment Methods**: Add support for Stripe, Apple Pay, Google Pay
2. **Dynamic Pricing**: Implement region-based pricing
3. **Payment Analytics**: Track payment success rates by region
4. **Subscription Management**: Allow users to manage their subscriptions
5. **Refund Handling**: Implement automatic refund processing 