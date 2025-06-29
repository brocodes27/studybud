import React from 'react';
import { ProfileSettings } from '../components/ProfileSettings';

export function Profile() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
          <p className="text-gray-300">Manage your account information and preferences</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ProfileSettings />
          
          {/* Additional profile sections can be added here */}
          <div className="glass rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-bold text-white mb-4">Account Information</h3>
            <div className="space-y-4 text-gray-300">
              <p>This is where additional account management features can be added.</p>
              <p>For example:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Password change</li>
                <li>Email preferences</li>
                <li>Privacy settings</li>
                <li>Data export</li>
                <li>Account deletion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 