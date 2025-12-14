import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, TrendingUp, Plus, Target, CheckCircle, AlertCircle, Sparkles, Crown, ArrowRight, Flame, Activity, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { Button } from '../components/Button';

interface StudyPlan {
  id: string;
  subject: string;
  exam_date: string;
  plan: {
    days_until_exam: number;
    daily_schedule: Array<{
      day: number;
      date: string;
      topic: string;
      completed?: boolean;
    }>;
  };
  created_at: string;
}

interface StudyStats {
  totalPlans: number;
  activePlans: number;
  completedTasks: number;
  upcomingExams: number;
}

export function Dashboard() {
  const { user, role, loading, isPremium, fullName } = useAuth() as any;

  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    totalPlans: 0,
    activePlans: 0,
    completedTasks: 0,
    upcomingExams: 0
  });
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [usageDaysThisMonth, setUsageDaysThisMonth] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [latestNotif, setLatestNotif] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchUsageThisMonth();
    }
  }, [user]);

  useEffect(() => {
    const fetchLatestNotif = async () => {
      if (!user || role === 'teacher') return;
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error) setLatestNotif((data && data[0]) || null);
      } finally { }
    };
    fetchLatestNotif();
  }, [user, role]);

  const fetchUsageThisMonth = async () => {
    if (!user) return;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const { data, error } = await supabase
      .from('exam_plans')
      .select('plan,created_at')
      .eq('user_id', user.id)
      .gte('created_at', firstDay.toISOString())
      .lte('created_at', lastDay.toISOString());
    if (error) {
      setUsageDaysThisMonth(0);
      return;
    }
    let totalDays = 0;
    for (const plan of data || []) {
      totalDays += plan.plan?.days_until_exam || 0;
    }
    setUsageDaysThisMonth(totalDays);
  };

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error fetching plans:', error);
      } else {
        setStudyPlans(data || []);
        calculateStats(data || []);
        extractTodaysTasks(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  const calculateStats = async (plans: StudyPlan[]) => {
    const today = new Date();
    const activePlans = plans.filter(plan => new Date(plan.exam_date) > today);
    const upcomingExams = plans.filter(plan => {
      const examDate = new Date(plan.exam_date);
      const daysUntil = differenceInDays(examDate, today);
      return daysUntil <= 7 && daysUntil >= 0;
    });

    try {
      const { data: completions, error } = await supabase
        .from('task_completions')
        .select('id')
        .eq('user_id', user?.id);

      if (error) throw error;

      setStats({
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedTasks: completions?.length || 0,
        upcomingExams: upcomingExams.length
      });
    } catch (error) {
      setStats({
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedTasks: 0,
        upcomingExams: upcomingExams.length
      });
    }
  };

  const extractTodaysTasks = async (plans: StudyPlan[]) => {
    const today = new Date();
    const tasks: any[] = [];

    try {
      const { data: completions, error } = await supabase
        .from('task_completions')
        .select('plan_id, day_number')
        .eq('user_id', user?.id);

      if (error) throw error;

      const completedTasks = new Set(
        completions?.map(c => `${c.plan_id}-${c.day_number}`) || []
      );

      plans.forEach(plan => {
        const planCreatedDate = new Date(plan.created_at);
        const daysSinceCreated = Math.floor((today.getTime() - planCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentStudyDay = daysSinceCreated + 1;

        const currentTask = plan.plan.daily_schedule.find(task => task.day === currentStudyDay);

        if (currentTask) {
          const taskKey = `${plan.id}-${currentTask.day}`;
          const isCompleted = completedTasks.has(taskKey);

          tasks.push({
            planId: plan.id,
            subject: plan.subject,
            topic: currentTask.topic,
            day: currentTask.day,
            completed: isCompleted,
            examDate: plan.exam_date
          });
        }
      });

      setTodaysTasks(tasks);
    } catch (error) {
      console.error('Error extracting tasks:', error);
      setTodaysTasks([]);
    }
  };

  if (loading || dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  const upcomingExam = studyPlans
    .filter(plan => new Date(plan.exam_date) > new Date())
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())[0];

  const displayName =
    fullName ||
    user?.user_metadata?.full_name ||
    (typeof user?.full_name === 'string' ? user.full_name : undefined) ||
    (typeof user?.email === 'string' ? user.email.split('@')[0] : undefined) ||
    'Student';

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 md:p-12 border border-white/10">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-neon-blue/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-neon-purple/20 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-cyan-300">{displayName}</span>
            </h1>
            <p className="text-gray-300 text-lg max-w-xl">
              Your AI learning assistant is ready. You have <span className="text-neon-green font-bold">{todaysTasks.length} tasks</span> scheduled for today.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <Link to="/create">
                <button className="btn-primary flex items-center gap-2 group">
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  Create New Plan
                </button>
              </Link>
              <Link to="/tools">
                <button className="btn-secondary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-neon-purple" />
                  Explore Tools
                </button>
              </Link>
            </div>
          </div>

          {/* Streak Widget */}
          <div className="glass-card p-6 rounded-2xl flex flex-col items-center min-w-[160px] border border-white/10 bg-black/20">
            <div className="relative">
              <Flame className="w-12 h-12 text-orange-500 animate-pulse" />
              <div className="absolute inset-0 blur-lg bg-orange-500/30"></div>
            </div>
            <span className="text-3xl font-bold text-white mt-2">3</span>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Day Streak</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Plans', value: stats.totalPlans, icon: BookOpen, color: 'text-neon-blue', bg: 'bg-neon-blue/10', border: 'border-neon-blue/20' },
          { label: 'Active Plans', value: stats.activePlans, icon: Target, color: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/20' },
          { label: 'Tasks Done', value: stats.completedTasks, icon: CheckCircle, color: 'text-neon-purple', bg: 'bg-neon-purple/10', border: 'border-neon-purple/20' },
          { label: 'Upcoming Exams', value: stats.upcomingExams, icon: AlertCircle, color: 'text-neon-yellow', bg: 'bg-neon-yellow/10', border: 'border-neon-yellow/20' }
        ].map((stat, index) => (
          <div key={index} className={`glass-card p-6 border ${stat.border} hover:scale-[1.02] transition-transform duration-300 group`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <TrendingUp className={`w-4 h-4 ${stat.color} opacity-50`} />
            </div>
            <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Activity className="w-6 h-6 text-neon-blue" />
              Today's Focus
            </h2>
            <Link to="/calendar" className="text-sm text-neon-blue hover:text-cyan-300 transition-colors">
              View Calendar →
            </Link>
          </div>

          {todaysTasks.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border-dashed border-2 border-white/10">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No tasks for today</h3>
              <p className="text-gray-400 mb-6">Take a break or start a new learning journey.</p>
              <Link to="/create">
                <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
                  Create Study Plan
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysTasks.map((task, index) => (
                <div key={index} className="glass-card p-6 border border-white/5 hover:border-neon-blue/30 transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-blue to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neon-blue border border-white/10">
                          {task.subject}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Day {task.day}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-neon-blue transition-colors">
                        {task.topic}
                      </h3>
                    </div>

                    <Link to={`/study/${task.planId}`}>
                      <button className={`
                        px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2
                        ${task.completed
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-neon-blue text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:shadow-[0_0_25px_rgba(0,243,255,0.5)]'
                        }
                      `}>
                        {task.completed ? (
                          <>
                            <CheckCircle className="w-4 h-4" /> Completed
                          </>
                        ) : (
                          <>
                            Start Session <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Next Exam Widget */}
          {upcomingExam ? (
            <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-neon-yellow/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-neon-yellow" />
                Next Exam
              </h3>
              <div className="relative z-10">
                <div className="text-3xl font-bold text-white mb-1">
                  {differenceInDays(new Date(upcomingExam.exam_date), new Date())}
                </div>
                <div className="text-sm text-gray-400 mb-4">Days Remaining</div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                  <div className="font-semibold text-neon-yellow mb-1">{upcomingExam.subject}</div>
                  <div className="text-xs text-gray-400">{format(new Date(upcomingExam.exam_date), 'MMMM do, yyyy')}</div>
                </div>

                <Link to={`/study/${upcomingExam.id}`}>
                  <button className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-white/10">
                    Prepare Now
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-3xl text-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400 text-sm mb-4">No upcoming exams</p>
              <Link to="/create">
                <button className="text-neon-blue text-sm hover:underline">Schedule an exam</button>
              </Link>
            </div>
          )}

          {/* Premium Banner */}
          {!isPremium && (
            <div className="glass-panel p-6 rounded-3xl border border-neon-purple/30 relative overflow-hidden group cursor-pointer hover:border-neon-purple/50 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/10 to-transparent opacity-50"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-neon-purple/20 text-neon-purple">
                    <Crown className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white">Go Premium</h3>
                </div>
                <p className="text-sm text-gray-300 mb-4">Unlock unlimited study plans, AI mentoring, and advanced analytics.</p>
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-neon-purple to-pink-600 text-white font-bold text-sm shadow-lg shadow-neon-purple/20 group-hover:shadow-neon-purple/40 transition-all">
                  Upgrade Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}