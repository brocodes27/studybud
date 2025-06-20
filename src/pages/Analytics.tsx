import React from 'react';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { PremiumGate } from '../components/PremiumGate';
import { useSubscription } from '../hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export function Analytics() {
  const { isPremiumUser } = useSubscription();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Advanced Analytics</h1>
        <p className="text-gray-400 mt-2">AI-powered insights into your learning journey</p>
      </div>
      
      <PremiumGate
        feature="Advanced Analytics"
        description="Get AI-powered insights, detailed progress tracking, learning velocity analysis, and personalized recommendations to optimize your study performance."
        onUpgrade={() => navigate('/subscription')}
      >
        <AdvancedAnalytics />
      </PremiumGate>
    </div>
  );
}