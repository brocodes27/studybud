import { TrendingUp, CheckCircle, Clock, Target, BarChart3, Zap, Trophy, Flame, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';

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

  const calculateStudyStreak = (sessions: any[], completions: any[]) => {
    // Get all unique dates when user had activity (either study sessions or task completions)
    const activityDates = new Set<string>();

    sessions?.forEach(session => {
      if (session.completed_at) {
        const date = format(new Date(session.completed_at), 'yyyy-MM-dd');
        activityDates.add(date);
      }
    });

    completions?.forEach(completion => {
      if (completion.completed_at) {
        const date = format(new Date(completion.completed_at), 'yyyy-MM-dd');
        activityDates.add(date);
      }
    });

    if (activityDates.size === 0) return 0;

    // Convert to sorted array of dates
    const sortedDates = Array.from(activityDates)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => b.getTime() - a.getTime()); // Most recent first

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    // Check if there's activity today or yesterday (to account for different time zones)
    const mostRecentActivity = sortedDates[0];
    const daysSinceLastActivity = differenceInDays(today, mostRecentActivity);

    if (daysSinceLastActivity > 1) {
      return 0; // Streak is broken if no activity for more than 1 day
    }

    // Count consecutive days with activity
    for (let i = 0; i < sortedDates.length; i++) {
      const activityDate = sortedDates[i];
      activityDate.setHours(0, 0, 0, 0);

      const daysDiff = differenceInDays(currentDate, activityDate);

      if (daysDiff === 0) {
        // Activity on current date
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (daysDiff === 1) {
        // Activity on previous date
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Gap in activity, streak ends
        break;
      }
    }

    return streak;
  };

  const fetchProgressData = async () => {
    try {
      // Fetch study sessions
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id);

      // Fetch task completions
      const { data: completions } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user.id);

      // Fetch exam plans to calculate total tasks
      const { data: plans } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user.id);

      // Calculate total study time
      const totalStudyTime = sessions?.reduce((total, session) => {
        if (session.duration_minutes) {
          return total + session.duration_minutes;
        }
        return total;
      }, 0) || 0;

      // Calculate completed tasks
      const completedTasks = completions?.length || 0;

      // Calculate total tasks from plans
      let totalTasks = 0;
      const subjectStats: Record<string, { total: number; completed: number }> = {};

      plans?.forEach(plan => {
        const subject = plan.subject || 'General';
        if (!subjectStats[subject]) {
          subjectStats[subject] = { total: 0, completed: 0 };
        }

        const dailySchedule = plan.plan?.daily_schedule || [];
        // Each day in the schedule counts as a task
        const tasksCount = dailySchedule.length;
        
        totalTasks += tasksCount;
        subjectStats[subject].total += tasksCount;
      });

      // Map completions to subjects
      // Note: task_completions references plan_id, so we can link it back
      completions?.forEach(completion => {
        const plan = plans?.find(p => p.id === completion.plan_id);
        if (plan) {
          const subject = plan.subject || 'General';
          if (subjectStats[subject]) {
            subjectStats[subject].completed += 1;
          }
        }
      });

      // Convert subjectStats to array
      const subjectProgress = Object.entries(subjectStats).map(([subject, stats]) => ({
        subject,
        total: stats.total,
        completed: stats.completed
      }));

      // Calculate streak
      const streakDays = calculateStudyStreak(sessions || [], completions || []);

      // Generate weekly progress data
      const weeklyProgress = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');

        const daySessions = sessions?.filter(session =>
          session.completed_at && format(new Date(session.completed_at), 'yyyy-MM-dd') === dateStr
        ) || [];

        const dayMinutes = daySessions.reduce((total, session) =>
          total + (session.duration_minutes || 0), 0
        );

        const dayTasks = completions?.filter(completion =>
          completion.completed_at && format(new Date(completion.completed_at), 'yyyy-MM-dd') === dateStr
        ).length || 0;

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
    <div className="space-y-12 animate-fade-in relative pb-20">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-6xl md:text-8xl font-black text-black mb-6 tracking-tighter uppercase italic">
          GROWTH <span className="bg-neo-accent text-white px-6 py-2 inline-block -rotate-2 border-4 border-black shadow-[8px_8px_0px_0px_#000]">METRICS</span>
        </h1>
        <p className="text-black font-bold text-xl uppercase tracking-widest bg-neo-secondary border-4 border-black px-6 py-2 inline-block rotate-1 shadow-[4px_4px_0px_0px_#000]">
          VISUALIZING MENTAL ACQUISITION
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {[
          { label: 'TOTAL STUDY TIME', value: formatTime(progressData.totalStudyTime), icon: Clock, color: 'bg-neo-muted' },
          { label: 'TASKS COMPLETED', value: progressData.completedTasks, icon: CheckCircle, color: 'bg-neo-secondary' },
          { label: 'CURRENT STREAK', value: `${progressData.streakDays} DAYS`, icon: Flame, color: 'bg-neo-accent', text: 'text-white' },
          { label: 'COMPLETION RATE', value: `${getCompletionRate()}%`, icon: Target, color: 'bg-white' }
        ].map((stat, index) => (
          <div key={index} className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] hover:translate-y-[-4px] transition-all group">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 border-4 border-black ${stat.color} ${stat.text || 'text-black'} flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:rotate-6 transition-transform`}>
                <stat.icon className="w-8 h-8 stroke-[3px]" />
              </div>
              <div>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-black text-black tracking-tighter italic leading-none mt-1">{stat.value}</p>
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
    </div>
  );
}
