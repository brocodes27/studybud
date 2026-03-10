import React from 'react';
import { ProfileSettings } from '../components/ProfileSettings';
import { User, Shield, Bell, Key, Download, Trash2 } from 'lucide-react';

export function Profile() {
  return (
    <div className="animate-fade-in pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan">
            <User className="h-7 w-7 text-[#00D1FF] stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Profile Settings</h1>
            <p className="text-[#64748B] font-medium">Manage your account information and preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ProfileSettings />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-[32px] border-2 border-[#0A192F]/5 p-6 shadow-float-cyan">
              <h3 className="text-lg font-extrabold text-[#0A192F] mb-4 flex items-center gap-2 tracking-tight">
                <Shield className="h-5 w-5 text-[#34D399] stroke-[2.5px]" />
                Account Security
              </h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-[16px] bg-slate-50 hover:bg-[#00D1FF]/5 hover:border-[#00D1FF]/20 border-2 border-transparent transition-all group">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-[#64748B] group-hover:text-[#00D1FF] stroke-[2.5px]" />
                    <span className="text-[#0A192F] font-medium text-sm">Change Password</span>
                  </div>
                  <span className="text-xs text-[#64748B]">30d ago</span>
                </button>
                <button className="w-full flex items-center justify-between p-3 rounded-[16px] bg-slate-50 hover:bg-[#00D1FF]/5 hover:border-[#00D1FF]/20 border-2 border-transparent transition-all group">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-[#64748B] group-hover:text-[#00D1FF] stroke-[2.5px]" />
                    <span className="text-[#0A192F] font-medium text-sm">Notification Preferences</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border-2 border-[#0A192F]/5 p-6 shadow-float-cyan">
              <h3 className="text-lg font-extrabold text-[#0A192F] mb-4 flex items-center gap-2 tracking-tight">
                <Download className="h-5 w-5 text-[#F472B6] stroke-[2.5px]" />
                Data & Privacy
              </h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 rounded-[16px] bg-slate-50 hover:bg-[#00D1FF]/5 border-2 border-transparent hover:border-[#00D1FF]/20 transition-all">
                  <span className="text-[#0A192F] font-medium text-sm">Export Account Data</span>
                </button>
                <button className="w-full flex items-center gap-3 p-3 rounded-[16px] bg-red-50 border-2 border-red-100 hover:bg-red-100 transition-all">
                  <Trash2 className="h-4 w-4 text-red-500 stroke-[2.5px]" />
                  <span className="text-red-500 font-medium text-sm">Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
