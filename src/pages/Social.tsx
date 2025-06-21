import React from 'react';
import { SocialFeatures } from '../components/SocialFeatures';
import { PremiumGate } from '../components/PremiumGate';
import { useSubscription } from '../hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export function Social() {
  const { isPremiumUser } = useSubscription();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Social Learning</h1>
        <p className="text-gray-400 mt-2">Connect, compete, and learn together</p>
      </div>
      
      <PremiumGate
        feature="Social Learning Features"
        description="Join private study groups, compete on leaderboards, share achievements, and collaborate with fellow students to enhance your learning experience."
        onUpgrade={() => navigate('/subscription')}
      >
        <SocialFeatures />
      </PremiumGate>
    </div>
  );
}