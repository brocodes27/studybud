import React from 'react';
import { Crown, Lock, Zap, Star } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

interface PremiumGateProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
  onUpgrade?: () => void;
}

export function PremiumGate({ children, feature, description, onUpgrade }: PremiumGateProps) {
  const { isPremiumUser, loading } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isPremiumUser()) {
    return <>{children}</>;
  }

  return (
    <div className="glass rounded-2xl p-8 border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 text-center">
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-4 rounded-2xl mb-6 inline-block glow-blue">
        <Crown className="h-12 w-12 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
        <Lock className="h-6 w-6 text-yellow-400" />
        Premium Feature
      </h3>
      
      <h4 className="text-xl font-semibold text-yellow-400 mb-3">{feature}</h4>
      
      {description && (
        <p className="text-gray-300 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-center gap-2 text-green-400">
          <Star className="h-5 w-5" />
          <span className="text-sm">7-day free trial available</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-blue-400">
          <Zap className="h-5 w-5" />
          <span className="text-sm">Cancel anytime</span>
        </div>
      </div>

      <button
        onClick={onUpgrade}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Start Free Trial
        </div>
      </button>

      <p className="text-xs text-gray-500 mt-4">
        Only ₹400/month after trial • No commitment
      </p>
    </div>
  );
}