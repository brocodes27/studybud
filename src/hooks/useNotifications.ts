import { useState, useEffect } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  url?: string; // optional deep link target
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    if (permission === 'granted') return true;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const showNotification = async (options: NotificationOptions): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    try {
      // Prefer using the ServiceWorkerRegistration API when available.
      // Note: navigator.serviceWorker.ready can hang indefinitely if no SW is
      // registered (common in dev where we intentionally unregister).
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(options.title, {
            body: options.body,
            icon: options.icon || '/pwa-192x192.png',
            badge: options.badge || '/pwa-192x192.png',
            tag: options.tag,
            requireInteraction: options.requireInteraction,
            data: { url: options.url }
          });
          return true;
        }
      }

      // Fallback to the Notification constructor
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/pwa-192x192.png',
        badge: options.badge || '/pwa-192x192.png',
        tag: options.tag,
        requireInteraction: options.requireInteraction,
        silent: false
      });

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  };

  const scheduleStudyReminder = async (studyTime: Date, subject: string) => {
    const now = new Date();
    const timeUntilStudy = studyTime.getTime() - now.getTime();

    if (timeUntilStudy > 0 && timeUntilStudy < 24 * 60 * 60 * 1000) { // Within 24 hours
      setTimeout(() => {
        showNotification({
          title: '📚 Study Time!',
          body: `Time to study ${subject}. Let's achieve your goals!`,
          tag: 'study-reminder',
          requireInteraction: true
        });
      }, timeUntilStudy);
      return true;
    }
    return false;
  };

  const scheduleExamReminder = async (examDate: Date, subject: string, daysBeforeArray: number[] = [7, 3, 1]) => {
    const now = new Date();
    let scheduled = 0;
    
    daysBeforeArray.forEach(daysBefore => {
      const reminderDate = new Date(examDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      reminderDate.setHours(9, 0, 0, 0); // 9 AM reminder
      
      const timeUntilReminder = reminderDate.getTime() - now.getTime();
      
      if (timeUntilReminder > 0 && timeUntilReminder < 30 * 24 * 60 * 60 * 1000) { // Within 30 days
        setTimeout(() => {
          showNotification({
            title: '⚡ Exam Alert!',
            body: `${subject} exam in ${daysBefore} day${daysBefore > 1 ? 's' : ''}. Are you ready?`,
            tag: `exam-reminder-${daysBefore}`,
            requireInteraction: true
          });
        }, timeUntilReminder);
        scheduled++;
      }
    });

    return scheduled > 0;
  };

  const scheduleDailyReminder = async (time: string, message: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeUntilReminder = reminderTime.getTime() - now.getTime();

    if (timeUntilReminder > 0) {
      setTimeout(() => {
        showNotification({
          title: '🎯 Daily Study Reminder',
          body: message,
          tag: 'daily-reminder'
        });
        
        // Schedule next day's reminder
        scheduleDailyReminder(time, message);
      }, timeUntilReminder);
      return true;
    }
    return false;
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    scheduleStudyReminder,
    scheduleExamReminder,
    scheduleDailyReminder
  };
}