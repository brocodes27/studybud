import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Flame, ShieldCheck, Users, Zap, Crown, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { useAnalytics } from '../hooks/useAnalytics';

const WEEKLY_TOPICS = ['Rotational Dynamics', 'Electrostatics', 'GOC', 'Limits', 'Chemical Bonding'];

const createSquadId = () => `squad_${crypto.randomUUID().slice(0, 10)}`;

function getNextSunday() {
  const d = new Date();
  const daysUntilSunday = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

interface Member {
  user_id: string;
  display_name: string;
  joined_at: string;
  rigor_score: number | null;
  attempted_at: string | null;
  is_done: boolean;
}

export function SquadProveIt() {
  const { user } = useAuth() as any;
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subject, setSubject] = useState('JEE Physics');
  const [topic, setTopic] = useState(WEEKLY_TOPICS[0]);
  const [squadId, setSquadId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [streak, setStreak] = useState(0);
  const [weekEndsAt, setWeekEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track('squad_prove_it_open');
  }, [track]);

  useEffect(() => {
    const inboundSquad = searchParams.get('squad');
    const inboundSubject = searchParams.get('subject');
    const inboundTopic = searchParams.get('topic');
    if (inboundSubject) setSubject(inboundSubject);
    if (inboundTopic) setTopic(inboundTopic);
    if (inboundSquad) setSquadId(inboundSquad);
  }, [searchParams]);

  // Auto-join squad and load state whenever squadId + user exist.
  useEffect(() => {
    if (!squadId || !user?.id) return;
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);

      // 1. Ensure squad row exists (with week_ends_at if new).
      const { data: existing } = await supabase.from('prove_it_squads').select('week_ends_at').eq('id', squadId).single();
      if (!existing) {
        await supabase.from('prove_it_squads').upsert({
          id: squadId,
          subject,
          topic,
          created_by: user.id,
          week_ends_at: getNextSunday(),
        });
        setWeekEndsAt(getNextSunday());
      } else {
        setWeekEndsAt(existing.week_ends_at);
      }

      // 2. Join the squad (idempotent).
      await supabase.rpc('join_prove_it_squad', { p_squad_id: squadId, p_user_id: user.id });

      // 3. Load roster.
      await refreshRoster();

      // 4. Load streak.
      const { data: streakData } = await supabase.rpc('get_squad_streak', { p_squad_id: squadId });
      if (!cancelled) setStreak(streakData || 0);

      if (!cancelled) setLoading(false);
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [squadId, user?.id, subject, topic]);

  // Realtime: keep roster live when attempts change.
  useEffect(() => {
    if (!squadId) return;
    const channel = supabase
      .channel(`squad-prove-it-${squadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prove_it_squad_attempts', filter: `squad_id=eq.${squadId}` },
        () => { refreshRoster(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squadId]);

  const refreshRoster = async () => {
    if (!squadId) return;
    const { data } = await supabase.rpc('get_squad_weekly_status', { p_squad_id: squadId });
    setMembers(data || []);
  };

  const ensureSquad = async () => {
    const id = squadId || createSquadId();
    setSquadId(id);
    setSearchParams({ squad: id, subject, topic });
    if (user?.id) {
      await supabase.from('prove_it_squads').upsert({
        id, subject, topic, created_by: user.id,
        week_ends_at: getNextSunday(),
      });
      await supabase.rpc('join_prove_it_squad', { p_squad_id: id, p_user_id: user.id });
      await refreshRoster();
    }
    return id;
  };

  const inviteUrl = squadId
    ? `${window.location.origin}/squad-prove-it?squad=${encodeURIComponent(squadId)}&subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`
    : '';

  const doneCount = members.filter(m => m.is_done).length;
  const totalCount = members.length;
  const myDone = members.some(m => m.user_id === user?.id && m.is_done);

  const startProveIt = async () => {
    const id = await ensureSquad();
    navigate(`/prove-it?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&squad=${encodeURIComponent(id)}`);
  };

  const copyInvite = async () => {
    const id = await ensureSquad();
    track('squad_invite_copy', { squad_id: id, subject, topic });
    const url = `${window.location.origin}/squad-prove-it?squad=${encodeURIComponent(id)}&subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`;
    await navigator.clipboard.writeText(url);
    showToast('Squad invite copied', 'success');
  };

  const rotateWeek = async () => {
    if (!squadId || !user?.id) return;
    const nextSunday = getNextSunday();
    await supabase.from('prove_it_squads').update({ week_ends_at: nextSunday }).eq('id', squadId);
    setWeekEndsAt(nextSunday);
    await refreshRoster();
    showToast('New week started — everyone is back on the clock!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header + Controls */}
        <div className="neo-card bg-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-[18px] bg-[#0A192F] text-white flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#0A192F]">Squad Prove-It</h1>
              <p className="text-sm text-[#64748B]">Join a squad, lock in a weekly topic, and hold each other accountable.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-[18px] border-2 border-[#0A192F]/10 p-4 bg-[#F8FAF9]">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Squad subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-[12px] bg-white border-2 border-[#0A192F]/10 font-bold text-[#0A192F]"
              >
                <option>JEE Physics</option>
                <option>JEE Chemistry</option>
                <option>JEE Mathematics</option>
              </select>

              <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#64748B]">This week's squad topic</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-[12px] bg-white border-2 border-[#0A192F]/10 font-bold text-[#0A192F]"
              >
                {WEEKLY_TOPICS.map(t => <option key={t}>{t}</option>)}
              </select>

              <button
                onClick={startProveIt}
                className="mt-4 w-full py-3 rounded-[12px] bg-[#0A192F] text-white font-bold flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Prove this squad topic
              </button>
            </div>

            <div className="rounded-[18px] border-2 border-[#0A192F]/10 p-4 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#0A192F]">
                  <Flame className="w-4 h-4 text-[#F472B6]" /> Squad pulse
                </div>
                {weekEndsAt && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#64748B] bg-[#F8FAF9] px-2 py-1 rounded-full border border-[#0A192F]/5">
                    <Clock className="w-3 h-3" />
                    Ends {new Date(weekEndsAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[14px] bg-[#F8FAF9] border border-[#0A192F]/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Proved it</div>
                  <div className="text-2xl font-extrabold text-[#0A192F] mt-1">
                    {doneCount}<span className="text-sm text-[#64748B]">/{totalCount}</span>
                  </div>
                </div>
                <div className="rounded-[14px] bg-[#F8FAF9] border border-[#0A192F]/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Squad streak</div>
                  <div className="text-2xl font-extrabold text-[#0A192F] mt-1 flex items-center gap-1">
                    <Zap className="w-5 h-5 text-amber-400" />
                    {streak}
                  </div>
                </div>
              </div>

              <div className={`text-xs font-bold px-3 py-2 rounded-[10px] border ${myDone ? 'bg-[#34D399]/10 border-[#34D399]/20 text-[#34D399]' : 'bg-[#F472B6]/10 border-[#F472B6]/20 text-[#F472B6]'}`}>
                {myDone ? 'You proved it this week — squad is counting on the rest!' : 'You have NOT proved it this week — squad is waiting.'}
              </div>

              <button
                onClick={copyInvite}
                className="w-full py-3 rounded-[12px] bg-[#00D1FF] text-[#0A192F] font-bold flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copy squad invite
              </button>
              {inviteUrl && <p className="text-[10px] text-[#64748B] break-all">{inviteUrl}</p>}

              {user?.id && members.length > 0 && (
                <button
                  onClick={rotateWeek}
                  className="w-full py-2 rounded-[10px] border-2 border-[#0A192F]/10 text-[#0A192F] text-xs font-bold hover:bg-[#0A192F]/5 transition-colors"
                >
                  Start next week
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Roster */}
        {squadId && (
          <div className="neo-card bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-[#0A192F]">Squad roster</h2>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-[#64748B]" />}
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-[#64748B]/30 mx-auto mb-2" />
                <p className="text-sm text-[#64748B]">No members yet. Share the invite link to build your squad.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className={`flex items-center justify-between p-3 rounded-[14px] border ${m.is_done ? 'bg-[#34D399]/5 border-[#34D399]/15' : 'bg-[#F8FAF9] border-[#0A192F]/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold ${m.is_done ? 'bg-[#34D399] text-white' : 'bg-[#F472B6]/10 text-[#F472B6]'}`}>
                        {m.display_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0A192F]">
                          {m.user_id === user?.id ? 'You' : m.display_name}
                          {m.user_id === user?.id && <Crown className="w-3 h-3 text-amber-400 inline ml-1" />}
                        </div>
                        <div className="text-[10px] text-[#64748B]">
                          Joined {new Date(m.joined_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {m.is_done ? (
                        <>
                          <span className="text-xs font-bold text-[#34D399]">Rigor {m.rigor_score}/10</span>
                          <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold text-[#F472B6] px-2 py-0.5 rounded-full bg-[#F472B6]/10 border border-[#F472B6]/20">
                            At Risk
                          </span>
                          <AlertTriangle className="w-4 h-4 text-[#F472B6]" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
