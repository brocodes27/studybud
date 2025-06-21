import React from 'react';
import { SubscriptionManager } from '../components/SubscriptionManager';

export function Subscription() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Subscription</h1>
        <p className="text-gray-400 mt-2">Manage your premium subscription and billing</p>
      </div>
      <SubscriptionManager />
    </div>
  );
}