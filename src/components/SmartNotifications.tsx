import React, { useState, useEffect } from 'react';
import { Bell, Calendar, Clock, Target, Settings, X, Check, AlertCircle, CheckCircle, XCircle, TrendingUp, Brain, Zap } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { usePayment } from '../hooks/usePayment';

interface Notification {
  id: string;
  user_id: string;
  type: 'reminder' | 'achievement' | 'suggestion' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  priority: 'low' | 'medium' | 'high';
}

interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  study_reminders: boolean;
  achievement_notifications: boolean;
  smart_suggestions: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface ScheduledNotification {
  id: string;
  type: 'study' | 'exam' | 'achievement' | 'goal';
  title: string;
  message: string;
  scheduledFor: Date;
  isActive: boolean;
}

export function SmartNotifications() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const { paymentData, initiatePayment } = usePayment();
  const {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    scheduleStudyReminder,
    scheduleExamReminder,
    scheduleDailyReminder
  } = useNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    email_notifications: true,
    push_notifications: true,
    study_reminders: true,
    achievement_notifications: true,
    smart_suggestions: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  });
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true); // Subscription always true for now

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchSettings();
    }
  }, [user]);

  useEffect(() => {
    if (user && permission === 'granted') {
      setupAutomaticNotifications();
    }
  }, [user, permission, settings]);

  useEffect(() => {
    setShowPaywall(false); // Never show paywall
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      setSettings(data);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting notification:', error);
      return;
    }

    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    showToast('Notification deleted', 'success');
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    if (!user) return;

    const updatedSettings = { ...settings, ...newSettings };

    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        ...updatedSettings
      });

    if (error) {
      console.error('Error updating settings:', error);
      showToast('Failed to update settings', 'error');
      return;
    }

    setSettings(updatedSettings);
    showToast('Settings updated successfully', 'success');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reminder':
        return <Clock className="h-5 w-5 text-neon-blue" />;
      case 'achievement':
        return <CheckCircle className="h-5 w-5 text-neon-green" />;
      case 'suggestion':
        return <Brain className="h-5 w-5 text-neon-purple" />;
      case 'system':
        return <Zap className="h-5 w-5 text-neon-yellow" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-500/10';
      case 'medium':
        return 'border-l-neon-yellow bg-neon-yellow/10';
      case 'low':
        return 'border-l-neon-green bg-neon-green/10';
      default:
        return 'border-l-gray-500 bg-white/5';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleSubscribe = async () => {
    try {
      await initiatePayment();
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Failed to start payment. Please try again.', 'error');
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
      if (settings.study_reminders && examPlans) {
        examPlans.forEach(plan => {
          const examDate = new Date(plan.exam_date);
          scheduleStudyReminder(examDate, plan.subject);
        });
      }

      // Schedule daily study reminders
      if (settings.study_reminders) {
        scheduleDailyReminder(
          '09:00',
          'Time for your daily study session! Keep up the great work! 📚'
        );
      }

    } catch (error) {
      console.error('Error setting up automatic notifications:', error);
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
      tag: 'test-notification',
      url: '/notifications'
    });

    if (success) {
      showToast('Test notification sent!', 'success');
    } else {
      showToast('Failed to send test notification', 'error');
    }
  };

  const getPermissionStatus = () => {
    if (!isSupported) return { color: 'text-gray-400', text: 'Not Supported', icon: X };
    if (permission === 'granted') return { color: 'text-neon-green', text: 'Enabled', icon: CheckCircle };
    if (permission === 'denied') return { color: 'text-red-400', text: 'Blocked', icon: X };
    return { color: 'text-neon-yellow', text: 'Not Enabled', icon: AlertCircle };
  };

  const permissionStatus = getPermissionStatus();
  const StatusIcon = permissionStatus.icon;

  const openInFullscreenTab = async (notification: Notification) => {
    // Prefer provided action_url; fallback to home
    let url = notification.action_url || '/';
    try {
      const u = new URL(url, window.location.origin);
      if (!u.searchParams.has('fullscreen')) {
        u.searchParams.set('fullscreen', '1');
      }
      url = u.toString();
    } catch {
      // If URL parsing fails, append query in a simple way
      url += (url.includes('?') ? '&' : '?') + 'fullscreen=1';
    }

    // Open in new tab to maximize viewing area
    window.open(url, '_blank', 'noopener,noreferrer');

    // Mark as read after opening
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 shadow-xl text-center max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-4 text-white">Unlock All Features</h2>
            <p className="mb-6 text-gray-400">
              Subscribe for <span className="font-bold text-neon-blue">
                {paymentData.currency === 'USD' ? '$' : paymentData.currency === 'EUR' ? '€' : '₹'}{paymentData.price}
              </span> to access all features.
            </p>
            <button
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-neon-purple to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-neon-purple/80 hover:to-pink-600/80 transition-all duration-200 shadow-lg shadow-neon-purple/20"
            >
              Subscribe Now
            </button>
          </div>
        </div>
      )}
      {/* Notification Status */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-neon-blue" />
            Smart Notifications
          </h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg transition-colors duration-200"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-xl border ${permission === 'granted'
              ? 'border-neon-green/30 bg-neon-green/10'
              : permission === 'denied'
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-neon-yellow/30 bg-neon-yellow/10'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={`h-5 w-5 ${permissionStatus.color}`} />
              <span className="font-semibold text-white">Permission</span>
            </div>
            <p className={`text-sm ${permissionStatus.color}`}>
              {permissionStatus.text}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-neon-blue/30 bg-neon-blue/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-neon-blue" />
              <span className="font-semibold text-white">Study Reminders</span>
            </div>
            <p className="text-sm text-neon-blue">
              {settings.study_reminders ? 'Active' : 'Inactive'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-neon-purple/30 bg-neon-purple/10">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-neon-purple" />
              <span className="font-semibold text-white">Exam Alerts</span>
            </div>
            <p className="text-sm text-neon-purple">
              {settings.study_reminders ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={sendTestNotification}
            className="bg-neon-blue hover:bg-neon-blue/80 text-white px-6 py-3 rounded-xl transition-colors duration-200 shadow-lg shadow-neon-blue/20"
          >
            Test Notification
          </button>

          {permission !== 'granted' && isSupported && (
            <button
              onClick={requestPermission}
              className="bg-neon-green hover:bg-neon-green/80 text-black font-semibold px-6 py-3 rounded-xl transition-colors duration-200 shadow-lg shadow-neon-green/20"
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
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h4 className="text-lg font-bold text-white mb-6">Notification Settings</h4>

          <div className="space-y-6">
            {/* Toggle Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                <span className="text-white font-medium">Email Notifications</span>
                <button
                  onClick={() => updateSettings({ email_notifications: !settings.email_notifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.email_notifications ? 'bg-neon-blue' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.email_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                <span className="text-white font-medium">Push Notifications</span>
                <button
                  onClick={() => updateSettings({ push_notifications: !settings.push_notifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.push_notifications ? 'bg-neon-blue' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.push_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                <span className="text-white font-medium">Study Reminders</span>
                <button
                  onClick={() => updateSettings({ study_reminders: !settings.study_reminders })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.study_reminders ? 'bg-neon-blue' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.study_reminders ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                <span className="text-white font-medium">Achievement Notifications</span>
                <button
                  onClick={() => updateSettings({ achievement_notifications: !settings.achievement_notifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.achievement_notifications ? 'bg-neon-blue' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.achievement_notifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                <span className="text-white font-medium">Smart Suggestions</span>
                <button
                  onClick={() => updateSettings({ smart_suggestions: !settings.smart_suggestions })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.smart_suggestions ? 'bg-neon-blue' : 'bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.smart_suggestions ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Time Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Quiet Hours Start
                </label>
                <input
                  type="time"
                  value={settings.quiet_hours_start}
                  onChange={(e) => updateSettings({ quiet_hours_start: e.target.value })}
                  className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Quiet Hours End
                </label>
                <input
                  type="time"
                  value={settings.quiet_hours_end}
                  onChange={(e) => updateSettings({ quiet_hours_end: e.target.value })}
                  className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-2xl border border-white/10">
            <Bell className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Notifications</h3>
            <p className="text-gray-400">You're all caught up! New notifications will appear here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`glass-card rounded-xl p-4 border-l-4 transition-all duration-200 hover:bg-white/5 cursor-pointer ${getPriorityColor(notification.priority)
                } ${notification.is_read ? 'opacity-60' : ''}`}
              onClick={() => openInFullscreenTab(notification)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openInFullscreenTab(notification);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{notification.title}</h4>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-neon-blue rounded-full shadow-[0_0_5px_#3b82f6]"></span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{notification.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{formatTime(notification.created_at)}</span>
                      <span className="capitalize">{notification.priority} priority</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle className="h-4 w-4 text-neon-green" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Delete notification"
                  >
                    <XCircle className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Smart Insights */}
      <div className="bg-gradient-to-r from-neon-purple/20 to-pink-600/20 rounded-xl p-6 border border-neon-purple/30 shadow-lg shadow-neon-purple/10">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-6 w-6 text-neon-purple" />
          <h4 className="text-lg font-semibold text-white">Smart Insights</h4>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Notification engagement</span>
            <span className="text-neon-green font-semibold">85%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Response time</span>
            <span className="text-neon-blue font-semibold">2.3 min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Study sessions triggered</span>
            <span className="text-neon-purple font-semibold">12 this week</span>
          </div>
        </div>
      </div>
    </div>
  );
}