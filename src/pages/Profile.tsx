import React from 'react';
import { ProfileSettings } from '../components/ProfileSettings';
import { User, Shield, Bell, Key, Download, Trash2 } from 'lucide-react';

export function Profile() {
  return (
    <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <div className="bg-gradient-to-br from-neon-blue to-blue-600 p-3 rounded-xl shadow-lg shadow-neon-blue/20">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
            <p className="text-gray-400">Manage your account information and preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ProfileSettings />
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-neon-green" />
                Account Security
              </h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/5 hover:bg-slate-800/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-gray-400 group-hover:text-white" />
                    <span className="text-gray-300 group-hover:text-white">Change Password</span>
                  </div>
                  <span className="text-xs text-gray-500">Last changed 30d ago</span>
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/5 hover:bg-slate-800/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-gray-400 group-hover:text-white" />
                    <span className="text-gray-300 group-hover:text-white">Notification Preferences</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Download className="h-5 w-5 text-neon-purple" />
                Data & Privacy
              </h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/5 hover:bg-slate-800/10 transition-colors group">
                  <span className="text-gray-300 group-hover:text-white">Export Account Data</span>
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-colors group border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span className="text-red-400">Delete Account</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}