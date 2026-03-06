import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PaymentData {
  currency: string;
  price: number;
  paymentProvider: 'razorpay' | 'paypal' | 'dodo';
  isIndia: boolean;
}

export function usePayment() {
  const { user, session } = useAuth();
  const [paymentData, setPaymentData] = useState<PaymentData>({
    currency: 'USD',
    price: 15.99,
    paymentProvider: 'dodo',
    isIndia: false
  });
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState<'razorpay' | 'paypal' | 'dodo' | null>(null);

  // Detect user location and set payment method
  useEffect(() => {
    if (manualOverride) {
      console.log(`🔧 Manual override active: ${manualOverride}`);
      // Set simple defaults for overrides
      setPaymentData({
        currency: manualOverride === 'razorpay' ? 'INR' : 'USD',
        price: manualOverride === 'razorpay' ? 199 : 15.99,
        paymentProvider: manualOverride,
        isIndia: manualOverride === 'razorpay'
      });
      return;
    }

    // Default to Dodo Payments as requested
    setPaymentData({
      currency: 'USD',
      price: 15.99,
      paymentProvider: 'dodo',
      isIndia: false
    });

  }, [manualOverride]);

  const setPaymentOverride = (override: 'razorpay' | 'paypal' | 'dodo' | null) => {
    console.log(`🔧 Setting payment override: ${override}`);
    setManualOverride(override);
  };

  const createPayment = async () => {
    if (!user?.id || !user?.email || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    console.log('💳 Creating payment with provider:', paymentData.paymentProvider);
    setIsLoadingPayment(true);

    try {
      let finalUrl: string | undefined;

      if (paymentData.paymentProvider === 'dodo') {
        console.log('🦤 Initiating Dodo Payment...');
        const staticLink = import.meta.env.VITE_DODO_PAYMENT_LINK;
        if (staticLink) {
          finalUrl = `${staticLink}?prefilled_email=${encodeURIComponent(user.email)}`;
        } else {
          const response = await fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-dodo-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ user_id: user.id, email: user.email }),
          });
          const data = await response.json();
          if (response.ok && data.url) {
            finalUrl = data.url;
          } else {
            throw new Error(data.error || 'Failed to create Dodo payment session.');
          }
        }
      } else if (paymentData.paymentProvider === 'razorpay') {
        const response = await fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-razorpay-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: user.id, email: user.email, plan_id: 'plan_QlYEtRWPX0ddUj' }),
        });
        const data = await response.json();
        if (data.short_url) {
          finalUrl = data.short_url;
        } else {
          throw new Error(data.error || 'Failed to create Razorpay subscription');
        }
      } else {
        const response = await fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-paypal-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            currency: paymentData.currency,
            name: user.user_metadata?.full_name?.split(' ')[0] || 'User',
            surname: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'Name'
          }),
        });
        const data = await response.json();
        if (response.ok && data.approval_url) {
          finalUrl = data.approval_url;
        } else {
          throw new Error(data.error || `PayPal request failed`);
        }
      }

      if (finalUrl) {
        setPaymentUrl(finalUrl);
        return finalUrl;
      }
    } catch (error: any) {
      console.error('❌ Payment creation error:', error);
      throw error;
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const initiatePayment = async () => {
    try {
      const url = await createPayment();
      if (url) {
        console.log('🚀 Opening payment URL:', url);
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('❌ Payment initiation error:', error);
      alert('Failed to start payment. If you are the admin, please set VITE_DODO_PAYMENT_LINK in .env');
    }
  };

  return {
    paymentData,
    isLoadingPayment,
    paymentUrl,
    createPayment,
    initiatePayment,
    setPaymentOverride,
    manualOverride
  };
} 