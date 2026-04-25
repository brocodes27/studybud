import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Loader2, AlertTriangle } from 'lucide-react';

interface FunnelRow {
  event_name: string;
  unique_users: number;
  total_events: number;
}

export function AdminAnalytics() {
  const { user } = useAuth() as any;
  const [data, setData] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(7);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const start = new Date();
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);

      const { data: rows, error: rpcError } = await supabase.rpc('get_funnel_counts', {
        p_start: start.toISOString(),
        p_end: new Date().toISOString(),
      });

      if (rpcError) {
        setError(rpcError.message);
      } else {
        setData(rows || []);
      }
      setLoading(false);
    };
    load();
  }, [days]);

  // Simple admin gate: show nothing if not admin
  if (!user?.is_admin) return (
    <div className="flex items-center justify-center h-screen text-[#64748B]">
      <AlertTriangle className="w-5 h-5 mr-2" /> Admin access only.
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-[#00D1FF]" />
        <h1 className="text-2xl font-bold text-[#0A192F]">Beta Funnel</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              days === d ? 'bg-[#00D1FF] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#64748B]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-[#0A192F]">Event</th>
                <th className="text-right px-4 py-3 font-semibold text-[#0A192F]">Unique Users</th>
                <th className="text-right px-4 py-3 font-semibold text-[#0A192F]">Total Events</th>
                <th className="text-right px-4 py-3 font-semibold text-[#0A192F]">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-t border-[#F1F5F9]">
                  <td className="px-4 py-3 text-[#0A192F] font-medium">{row.event_name}</td>
                  <td className="px-4 py-3 text-right text-[#64748B]">{row.unique_users}</td>
                  <td className="px-4 py-3 text-right text-[#64748B]">{row.total_events}</td>
                  <td className="px-4 py-3 text-right text-[#64748B]">
                    {row.unique_users > 0
                      ? Math.round((row.total_events / row.unique_users) * 10) / 10 + 'x'
                      : '-'}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#94A3B8]">
                    No events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
