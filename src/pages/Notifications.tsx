import React from 'react';
import { SmartNotifications } from '../components/SmartNotifications';

export function Notifications() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Smart Notifications</h1>
        <p className="text-gray-400 mt-2">Manage your study reminders and alerts</p>
      </div>
      <SmartNotifications />
    </div>
  );
}