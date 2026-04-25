import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'studybud_session_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useAnalytics() {
  const track = useCallback(async (eventName: string, metadata?: Record<string, any>) => {
    try {
      const sessionId = getSessionId();
      const payload = {
        event_name: eventName,
        session_id: sessionId,
        path: window.location.pathname + window.location.search,
        metadata: metadata || {},
      };
      // Fire and forget — don't block UX for analytics
      supabase.from('analytics_events').insert(payload).then(() => {});
    } catch {
      // Silently fail — analytics should never break the app
    }
  }, []);

  return { track };
}

// One-off tracker for use outside React components
export function trackEvent(eventName: string, metadata?: Record<string, any>) {
  try {
    const sessionId = sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    supabase.from('analytics_events').insert({
      event_name: eventName,
      session_id: sessionId,
      path: window.location.pathname + window.location.search,
      metadata: metadata || {},
    }).then(() => {});
  } catch {
    // Silent
  }
}
