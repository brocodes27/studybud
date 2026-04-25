import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function usePayment() {
  const { user, session } = useAuth();
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const createPayment = async () => {
    if (!user?.id || !user?.email || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    setIsLoadingPayment(true);

    try {
      let finalUrl: string | undefined;

      const staticLink = import.meta.env.VITE_DODO_PAYMENT_LINK;
      if (staticLink) {
        finalUrl = `${staticLink}?prefilled_email=${encodeURIComponent(user.email)}`;
      } else {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-dodo-payment`, {
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
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('❌ Payment initiation error:', error);
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