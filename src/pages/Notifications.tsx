import { SmartNotifications } from '../components/SmartNotifications';
import { Bell } from 'lucide-react';

export function Notifications() {

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center glow-blue">
            <Bell className="w-8 h-8 text-gray-900" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Smart <span className="gradient-text">Notifications</span>
          </h1>
        </div>
        <p className="text-xl text-gray-900 max-w-3xl mx-auto leading-relaxed">
          Stay on track with intelligent reminders, progress updates, and personalized study alerts designed to maximize your learning efficiency.
        </p>
      </div>

      {/* Main Notifications Component */}
      <div className="card-elevated">
        <SmartNotifications />
      </div>
    </div>
  );
}