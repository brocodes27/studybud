import { useState, useEffect } from 'react';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { Calendar as CalendarIcon, PlusCircle, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export function CalendarSync() {
  const { user } = useAuth();
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  // Load saved upcoming events when the page mounts so they persist across navigation
  useEffect(() => {
    const loadSavedEvents = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('calendar_events')
        .select('provider_event_id, summary, start_time, end_time')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error loading saved events:', error.message);
        return;
      }

      const transformed: GoogleEvent[] = (data || []).map((ev: any) => ({
        id: ev.provider_event_id,
        summary: ev.summary,
        start: { dateTime: ev.start_time },
        end: { dateTime: ev.end_time },
      }));
      setEvents(transformed);
    };

    loadSavedEvents();
  }, [user]);
  const { scheduleExamReminder, requestPermission } = useNotifications();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        setLoading(true);
        const accessToken = tokenResponse.access_token;
        await fetchEvents(accessToken);
        showToast('Calendar connected successfully!', 'success');
      } catch (error) {
        console.error('Error fetching events:', error);
        showToast('Failed to fetch calendar events', 'error');
      } finally {
        setLoading(false);
      }
    },
    onError: () => showToast('Google authentication failed', 'error'),
  });

  const fetchEvents = async (accessToken: string) => {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(); // 60 days ahead

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch Google Calendar events');

    const data = await response.json();
    const items: GoogleEvent[] = data.items || [];
    setEvents(items);

    // Persist to Supabase and schedule reminders
    if (user && items.length) {
      // Prepare rows
      const rows = items.map((ev) => ({
        provider_event_id: ev.id,
        user_id: user.id,
        summary: ev.summary,
        start_time: ev.start.dateTime || ev.start.date,
        end_time: ev.end.dateTime || ev.end.date,
      }));
      // upsert
      await supabase.from('calendar_events').upsert(rows, { onConflict: 'provider_event_id,user_id' });

      // Notification reminders
      const granted = await requestPermission();
      if (granted) {
        rows.forEach((r) => {
          if (r.start_time) {
            scheduleExamReminder(new Date(r.start_time), r.summary || 'Exam');
          }
        });
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
            <CalendarIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Calendar Sync</h1>
        </div>
        <p className="text-gray-300 max-w-xl mx-auto mb-6">
          Connect your Google Calendar to automatically import exam dates and deadlines into STUBUD.
        </p>
        <button
          onClick={() => login()}
          disabled={loading}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      </div>

      {events.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" /> Upcoming Events
          </h2>
          {events.map((event) => {
            const eventDate = event.start.dateTime || event.start.date || '';
            const daysUntilEvent = differenceInDays(new Date(eventDate), new Date());
            const isTooFarAway = daysUntilEvent > 30;
            
            return (
              <div key={event.id} className="glass rounded-xl border border-gray-700/50 p-4 card-hover">
                <p className="font-semibold text-white text-lg mb-1">{event.summary || 'Untitled Event'}</p>
                <p className="text-gray-400">
                  {event.start.dateTime
                    ? format(new Date(event.start.dateTime), 'PPpp')
                    : format(new Date(event.start.date || ''), 'PP')} —{' '}
                  {event.end.dateTime
                    ? format(new Date(event.end.dateTime), 'PPpp')
                    : format(new Date(event.end.date || ''), 'PP')}
                </p>
                
                {isTooFarAway && (
                  <div className="mt-3 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-300">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        This event is {daysUntilEvent} days away. Study plans are limited to 30 days for optimal AI generation.
                      </span>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={() => {
                    const dateStr = event.start.dateTime || event.start.date || '';
                    const rawSummary = event.summary || '';
                    const cleanedSubject = rawSummary.replace(/exam|test|assessment|paper/ig, '').split(/[:\-]/)[0].trim();
                    const chaptersQP = event.description ? `&chapters=${encodeURIComponent(event.description)}` : '';
                    
                    if (isTooFarAway) {
                      showToast('Study plans are limited to 30 days. Please select a closer date.', 'info');
                      return;
                    }
                    
                    navigate(`/create?subject=${encodeURIComponent(cleanedSubject)}&exam_date=${dateStr.split('T')[0]}${chaptersQP}`);
                  }}
                  className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-300 ${
                    isTooFarAway
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                  }`}
                  disabled={isTooFarAway}
                >
                  <PlusCircle className="h-4 w-4" /> 
                  {isTooFarAway ? 'Too far away' : 'Convert to Study Plan'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
