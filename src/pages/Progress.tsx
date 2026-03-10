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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <p className="text-sm font-bold text-[#64748B]">Loading your progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in relative pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan">
            <TrendingUp className="h-7 w-7 text-[#00D1FF] stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Growth Metrics</h1>
            <p className="text-[#64748B] font-medium">Track your learning progress over time</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-[14px] border-2 font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-[#00D1FF] border-[#00D1FF] text-[#0A192F] shadow-float-cyan' : 'bg-white border-[#0A192F]/10 text-[#64748B] hover:border-[#00D1FF]/30'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-[14px] border-2 font-bold text-sm transition-all ${activeTab === 'heatmap' ? 'bg-[#00D1FF] border-[#00D1FF] text-[#0A192F] shadow-float-cyan' : 'bg-white border-[#0A192F]/10 text-[#64748B] hover:border-[#00D1FF]/30'}`}
          >
            <Map className="w-4 h-4" /> Knowledge Map
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MasteryHeatmap />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: 'Total Study Time', value: formatTime(progressData.totalStudyTime), icon: Clock, iconColor: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10 border-[#00D1FF]/20' },
              { label: 'Tasks Completed', value: String(progressData.completedTasks), icon: CheckCircle, iconColor: 'text-[#34D399]', bg: 'bg-[#34D399]/10 border-[#34D399]/20' },
              { label: 'Current Streak', value: `${progressData.streakDays} days`, icon: Flame, iconColor: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10 border-[#F472B6]/20' },
              { label: 'Completion Rate', value: `${getCompletionRate()}%`, icon: Target, iconColor: 'text-[#64748B]', bg: 'bg-slate-100 border-[#0A192F]/5' }
            ].map((stat, index) => (
              <div key={index} className="neo-card hover:-translate-y-1 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-[14px] border flex items-center justify-center shrink-0 ${stat.bg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor} stroke-[2px]`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">{stat.label}</p>
                    <p className="text-2xl font-extrabold text-[#0A192F] tracking-tight leading-none mt-0.5">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Weekly Progress Chart */}
            <div className="neo-card">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[14px] flex items-center justify-center shadow-float-cyan">
                  <TrendingUp className="w-6 h-6 text-[#00D1FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Weekly Activity</h3>
                  <p className="text-xs font-medium text-[#64748B]">Study minutes per day</p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData.weeklyProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,25,47,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      fontWeight="600"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      fontWeight="600"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '2px solid rgba(10,25,47,0.08)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,209,255,0.1)',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                      itemStyle={{ color: '#00D1FF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="#00D1FF"
                      strokeWidth={3}
                      dot={{ fill: '#00D1FF', stroke: '#ffffff', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, stroke: '#0A192F', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject Progress Chart */}
            <div className="neo-card">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[14px] flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-[#34D399]" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Subject Progress</h3>
                  <p className="text-xs font-medium text-[#64748B]">Completed vs. total tasks</p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData.subjectProgress}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(10,25,47,0.05)" vertical={false} />
                    <XAxis
                      dataKey="subject"
                      stroke="#94a3b8"
                      fontSize={11}
                      fontWeight="600"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      fontWeight="600"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '2px solid rgba(10,25,47,0.08)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0,209,255,0.1)',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    />
                    <Bar dataKey="completed" fill="#00D1FF" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="total" fill="rgba(10,25,47,0.06)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          <div className="neo-card">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[14px] flex items-center justify-center">
                <Trophy className="w-6 h-6 text-[#F472B6]" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Achievements</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { title: 'Study Streak', desc: `${progressData.streakDays} day streak maintained`, icon: Star, iconColor: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10 border-[#00D1FF]/20' },
                { title: 'Task Master', desc: `${progressData.completedTasks} tasks completed`, icon: CheckCircle, iconColor: 'text-[#34D399]', bg: 'bg-[#34D399]/10 border-[#34D399]/20' },
                { title: 'Time Warrior', desc: `${formatTime(progressData.totalStudyTime)} total study time`, icon: Zap, iconColor: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10 border-[#F472B6]/20' }
              ].map((achievement, idx) => (
                <div key={idx} className="flex items-center gap-5 p-6 bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[20px] hover:-translate-y-1 transition-all group">
                  <div className={`w-14 h-14 rounded-[16px] border flex-shrink-0 ${achievement.bg} ${achievement.iconColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <achievement.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#0A192F] tracking-tight text-base">{achievement.title}</h4>
                    <p className="text-xs font-medium text-[#64748B] mt-0.5">{achievement.desc}</p>
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
