import { TrendingUp, CheckCircle, Clock, Target, BarChart3, Zap, Trophy, Flame, Star, LayoutGrid, Map } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { MasteryHeatmap } from '../components/MasteryHeatmap';

interface ProgressData {
  totalStudyTime: number;
  completedTasks: number;
  totalTasks: number;
  streakDays: number;
  weeklyProgress: Array<{
    date: string;
    minutes: number;
    tasks: number;
  }>;
  subjectProgress: Array<{
    subject: string;
    completed: number;
    total: number;
  }>;
}

export function Progress() {
  const { user } = useAuth() as any;
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap'>('overview');
  const [progressData, setProgressData] = useState<ProgressData>({
    totalStudyTime: 0,
    completedTasks: 0,
    totalTasks: 0,
    streakDays: 0,
    weeklyProgress: [],
    subjectProgress: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProgressData();
    }
  }, [user]);

  const fetchProgressData = async () => {
    try {
      // 1. Fetch study sessions and completions for basic stats
      const [sessionsRes, completionsRes, plansRes, gamificationRes] = await Promise.all([
        supabase.from('study_sessions').select('*').eq('user_id', user.id),
        supabase.from('task_completions').select('*').eq('user_id', user.id),
        supabase.from('exam_plans').select('*').eq('user_id', user.id),
        supabase.from('user_gamification').select('*').eq('user_id', user.id).maybeSingle()
      ]);

      const sessions = sessionsRes.data || [];
      const completions = completionsRes.data || [];
      const plans = plansRes.data || [];
      const gamification = gamificationRes.data;

      // Calculate total study time
      const totalStudyTime = sessions.reduce((total, session) => {
        return total + (session.duration_minutes || 0);
      }, 0);

      const completedTasks = completions.length;

      // Calculate total tasks from plans
      let totalTasks = 0;
      const subjectStats: Record<string, { total: number; completed: number }> = {};

      plans.forEach(plan => {
        const subject = plan.subject || 'General';
        if (!subjectStats[subject]) {
          subjectStats[subject] = { total: 0, completed: 0 };
        }
        const tasksCount = (plan.plan?.daily_schedule || []).length;
        totalTasks += tasksCount;
        subjectStats[subject].total += tasksCount;
      });

      completions.forEach(completion => {
        const plan = plans.find(p => p.id === completion.plan_id);
        if (plan) {
          const subject = plan.subject || 'General';
          if (subjectStats[subject]) subjectStats[subject].completed += 1;
        }
      });

      const subjectProgress = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        total: stats.total,
        completed: stats.completed
      }));

      // Use the actual streak from gamification engine
      const streakDays = gamification?.current_streak || 0;

      // Weekly progress remains based on activity logs
      const weeklyProgress = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');

        const daySessions = sessions.filter(session =>
          session.completed_at && format(new Date(session.completed_at), 'yyyy-MM-dd') === dateStr
        );

        const dayMinutes = daySessions.reduce((total, session) => total + (session.duration_minutes || 0), 0);
        const dayTasks = completions.filter(completion =>
          completion.completed_at && format(new Date(completion.completed_at), 'yyyy-MM-dd') === dateStr
        ).length;

        weeklyProgress.push({
          date: format(date, 'MMM dd'),
          minutes: dayMinutes,
          tasks: dayTasks
        });
      }

      setProgressData({
        totalStudyTime,
        completedTasks,
        totalTasks,
        streakDays,
        weeklyProgress,
        subjectProgress
      });
    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getCompletionRate = () => {
    if (progressData.totalTasks === 0) return 0;
    return Math.round((progressData.completedTasks / progressData.totalTasks) * 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
        <div className="w-20 h-20 border-2 border-primary/20 border-t-primary rounded-full animate-spin shadow-lg shadow-primary/10" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Calculating_Trajectory...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in relative pb-16 text-white">
      {/* Header */}
      <div className="text-center mb-16 space-y-8">
        <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter uppercase italic leading-none">
          Growth <span className="text-primary">Metrics</span>
        </h1>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl border font-black uppercase text-xs tracking-[0.2em] transition-all ${activeTab === 'overview' ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`}
          >
            <LayoutGrid className="w-5 h-5" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl border font-black uppercase text-xs tracking-[0.2em] transition-all ${activeTab === 'heatmap' ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`}
          >
            <Map className="w-5 h-5" /> Knowledge Map
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MasteryHeatmap />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              { label: 'Total Study Time', value: formatTime(progressData.totalStudyTime), icon: Clock, color: 'bg-primary/10', iconColor: 'text-primary' },
              { label: 'Tasks Completed', value: progressData.completedTasks, icon: CheckCircle, color: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
              { label: 'Current Streak', value: `${progressData.streakDays} DAYS`, icon: Flame, color: 'bg-neo-accent/10', iconColor: 'text-neo-accent' },
              { label: 'Completion Rate', value: `${getCompletionRate()}%`, icon: Target, color: 'bg-cyan-500/10', iconColor: 'text-cyan-500' }
            ].map((stat, index) => (
              <div key={index} className="bg-card-dark border border-white/5 p-8 rounded-3xl shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-white/5" />
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl border border-white/5 ${stat.color} ${stat.iconColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-white tracking-tighter italic leading-none">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Weekly Progress Chart */}
            <div className="bg-card-dark border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
              <div className="flex items-center gap-5 mb-12">
                <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
                  <TrendingUp className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Weekly Activity</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">// Neural_Output_Volume</p>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData.weeklyProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#475569"
                      fontSize={11}
                      fontWeight="700"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569' }}
                    />
                    <YAxis
                      stroke="#475569"
                      fontSize={11}
                      fontWeight="700"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        fontSize: '12px',
                        fontWeight: '700',
                      }}
                      itemStyle={{ color: '#3680f7' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="#3680f7"
                      strokeWidth={4}
                      dot={{ fill: '#3680f7', stroke: '#0f172a', strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject Progress Chart */}
            <div className="bg-card-dark border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
              <div className="flex items-center gap-5 mb-12">
                <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/5">
                  <BarChart3 className="w-7 h-7 text-cyan-500" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Subject Status</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">// Knowledge_Density_Map</p>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData.subjectProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="subject"
                      stroke="#475569"
                      fontSize={11}
                      fontWeight="700"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#475569"
                      fontSize={11}
                      fontWeight="700"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '1rem',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        fontSize: '12px',
                        fontWeight: '700',
                      }}
                    />
                    <Bar
                      dataKey="completed"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="total"
                      fill="#1e293b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          <div className="bg-card-dark border border-white/5 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="flex items-center gap-6 mb-16">
              <div className="w-20 h-20 bg-neo-accent/10 border border-neo-accent/20 rounded-3xl flex items-center justify-center shadow-xl shadow-neo-accent/5 rotate-3">
                <Trophy className="w-10 h-10 text-neo-accent" />
              </div>
              <h3 className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">Achievements</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { title: 'Study Streak', desc: `Maintained ${progressData.streakDays} Day Streak`, icon: Star, color: 'bg-primary/10', iconColor: 'text-primary' },
                { title: 'Task Master', desc: `Completed ${progressData.completedTasks} Tasks`, icon: CheckCircle, color: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
                { title: 'Time Warrior', desc: `Studied for ${formatTime(progressData.totalStudyTime)}`, icon: Zap, color: 'bg-neo-accent/10', iconColor: 'text-neo-accent' }
              ].map((achievement, idx) => (
                <div key={idx} className="flex items-center gap-8 p-10 bg-slate-900 border border-white/5 rounded-[2.5rem] shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                  <div className={`w-20 h-20 rounded-2.5xl border border-white/5 flex-shrink-0 ${achievement.color} ${achievement.iconColor} flex items-center justify-center shadow-lg group-hover:-rotate-12 transition-transform`}>
                    <achievement.icon className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="font-black text-white uppercase tracking-tighter italic text-2xl mb-2">{achievement.title}</h4>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-snug">{achievement.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
