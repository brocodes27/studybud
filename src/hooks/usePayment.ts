import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type CurvePlan = 'monthly' | 'semester';

/**
 * PaymentProvider facade (P0.6).
 *
 * Today only Dodo is wired (Phase 0), but Razorpay + PayPal integrations exist
 * in the repo and Stripe is a Phase 4 candidate. All checkout code must go
 * through the provider interface below — no component should ever call
 * `create-dodo-payment` (or any provider endpoint) directly after Phase 4.
 *
 * Selection rule (added in P4.4): region → provider. Until then, `activeProvider`
 * is hard-coded to 'dodo' to preserve behaviour exactly.
 */
export type PaymentProviderId = 'dodo' | 'razorpay' | 'paypal' | 'stripe';

export interface PaymentProvider {
  id: PaymentProviderId;
  /** Create a hosted checkout session; returns the URL to redirect/open. */
  createCheckout(input: {
    userId: string;
    email: string;
    plan: CurvePlan;
    accessToken: string;
  }): Promise<string>;
}

const dodoProvider: PaymentProvider = {
  id: 'dodo',
  async createCheckout({ userId, email, plan, accessToken }) {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-dodo-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: userId, email, plan }),
      },
    );
    const data: { url?: string; error?: string } = await response.json();
    if (response.ok && data.url) return data.url;
    throw new Error(data.error || 'Failed to create Dodo payment session.');
  },
};

/** Active provider for this cohort. Becomes region-driven in P4.4. */
export const activeProvider: PaymentProvider = dodoProvider;

export function usePayment() {
  const { user, session } = useAuth();
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const createPayment = async (plan: CurvePlan = 'semester') => {
    if (!user?.id || !user?.email || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    setIsLoadingPayment(true);

    try {
      const url = await activeProvider.createCheckout({
        userId: user.id,
        email: user.email,
        plan,
        accessToken: session.access_token,
      });
      setPaymentUrl(url);
      return url;
    } catch (error: any) {
      console.error('Payment creation error:', error);
      throw error;
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const initiatePayment = async (plan: CurvePlan = 'semester') => {
    try {
      const url = await createPayment(plan);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      alert('Payment setup failed. Please contact support.');
    }
  };

  return {
    isLoadingPayment,
    paymentUrl,
    createPayment,
    initiatePayment,
  };
}
