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
        supabase.from('user_gamification').select('*').eq('user_id', user.id).single()
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
        <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
        <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">CALCULATING_TRAJECTORY...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative pb-16">
      {/* Header */}
      <div className="text-center mb-10 space-y-6">
        <h1 className="text-5xl md:text-6xl font-black text-black mb-4 tracking-tight uppercase italic">
          GROWTH <span className="bg-neo-accent text-white px-4 py-1.5 inline-block -rotate-1 border-2 border-black shadow-[4px_4px_0px_0px_#000]">METRICS</span>
        </h1>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-6 py-3 border-2 border-black font-black uppercase text-xs tracking-wider transition-all shadow-[4px_4px_0px_0px_#000] active:translate-y-0.5 active:shadow-none ${activeTab === 'overview' ? 'bg-neo-secondary text-black' : 'bg-white hover:bg-neo-bg'}`}
          >
            <LayoutGrid className="w-4 h-4" /> OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`flex items-center gap-2 px-6 py-3 border-2 border-black font-black uppercase text-xs tracking-wider transition-all shadow-[4px_4px_0px_0px_#000] active:translate-y-0.5 active:shadow-none ${activeTab === 'heatmap' ? 'bg-black text-white' : 'bg-white hover:bg-neo-bg'}`}
          >
            <Map className="w-4 h-4" /> KNOWLEDGE MAP
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <MasteryHeatmap />
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'TOTAL STUDY TIME', value: formatTime(progressData.totalStudyTime), icon: Clock, color: 'bg-neo-muted' },
              { label: 'TASKS COMPLETED', value: progressData.completedTasks, icon: CheckCircle, color: 'bg-neo-secondary' },
              { label: 'CURRENT STREAK', value: `${progressData.streakDays} DAYS`, icon: Flame, color: 'bg-neo-accent', text: 'text-white' },
              { label: 'COMPLETION RATE', value: `${getCompletionRate()}%`, icon: Target, color: 'bg-white' }
            ].map((stat, index) => (
              <div key={index} className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_0px_#000] hover:translate-y-[-2px] transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 border-2 border-black ${stat.color} ${stat.text || 'text-black'} flex items-center justify-center shadow-[2px_2px_0px_0px_#000] group-hover:rotate-6 transition-transform`}>
                    <stat.icon className="w-5 h-5 stroke-[2px]" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-xl font-black text-black tracking-tight italic leading-none mt-0.5">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
            {/* Weekly Progress Chart */}
            <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] rotate-1">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-neo-accent border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] -rotate-6">
                  <TrendingUp className="w-6 h-6 text-white stroke-[3px]" />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tight italic">WEEKLY ACTIVITY</h3>
              </div>
              <div className="h-80 border-2 border-black/5 p-4 bg-neo-bg/30">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData.weeklyProgress}>
                    <CartesianGrid strokeDasharray="0" stroke="#000" strokeOpacity={0.1} />
                    <XAxis
                      dataKey="date"
                      stroke="#000"
                      fontSize={10}
                      fontWeight="900"
                      tick={{ fill: '#000' }}
                    />
                    <YAxis
                      stroke="#000"
                      fontSize={10}
                      fontWeight="900"
                      tick={{ fill: '#000' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '4px solid #000',
                        borderRadius: '0',
                        boxShadow: '4px 4px 0px 0px #000',
                        fontSize: '10px',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                      }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="minutes"
                      stroke="#FF6B6B"
                      strokeWidth={4}
                      dot={{ fill: '#000', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#000', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject Progress Chart */}
            <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] -rotate-1">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-neo-secondary border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000] rotate-6">
                  <BarChart3 className="w-6 h-6 text-black stroke-[3px]" />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tight italic">SUBJECT STATUS</h3>
              </div>
              <div className="h-80 border-2 border-black/5 p-4 bg-neo-bg/30">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressData.subjectProgress}>
                    <CartesianGrid strokeDasharray="0" stroke="#000" strokeOpacity={0.1} />
                    <XAxis
                      dataKey="subject"
                      stroke="#000"
                      fontSize={10}
                      fontWeight="900"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: '#000' }}
                    />
                    <YAxis
                      stroke="#000"
                      fontSize={10}
                      fontWeight="900"
                      tick={{ fill: '#000' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '4px solid #000',
                        borderRadius: '0',
                        boxShadow: '4px 4px 0px 0px #000',
                        fontSize: '10px',
                        fontWeight: '900',
                        textTransform: 'uppercase'
                      }}
                    />
                    <Bar
                      dataKey="completed"
                      fill="#4D96FF"
                      stroke="#000"
                      strokeWidth={2}
                    />
                    <Bar
                      dataKey="total"
                      fill="#fff"
                      stroke="#000"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          <div className="bg-white border-4 border-black p-10 shadow-[16px_16px_0px_0px_#000]">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-16 h-16 bg-neo-muted border-4 border-black flex items-center justify-center shadow-[6px_6px_0px_0px_#000] -rotate-12">
                <Trophy className="w-8 h-8 text-black stroke-[3px]" />
              </div>
              <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic">LATEST ACHIEVEMENTS</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: 'STUDY STREAK', desc: `MAINTAINED ${progressData.streakDays} DAY STREAK`, icon: Star, color: 'bg-neo-accent', text: 'text-white' },
                { title: 'TASK MASTER', desc: `COMPLETED ${progressData.completedTasks} TASKS`, icon: CheckCircle, color: 'bg-neo-secondary' },
                { title: 'TIME WARRIOR', desc: `STUDIED FOR ${formatTime(progressData.totalStudyTime)}`, icon: Zap, color: 'bg-neo-muted' }
              ].map((achievement, idx) => (
                <div key={idx} className="flex items-center gap-6 p-6 bg-neo-bg border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:rotate-1 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_#000] transition-all group">
                  <div className={`w-16 h-16 border-4 border-black flex-shrink-0 ${achievement.color} ${achievement.text || 'text-black'} flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:-rotate-12 transition-transform`}>
                    <achievement.icon className="w-8 h-8 stroke-[3px]" />
                  </div>
                  <div>
                    <h4 className="font-black text-black uppercase tracking-tight italic text-lg">{achievement.title}</h4>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-snug mt-1">{achievement.desc}</p>
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
