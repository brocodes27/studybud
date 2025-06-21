import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SubscriptionData {
  id: string;
  user_id: string;
  pabbly_subscription_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const isSubscriptionActive = () => {
    if (!subscription) return false;
    
    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const periodEnd = new Date(subscription.current_period_end);

    // Check if in trial period
    if (subscription.status === 'trial' && trialEnd && now < trialEnd) {
      return true;
    }

    // Check if active subscription
    if (subscription.status === 'active' && now < periodEnd) {
      return true;
    }

    // Check if cancelled but still in current period
    if (subscription.status === 'cancelled' && now < periodEnd) {
      return true;
    }

    return false;
  };

  const isPremiumUser = () => {
    return isSubscriptionActive();
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return 'none';
    return subscription.status;
  };

  const getDaysRemaining = () => {
    if (!subscription) return 0;
    
    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const periodEnd = new Date(subscription.current_period_end);

    if (subscription.status === 'trial' && trialEnd) {
      return Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return {
    subscription,
    loading,
    isSubscriptionActive,
    isPremiumUser,
    getSubscriptionStatus,
    getDaysRemaining,
    refetch: fetchSubscription
  };
}