import { SmartNotifications } from '../components/SmartNotifications';
import { Bell } from 'lucide-react';

export function Notifications() {

  return (
    <div className="space-y-8 animate-fade-in relative p-4 md:p-8">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-neon-purple/10 rounded-full blur-3xl -z-10"></div>

      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neon-purple to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-neon-purple/20">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-pink-400">Notifications</span>
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Stay on track with intelligent reminders, progress updates, and personalized study alerts designed to maximize your learning efficiency.
        </p>
      </div>

      {/* Main Notifications Component */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
        <SmartNotifications />
      </div>
    </div>
  );
}