import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PaymentData {
  currency: string;
  price: number;
  paymentProvider: 'razorpay' | 'paypal';
  isIndia: boolean;
}

export function usePayment() {
  const { user, session } = useAuth();
  const [paymentData, setPaymentData] = useState<PaymentData>({
    currency: 'INR',
    price: 199,
    paymentProvider: 'razorpay',
    isIndia: true
  });
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState<'razorpay' | 'paypal' | null>(null);

  // Detect user location and set payment method
  useEffect(() => {
    if (manualOverride) {
      console.log(`🔧 Manual override active: ${manualOverride}`);
      if (manualOverride === 'razorpay') {
        setPaymentData({
          currency: 'INR',
          price: 199,
          paymentProvider: 'razorpay',
          isIndia: true
        });
      } else {
        setPaymentData({
          currency: 'USD',
          price: 5,
          paymentProvider: 'paypal',
          isIndia: false
        });
      }
      return;
    }

    const detectLocation = async () => {
      try {
        console.log('🔍 Detecting user location...');
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        console.log('📍 Location data received:', data);
        
        // Check if we have valid country data
        if (data && data.country_code) {
          console.log('🌍 Country code:', data.country_code);
          
          if (data.country_code === 'IN') {
            // User is in India - use Razorpay
            console.log('🇮🇳 User detected in India - using Razorpay');
            setPaymentData({
              currency: 'INR',
              price: 199,
              paymentProvider: 'razorpay',
              isIndia: true
            });
          } else {
            // User is outside India - use PayPal
            console.log('🌎 User detected outside India - using PayPal');
            const currency = data?.currency || 'USD';
            const price = currency === 'USD' ? 5 : currency === 'EUR' ? 2.5 : 5;
            
            console.log(`💱 Currency: ${currency}, Price: ${price}`);
            
            setPaymentData({
              currency,
              price,
              paymentProvider: 'paypal',
              isIndia: false
            });
          }
        } else {
          // No country data - try to detect from other fields
          console.log('⚠️ No country_code found, trying alternative detection...');
          
          if (data?.country_name === 'India' || data?.country === 'India') {
            console.log('🇮🇳 India detected from country name - using Razorpay');
            setPaymentData({
              currency: 'INR',
              price: 199,
              paymentProvider: 'razorpay',
              isIndia: true
            });
          } else {
            console.log('🌎 Non-India location detected - using PayPal');
            const currency = data?.currency || 'USD';
            const price = currency === 'USD' ? 5 : currency === 'EUR' ? 2.5 : 5;
            
            setPaymentData({
              currency,
              price,
              paymentProvider: 'paypal',
              isIndia: false
            });
          }
        }
      } catch (error) {
        console.error('❌ Error detecting location:', error);
        // Default to PayPal for international users if detection fails
        console.log('🔄 Falling back to PayPal for international users');
        setPaymentData({
          currency: 'USD',
          price: 5,
          paymentProvider: 'paypal',
          isIndia: false
        });
      }
    };

    detectLocation();
  }, [manualOverride]);

  const setPaymentOverride = (override: 'razorpay' | 'paypal' | null) => {
    console.log(`🔧 Setting payment override: ${override}`);
    setManualOverride(override);
  };

  const createPayment = async () => {
    if (!user?.id || !user?.email || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    console.log('💳 Creating payment with provider:', paymentData.paymentProvider);
    console.log('💰 Payment details:', paymentData);
    console.log('🔧 Manual override:', manualOverride);

    setIsLoadingPayment(true);
    try {
      if (paymentData.paymentProvider === 'razorpay') {
        console.log('🔄 Creating Razorpay subscription...');
        // Create Razorpay subscription
        const response = await fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-razorpay-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            user_id: user.id, 
            email: user.email,
            plan_id: 'plan_QlYEtRWPX0ddUj' // Default Razorpay plan ID
          }),
        });

        const data = await response.json();
        console.log('📋 Razorpay response:', data);
        
        if (data.short_url) {
          setPaymentUrl(data.short_url);
          return data.short_url;
        } else {
          throw new Error(data.error || 'Failed to create Razorpay subscription');
        }
      } else {
        console.log('🔄 Creating PayPal subscription...');
        console.log('📡 PayPal endpoint: https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-paypal-subscription');
        
        // Create PayPal subscription
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

        console.log('📋 PayPal response status:', response.status);
        console.log('📋 PayPal response headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.json();
        console.log('📋 PayPal response data:', data);
        
        if (response.ok && data.approval_url) {
          console.log('✅ PayPal approval URL received:', data.approval_url);
          setPaymentUrl(data.approval_url);
          return data.approval_url;
        } else {
          console.error('❌ PayPal response error:', data);
          throw new Error(data.error || `PayPal request failed with status ${response.status}`);
        }
      }
    } catch (error) {
      console.error('❌ Payment creation error:', error);
      
      // If PayPal fails and we're trying to use PayPal, show a specific error
      if (paymentData.paymentProvider === 'paypal') {
        console.error('🚨 PayPal payment failed, this might be because:');
        console.error('1. PayPal Edge Function is not deployed');
        console.error('2. PayPal environment variables are not set');
        console.error('3. PayPal function has an error');
        
        // Don't fall back to Razorpay automatically - let the user know PayPal failed
        throw new Error(`PayPal payment failed: ${(error as Error).message}. Please check if PayPal functions are deployed.`);
      }
      
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
      alert('Failed to start payment. Please try again or contact support.');
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