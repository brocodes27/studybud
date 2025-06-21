import React, { useState, useEffect } from 'react';
import { Crown, Check, X, CreditCard, Calendar, AlertCircle, Zap, Star, Shield, Sparkles, ExternalLink, Mail, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { format, addDays, differenceInDays } from 'date-fns';

interface SubscriptionData {
  id: string;
  user_id: string;
  pabbly_subscription_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial' | 'pending';
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
  pabblyLink: string;
}

export function SubscriptionManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const pricingPlans: PricingPlan[] = [
    {
      id: 'stubud_pro',
      name: 'STUBUD Pro',
      price: 400,
      currency: 'INR',
      interval: 'monthly',
      trialDays: 7,
      popular: true,
      pabblyLink: 'https://payments.pabbly.com/subscribe/68564aa2d0b4ddc94e168be6/stubud-pro',
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
      
      // Set up real-time subscription updates
      const subscription = supabase
        .channel('subscription_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Subscription updated:', payload);
          fetchSubscription();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
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
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async (plan: PricingPlan) => {
    setProcessingPayment(true);
    
    try {
      // Store user's subscription intent in the database
      const now = new Date();
      const trialEnd = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const periodEnd = new Date(trialEnd.getTime() + (30 * 24 * 60 * 60 * 1000));

      // Check for existing active/trial subscription
      const { data: existingSubscription, error: existingError } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', user?.id)
        .eq('plan_id', plan.id)
        .in('status', ['active', 'trial'])
        .single();

      if (existingSubscription) {
        showToast('You already have an active subscription to this plan.', 'info');
        return;
      }

      // Create or update a pending subscription record
      const { data: pendingSubscription, error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user?.id,
          plan_id: plan.id,
          status: 'pending',
          pabbly_subscription_id: 'pending_' + Date.now(), // Add a temporary ID until Pabbly provides the real one
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_end: trialEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id, plan_id' })
        .select()
        .single();

      if (error) throw error;

      // Store user profile information for Pabbly webhook identification
      await supabase
        .from('user_profiles')
        .upsert({
          id: user?.id,
          full_name: user?.user_metadata?.full_name || user?.email,
          notification_settings: { 
            subscription_intent: true,
            pending_subscription_id: pendingSubscription.id,
            plan_id: plan.id
          }
        });

      // Open Pabbly payment link with user information
      const pabblyUrl = new URL(plan.pabblyLink);
      pabblyUrl.searchParams.append('customer_email', user?.email || '');
      pabblyUrl.searchParams.append('customer_name', user?.user_metadata?.full_name || user?.email || '');
      if (!user?.id || !pendingSubscription.id) {
        showToast('Missing user ID or subscription ID for payment.', 'error');
        setProcessingPayment(false);
        return;
      }

      pabblyUrl.searchParams.append('user_id', user.id);
      pabblyUrl.searchParams.append('subscription_id', pendingSubscription.id);

      console.log('Opening Pabbly URL:', pabblyUrl.toString());
      window.open(pabblyUrl.toString(), '_blank');
      showToast('Redirecting to secure payment page. Your 7-day free trial will start after payment confirmation.', 'info');
      
      // Start polling for subscription updates
      startSubscriptionPolling(pendingSubscription.id);
      
    } catch (error) {
      console.error('Error creating subscription:', error);
      showToast('Failed to initiate subscription', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  const startSubscriptionPolling = (subscriptionId: string) => {
    let pollCount = 0;
    const maxPolls = 120; // Poll for 10 minutes (120 * 5 seconds)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        const { data: updatedSubscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .single();

        if (error) throw error;
        
        // Check if subscription was activated
        if (updatedSubscription && updatedSubscription.status !== 'pending') {
          clearInterval(pollInterval);
          setSubscription(updatedSubscription);
          
          if (updatedSubscription.status === 'trial' || updatedSubscription.status === 'active') {
            showToast('Payment confirmed! Your 7-day free trial has started! 🎉', 'success');
          }
          return;
        }
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          showToast('Payment verification is taking longer than expected. Your trial will be activated automatically once payment is confirmed.', 'info');
        }
      } catch (error) {
        console.error('Error polling subscription:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  const cancelSubscription = async () => {
    if (!subscription) return;

    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;

      showToast('Subscription cancelled successfully. Please also cancel your subscription in Pabbly to stop future payments.', 'success');
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

    if (subscription.status === 'pending') {
      return { 
        status: 'pending', 
        text: 'Payment Pending', 
        color: 'text-yellow-400'
      };
    }

    if (subscription.status === 'trial' && trialEnd && now < trialEnd) {
      const daysLeft = differenceInDays(trialEnd, now);
      return { 
        status: 'trial', 
        text: `Free Trial (${daysLeft} days left)`, 
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
              {subscription ? 'STUBUD Pro' : 'Free Plan'}
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
              Start 7-Day Free Trial
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
              <span className="font-semibold text-yellow-400">
                {subscription?.status === 'trial' ? '7-Day Free Trial Active' : 'Premium Benefits Active'}
              </span>
            </div>
            <p className="text-gray-300 text-sm">
              {subscription?.status === 'trial' 
                ? 'You have full access to all premium features during your free trial. You will be charged ₹400/month after the trial ends.'
                : 'You have access to all premium features including unlimited AI study plans, advanced analytics, and priority support.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Free Trial Information */}
      <div className="glass rounded-2xl p-6 border border-blue-500/30 bg-blue-500/10">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-blue-400" />
          <h4 className="font-semibold text-blue-400">7-Day Free Trial</h4>
        </div>
        <p className="text-gray-300 text-sm mb-4">
          Start your premium journey with a complete 7-day free trial. Experience all features before any charges apply.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <span className="text-gray-300">Start 7-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <span className="text-gray-300">Full premium access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <span className="text-gray-300">₹400/month after trial</span>
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      {showPricing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-8 border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Start Your Free Trial</h3>
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
                      <p className="text-sm text-gray-400 mt-1">after {plan.trialDays}-day free trial</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                        {plan.trialDays} Days FREE
                      </div>
                      <p className="text-xs text-gray-500 mt-1">No charges during trial</p>
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
                    onClick={() => createSubscription(plan)}
                    disabled={processingPayment}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processingPayment ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        <ExternalLink className="h-5 w-5" />
                        Start {plan.trialDays}-Day Free Trial
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-gray-500 mt-3">
                    Card required for trial • ₹{plan.price} charged after {plan.trialDays} days • Cancel anytime
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-green-400" />
                <span className="font-semibold text-white">Secure & Risk-Free</span>
              </div>
              <p className="text-gray-300 text-sm">
                Your 7-day free trial includes full access to all premium features. You can cancel anytime during the trial period with no charges. After the trial, you'll be charged ₹400/month.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Features */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <h4 className="text-lg font-bold text-white mb-6">Premium Features</h4>
        
        <div className="space-y-4">
          <h5 className="font-semibold text-yellow-400 flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" />
            STUBUD Pro - ₹400/month (7-day free trial)
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

      {/* Pabbly Integration Notice */}
      <div className="glass rounded-2xl p-6 border border-green-500/30 bg-green-500/10">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-green-400" />
          <h4 className="font-semibold text-green-400">Secure Payment Processing</h4>
        </div>
        <p className="text-gray-300 text-sm">
          Payments are securely processed through Pabbly. Your subscription will be automatically tracked and activated upon successful payment confirmation.
        </p>
      </div>
    </div>
  );
}