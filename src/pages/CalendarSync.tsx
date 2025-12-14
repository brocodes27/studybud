import { useState, useEffect } from 'react';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { Calendar as CalendarIcon, PlusCircle, AlertCircle, CheckCircle } from 'lucide-react';
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
    <div className="min-h-screen relative p-4 md:p-8 animate-fade-in">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-neon-green to-emerald-600 p-4 rounded-2xl shadow-lg shadow-neon-green/20">
              <CalendarIcon className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Calendar <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-emerald-400">Sync</span></h1>
          </div>
          <p className="text-gray-400 max-w-xl mx-auto mb-8 text-lg">
            Connect your Google Calendar to automatically import exam dates and deadlines into ElevenFolks.
          </p>
          <button
            onClick={() => login()}
            disabled={loading}
            className="bg-gradient-to-r from-neon-green to-emerald-600 hover:from-emerald-500 hover:to-emerald-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-green/20 hover:shadow-neon-green/40 flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Connecting...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Connect Google Calendar
              </>
            )}
          </button>
        </div>

        {events.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
              <CalendarIcon className="h-6 w-6 text-neon-green" />
              Upcoming Events
            </h2>
            <div className="grid gap-4">
              {events.map((event) => {
                const eventDate = event.start.dateTime || event.start.date || '';
                const daysUntilEvent = differenceInDays(new Date(eventDate), new Date());
                const isTooFarAway = daysUntilEvent > 30;

                return (
                  <div key={event.id} className="glass-card rounded-2xl border border-white/10 p-6 hover:border-neon-green/30 transition-all duration-300 group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-white text-xl mb-2 group-hover:text-neon-green transition-colors">{event.summary || 'Untitled Event'}</p>
                        <p className="text-gray-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-neon-green"></span>
                          {event.start.dateTime
                            ? format(new Date(event.start.dateTime), 'PPpp')
                            : format(new Date(event.start.date || ''), 'PP')}
                        </p>
                      </div>

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
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isTooFarAway
                            ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                            : 'bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20'
                          }`}
                        disabled={isTooFarAway}
                      >
                        <PlusCircle className="h-4 w-4" />
                        {isTooFarAway ? 'Too far away' : 'Create Study Plan'}
                      </button>
                    </div>

                    {isTooFarAway && (
                      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-orange-300">
                          This event is {daysUntilEvent} days away. AI study plans are currently optimized for 30-day sprints.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
