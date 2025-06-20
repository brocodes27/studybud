import React, { useState, useEffect } from 'react';
import { Crown, Check, X, CreditCard, Calendar, AlertCircle, Zap, Star, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { format, addDays, differenceInDays } from 'date-fns';

interface SubscriptionData {
  id: string;
  user_id: string;
  razorpay_subscription_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  popular?: boolean;
  trialDays: number;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function SubscriptionManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const pricingPlans: PricingPlan[] = [
    {
      id: 'premium_monthly',
      name: 'Premium Monthly',
      price: 400,
      currency: 'INR',
      interval: 'monthly',
      trialDays: 7,
      popular: true,
      features: [
        'Unlimited AI Study Plans',
        'Advanced Analytics & Insights',
        'AI Flashcard Generation',
        'Practice Test Engine',
        'Study Groups & Social Features',
        'Smart Notifications',
        'Progress Tracking',
        'Priority Support',
        'Offline Access',
        'Export Study Materials'
      ]
    }
  ];

  useEffect(() => {
    if (user) {
      fetchSubscription();
      loadRazorpayScript();
    }
  }, [user]);

  const loadRazorpayScript = () => {
    if (window.Razorpay) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

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
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async (planId: string) => {
    setProcessingPayment(true);
    try {
      // Create subscription via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          user_email: user?.email,
          user_name: user?.user_metadata?.full_name || user?.email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const { subscription: razorpaySubscription, order } = await response.json();

      // Initialize Razorpay payment
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        subscription_id: razorpaySubscription.id,
        name: 'AI Study Planner',
        description: 'Premium Subscription',
        image: '/pwa-192x192.png',
        handler: async (response: any) => {
          try {
            // Verify payment and activate subscription
            const verifyResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-subscription`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error('Payment verification failed');
            }

            showToast('Subscription activated successfully! Welcome to Premium! 🎉', 'success');
            fetchSubscription();
          } catch (error) {
            console.error('Payment verification error:', error);
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: {
          email: user?.email,
          name: user?.user_metadata?.full_name || user?.email
        },
        theme: {
          color: '#3B82F6'
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Error creating subscription:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create subscription', 'error');
      setProcessingPayment(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) return;

    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          subscription_id: subscription.razorpay_subscription_id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      showToast('Subscription cancelled successfully', 'success');
      fetchSubscription();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showToast('Failed to cancel subscription', 'error');
    }
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return { status: 'none', text: 'No Subscription', color: 'text-gray-400' };

    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const periodEnd = new Date(subscription.current_period_end);

    if (subscription.status === 'trial' && trialEnd && now < trialEnd) {
      const daysLeft = differenceInDays(trialEnd, now);
      return { 
        status: 'trial', 
        text: `Trial (${daysLeft} days left)`, 
        color: 'text-blue-400',
        daysLeft 
      };
    }

    if (subscription.status === 'active') {
      const daysLeft = differenceInDays(periodEnd, now);
      return { 
        status: 'active', 
        text: `Active (${daysLeft} days left)`, 
        color: 'text-green-400',
        daysLeft 
      };
    }

    if (subscription.status === 'cancelled') {
      const daysLeft = differenceInDays(periodEnd, now);
      return { 
        status: 'cancelled', 
        text: `Cancelled (${daysLeft} days left)`, 
        color: 'text-yellow-400',
        daysLeft 
      };
    }

    return { status: 'expired', text: 'Expired', color: 'text-red-400' };
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

  const statusInfo = getSubscriptionStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-400" />
            Subscription Status
          </h3>
          {isSubscriptionActive() && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 rounded-full">
              <span className="text-white text-sm font-medium">Premium Active</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-xl border ${
            isSubscriptionActive() 
              ? 'border-green-500/30 bg-green-500/10' 
              : 'border-gray-700/50 bg-gray-800/50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className={`h-5 w-5 ${statusInfo.color}`} />
              <span className="font-semibold text-white">Status</span>
            </div>
            <p className={`text-sm ${statusInfo.color}`}>
              {statusInfo.text}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-white">Plan</span>
            </div>
            <p className="text-sm text-blue-400">
              {subscription ? 'Premium Monthly' : 'Free Plan'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-white">Next Billing</span>
            </div>
            <p className="text-sm text-purple-400">
              {subscription 
                ? format(new Date(subscription.current_period_end), 'MMM d, yyyy')
                : 'N/A'
              }
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          {!isSubscriptionActive() ? (
            <button
              onClick={() => setShowPricing(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
            >
              <Crown className="h-5 w-5" />
              Upgrade to Premium
            </button>
          ) : (
            subscription?.status === 'active' && (
              <button
                onClick={cancelSubscription}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
              >
                Cancel Subscription
              </button>
            )
          )}
        </div>

        {/* Trial/Subscription Benefits */}
        {isSubscriptionActive() && (
          <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="font-semibold text-yellow-400">Premium Benefits Active</span>
            </div>
            <p className="text-gray-300 text-sm">
              You have access to all premium features including unlimited AI study plans, advanced analytics, and priority support.
            </p>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      {showPricing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-8 border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Choose Your Plan</h3>
              <button
                onClick={() => setShowPricing(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`glass rounded-2xl p-6 border transition-all duration-200 ${
                    plan.popular 
                      ? 'border-blue-500/50 bg-blue-500/10 glow-blue' 
                      : 'border-gray-700/50'
                  }`}
                >
                  {plan.popular && (
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium mb-4 inline-block">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-white">{plan.name}</h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-blue-400">₹{plan.price}</span>
                        <span className="text-gray-400">/{plan.interval}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                        {plan.trialDays} Days Free Trial
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => createSubscription(plan.id)}
                    disabled={processingPayment}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {processingPayment ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Zap className="h-5 w-5" />
                        Start {plan.trialDays}-Day Free Trial
                      </div>
                    )}
                  </button>

                  <p className="text-center text-xs text-gray-500 mt-3">
                    No commitment. Cancel anytime during trial.
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="font-semibold text-white">Secure Payment</span>
              </div>
              <p className="text-gray-300 text-sm">
                Payments are processed securely through Razorpay. Your card details are never stored on our servers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feature Comparison */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <h4 className="text-lg font-bold text-white mb-6">Free vs Premium</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h5 className="font-semibold text-gray-300 flex items-center gap-2">
              <X className="h-5 w-5 text-red-400" />
              Free Plan
            </h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• 3 AI Study Plans per month</li>
              <li>• Basic progress tracking</li>
              <li>• Limited flashcards (50/month)</li>
              <li>• Basic practice tests</li>
              <li>• Community support</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h5 className="font-semibold text-yellow-400 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-400" />
              Premium Plan
            </h5>
            <ul className="space-y-2 text-sm text-green-400">
              <li>• Unlimited AI Study Plans</li>
              <li>• Advanced analytics & insights</li>
              <li>• Unlimited flashcards</li>
              <li>• Advanced practice tests</li>
              <li>• Study groups & social features</li>
              <li>• Smart notifications</li>
              <li>• Priority support</li>
              <li>• Offline access</li>
              <li>• Export capabilities</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}