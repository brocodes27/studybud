import React, { useState, useEffect } from 'react';
import { Bell, Calendar, Clock, Target, Settings, X, Check, AlertCircle, CheckCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

interface NotificationSettings {
  studyReminders: boolean;
  examAlerts: boolean;
  achievementNotifications: boolean;
  socialUpdates: boolean;
  dailyGoals: boolean;
  weeklyReports: boolean;
  reminderTime: string;
  examReminderDays: number[];
}

interface ScheduledNotification {
  id: string;
  type: 'study' | 'exam' | 'achievement' | 'goal';
  title: string;
  message: string;
  scheduledFor: Date;
  isActive: boolean;
}

// Razorpay script loader
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    document.body.appendChild(script);
  });
};

export function SmartNotifications() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { 
    permission, 
    isSupported, 
    requestPermission, 
    showNotification, 
    scheduleStudyReminder, 
    scheduleExamReminder,
    scheduleDailyReminder
  } = useNotifications();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    studyReminders: true,
    examAlerts: true,
    achievementNotifications: true,
    socialUpdates: false,
    dailyGoals: true,
    weeklyReports: true,
    reminderTime: '09:00',
    examReminderDays: [7, 3, 1]
  });
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false); // TODO: Replace with real backend check
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotificationSettings();
    }
  }, [user]);

  useEffect(() => {
    if (user && permission === 'granted') {
      setupAutomaticNotifications();
    }
  }, [user, permission, settings]);

  useEffect(() => {
    // TODO: Replace with real backend check for subscription
    setShowPaywall(!isSubscribed);
  }, [isSubscribed]);

  const loadNotificationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('notification_settings')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data?.notification_settings) {
        setSettings({ ...settings, ...data.notification_settings });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationSettings = async (newSettings: NotificationSettings) => {
    try {
      // First ensure user profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user?.id)
        .single();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user?.id,
            notification_settings: newSettings
          });

        if (insertError) throw insertError;
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ notification_settings: newSettings })
          .eq('id', user?.id);

        if (updateError) throw updateError;
      }

      setSettings(newSettings);
      showToast('Notification settings saved!', 'success');
      
      // Re-setup notifications with new settings
      if (permission === 'granted') {
        setupAutomaticNotifications();
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      showToast('Failed to save notification settings', 'error');
    }
  };

  const setupAutomaticNotifications = async () => {
    if (permission !== 'granted') return;

    try {
      // Fetch upcoming exams
      const { data: examPlans, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user?.id)
        .gte('exam_date', new Date().toISOString());

      if (error) throw error;

      // Schedule exam reminders
      if (settings.examAlerts && examPlans) {
        examPlans.forEach(plan => {
          const examDate = new Date(plan.exam_date);
          scheduleExamReminder(examDate, plan.subject, settings.examReminderDays);
        });
      }

      // Schedule daily study reminders
      if (settings.studyReminders) {
        scheduleDailyReminder(
          settings.reminderTime, 
          'Time for your daily study session! Keep up the great work! 📚'
        );
      }

      // Schedule weekly progress reports
      if (settings.weeklyReports) {
        scheduleWeeklyReport();
      }

    } catch (error) {
      console.error('Error setting up automatic notifications:', error);
    }
  };

  const scheduleWeeklyReport = () => {
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(18, 0, 0, 0); // 6 PM on Sunday

    const timeUntilReport = nextSunday.getTime() - now.getTime();

    if (timeUntilReport > 0 && timeUntilReport < 7 * 24 * 60 * 60 * 1000) { // Within a week
      setTimeout(() => {
        showNotification({
          title: '📊 Weekly Progress Report',
          body: 'Your weekly study summary is ready! Check your progress and achievements.',
          tag: 'weekly-report',
          requireInteraction: true
        });
        
        // Schedule next week's report
        scheduleWeeklyReport();
      }, timeUntilReport);
    }
  };

  const sendTestNotification = async () => {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        showToast('Please enable notifications in your browser settings', 'error');
        return;
      }
    }

    const success = await showNotification({
      title: '🎯 Test Notification',
      body: 'Your notifications are working perfectly! You\'re all set for smart study reminders.',
      tag: 'test-notification'
    });

    if (success) {
      showToast('Test notification sent!', 'success');
    } else {
      showToast('Failed to send test notification', 'error');
    }
  };

  const triggerAchievementNotification = async (achievement: string) => {
    // Ensure notifications are allowed
    let canNotify = permission === 'granted';
    if (!canNotify) {
      canNotify = await requestPermission();
      if (!canNotify) {
        showToast('Please enable notifications in your browser settings', 'error');
        return;
      }
    }

    if (!settings.achievementNotifications) {
      showToast('Achievement notifications are disabled in settings', 'info');
      return;
    }

    showNotification({
      title: '🏆 Achievement Unlocked!',
      body: `Congratulations! You've earned: ${achievement}`,
      tag: 'achievement',
      requireInteraction: true
    });
  };

  const triggerGoalNotification = async (goal: string, completed: boolean) => {
    let canNotify = permission === 'granted';
    if (!canNotify) {
      canNotify = await requestPermission();
      if (!canNotify) {
        showToast('Please enable notifications in your browser settings', 'error');
        return;
      }
    }

    if (!settings.dailyGoals) {
      showToast('Daily goal notifications are disabled in settings', 'info');
      return;
    }

    showNotification({
      title: completed ? '✅ Goal Completed!' : '⏰ Goal Reminder',
      body: completed 
        ? `Amazing! You've completed: ${goal}` 
        : `Don't forget: ${goal}`,
      tag: 'daily-goal'
    });
  };

  const getPermissionStatus = () => {
    if (!isSupported) return { color: 'text-gray-400', text: 'Not Supported', icon: X };
    if (permission === 'granted') return { color: 'text-green-400', text: 'Enabled', icon: CheckCircle };
    if (permission === 'denied') return { color: 'text-red-400', text: 'Blocked', icon: X };
    return { color: 'text-yellow-400', text: 'Not Enabled', icon: AlertCircle };
  };

  const permissionStatus = getPermissionStatus();
  const StatusIcon = permissionStatus.icon;

  const handleSubscribe = async () => {
    console.log('Subscribe clicked', user);
    if (!user?.id || !user?.email) return;
    const response = await fetch('/functions/v1/create-razorpay-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, email: user.email }),
    });
    const data = await response.json();
    if (data.short_url) {
      window.open(data.short_url, '_blank');
    } else {
      // Optionally show error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Unlock All Features</h2>
            <p className="mb-6 text-gray-700">Subscribe for <span className="font-bold">₹199</span> to access all features.</p>
            <button
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              Go to Subscription
            </button>
          </div>
        </div>
      )}
      {/* Notification Status */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-400" />
            Smart Notifications
          </h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors duration-200"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-xl border ${
            permission === 'granted' 
              ? 'border-green-500/30 bg-green-500/10' 
              : permission === 'denied'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-yellow-500/30 bg-yellow-500/10'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={`h-5 w-5 ${permissionStatus.color}`} />
              <span className="font-semibold text-white">Permission</span>
            </div>
            <p className={`text-sm ${permissionStatus.color}`}>
              {permissionStatus.text}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-white">Study Reminders</span>
            </div>
            <p className="text-sm text-blue-400">
              {settings.studyReminders ? 'Active' : 'Inactive'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-white">Exam Alerts</span>
            </div>
            <p className="text-sm text-purple-400">
              {settings.examAlerts ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={sendTestNotification}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
          >
            Test Notification
          </button>
          
          {permission !== 'granted' && isSupported && (
            <button
              onClick={requestPermission}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Enable Notifications
            </button>
          )}
        </div>

        {!isSupported && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">
              Notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      {showSettings && (
        <div className="glass rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-bold text-white mb-6">Notification Settings</h4>
          
          <div className="space-y-6">
            {/* Toggle Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries({
                studyReminders: 'Daily Study Reminders',
                examAlerts: 'Exam Alerts',
                achievementNotifications: 'Achievement Notifications',
                socialUpdates: 'Social Updates',
                dailyGoals: 'Daily Goal Reminders',
                weeklyReports: 'Weekly Progress Reports'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <span className="text-white font-medium">{label}</span>
                  <button
                    onClick={() => {
                      const newSettings = { ...settings, [key]: !settings[key as keyof NotificationSettings] };
                      saveNotificationSettings(newSettings);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      settings[key as keyof NotificationSettings] ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        settings[key as keyof NotificationSettings] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Time Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Daily Reminder Time
                </label>
                <input
                  type="time"
                  value={settings.reminderTime}
                  onChange={(e) => {
                    const newSettings = { ...settings, reminderTime: e.target.value };
                    saveNotificationSettings(newSettings);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Exam Reminder Days (days before exam)
                </label>
                <div className="flex gap-2">
                  {[1, 3, 7, 14].map(day => (
                    <button
                      key={day}
                      onClick={() => {
                        const newDays = settings.examReminderDays.includes(day)
                          ? settings.examReminderDays.filter(d => d !== day)
                          : [...settings.examReminderDays, day].sort((a, b) => b - a);
                        const newSettings = { ...settings, examReminderDays: newDays };
                        saveNotificationSettings(newSettings);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        settings.examReminderDays.includes(day)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {day} day{day > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="glass rounded-2xl p-6 border border-gray-700/50">
        <h4 className="text-lg font-bold text-white mb-4">Quick Actions</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => triggerAchievementNotification('Flashcard Master - Created 50+ flashcards!')}
            className="p-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg text-left hover:bg-yellow-600/30 transition-colors duration-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <span className="font-semibold text-white">Test Achievement</span>
            </div>
            <p className="text-gray-300 text-sm">Trigger a sample achievement notification</p>
          </button>

          <button
            onClick={() => triggerGoalNotification('Complete 3 study sessions today', false)}
            className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-lg text-left hover:bg-blue-600/30 transition-colors duration-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎯</span>
              <span className="font-semibold text-white">Test Goal Reminder</span>
            </div>
            <p className="text-gray-300 text-sm">Trigger a sample goal reminder notification</p>
          </button>
        </div>
      </div>
    </div>
  );
}