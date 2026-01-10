import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, TrendingUp, Plus, Target, CheckCircle, AlertCircle, Sparkles, Crown, ArrowRight, Flame, Activity, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';

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
  // usageDaysThisMonth and latestNotif are not being used in the UI currently.
  // We'll keep the fetch logic for now but ignore the unused variable warnings.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_usageDaysThisMonth, setUsageDaysThisMonth] = useState<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_latestNotif, setLatestNotif] = useState<any | null>(null);

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
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Hero Section */}
      <div className="relative bg-white border-4 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] -rotate-1 group">
        <div className="absolute -top-4 -right-4 bg-neo-accent border-4 border-black p-3 shadow-[4px_4px_0px_0px_#000] rotate-12 group-hover:rotate-0 transition-transform">
          <Sparkles className="w-8 h-8 text-white stroke-[3px]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
          <div className="flex-1">
            <h1 className="text-5xl md:text-6xl font-black text-black mb-6 tracking-tighter uppercase italic leading-none">
              WELCOME BACK, <br />
              <span className="bg-neo-accent text-white px-4 py-1 inline-block -rotate-2 border-4 border-black shadow-[4px_4px_0px_0px_#000]">{displayName}</span>
            </h1>
            <p className="text-black font-bold text-xl max-w-xl leading-snug">
              YOUR AI MENTOR IS ONLINE. YOU HAVE <span className="underline decoration-neo-accent decoration-4">{todaysTasks.length} TASKS</span> TO SMASH TODAY.
            </p>
            <div className="flex flex-wrap gap-6 mt-10">
              <Link to="/create">
                <button className="bg-neo-secondary text-black font-black uppercase tracking-widest text-sm border-4 border-black px-8 py-4 shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] active:scale-95 transition-all flex items-center gap-3">
                  <Plus className="w-6 h-6 stroke-[3px]" />
                  CREATE NEW PLAN
                </button>
              </Link>
              <Link to="/tools">
                <button className="bg-white text-black font-black uppercase tracking-widest text-sm border-4 border-black px-8 py-4 shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] active:scale-95 transition-all flex items-center gap-3">
                  <Flame className="w-6 h-6 text-neo-accent stroke-[3px]" />
                  EXPLORE TOOLS
                </button>
              </Link>
            </div>
          </div>

          {/* Streak Widget */}
          <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] flex flex-col items-center min-w-[200px] rotate-3 hover:rotate-0 transition-transform">
            <div className="relative mb-4">
              <div className="bg-neo-accent p-4 border-4 border-black -rotate-12 shadow-[4px_4px_0px_0px_#000]">
                <Flame className="w-12 h-12 text-white stroke-[3px]" />
              </div>
            </div>
            <span className="text-5xl font-black text-black mt-2 tracking-tighter">03</span>
            <span className="text-xs font-black text-black/40 uppercase tracking-[0.2em] mt-2">DAY STREAK</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'TOTAL PLANS', value: stats.totalPlans, icon: BookOpen, color: 'bg-neo-muted' },
          { label: 'ACTIVE PLANS', value: stats.activePlans, icon: Target, color: 'bg-neo-secondary' },
          { label: 'TASKS DONE', value: stats.completedTasks, icon: CheckCircle, color: 'bg-neo-accent', text: 'text-white' },
          { label: 'UPCOMING EXAMS', value: stats.upcomingExams, icon: AlertCircle, color: 'bg-white' }
        ].map((stat, index) => (
          <div key={index} className={`bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] hover:translate-y-[-4px] transition-all group`}>
            <div className="flex items-center justify-between mb-6">
              <div className={`p-4 border-4 border-black shadow-[4px_4px_0px_0px_#000] ${stat.color} ${stat.text || 'text-black'} group-hover:rotate-6 transition-transform`}>
                <stat.icon className="w-8 h-8 stroke-[3px]" />
              </div>
              <TrendingUp className="w-6 h-6 text-black opacity-20" />
            </div>
            <p className="text-black/40 text-xs font-black uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-4xl font-black text-black tracking-tighter italic">{stat.value.toString().padStart(2, '0')}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Today's Tasks */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic flex items-center gap-4">
              <div className="bg-neo-accent p-2 border-4 border-black shadow-[4px_4px_0px_0px_#000] -rotate-6">
                <Activity className="w-6 h-6 text-white stroke-[3px]" />
              </div>
              TODAY'S MISSION
            </h2>
            <Link to="/plans" className="text-sm font-black uppercase tracking-widest text-black hover:underline underline-offset-8 decoration-4 decoration-neo-accent">
              VIEW ALL PLANS →
            </Link>
          </div>

          {todaysTasks.length === 0 ? (
            <div className="bg-white border-4 border-black p-16 text-center shadow-[10px_10px_0px_0px_#000] rotate-1">
              <div className="w-24 h-24 bg-neo-muted border-4 border-black flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_#000] rotate-12">
                <Calendar className="w-12 h-12 text-black stroke-[3px]" />
              </div>
              <h3 className="text-3xl font-black text-black uppercase tracking-tighter mb-4">NO TASKS TODAY</h3>
              <p className="text-black/60 font-bold mb-10 text-lg">RECHARGE YOUR BRAIN OR START A NEW CHAPTER.</p>
              <Link to="/create">
                <button className="bg-black text-white px-10 py-5 font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_#FF6B6B] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
                  CREATE STUDY PLAN
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {todaysTasks.map((task, index) => (
                <div key={index} className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] group relative overflow-hidden hover:rotate-1 transition-transform">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex-grow">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="px-4 py-1 border-2 border-black font-black uppercase text-[10px] tracking-widest bg-neo-secondary">
                          {task.subject}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                          <Clock className="w-4 h-4 stroke-[3px]" /> DAY {task.day}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-black uppercase tracking-tight italic group-hover:text-neo-accent transition-colors">
                        {task.topic}
                      </h3>
                    </div>

                    <Link to={`/study/${task.planId}`}>
                      <button className={`
                        px-8 py-4 border-4 border-black font-black uppercase tracking-widest text-sm transition-all shadow-[6px_6px_0px_0px_#000]
                        ${task.completed
                          ? 'bg-neo-muted text-black shadow-none translate-x-[2px] translate-y-[2px]'
                          : 'bg-neo-accent text-white hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]'
                        }
                      `}>
                        {task.completed ? (
                          <span className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 stroke-[3px]" /> DONE
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            START SESSION <ArrowRight className="w-5 h-5 stroke-[3px]" />
                          </span>
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
        <div className="space-y-10">
          {/* Next Exam Widget */}
          {upcomingExam ? (
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] relative overflow-hidden -rotate-2">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-neo-secondary/20 border-4 border-black rounded-full rotate-12"></div>
              <h3 className="text-xl font-black text-black mb-8 flex items-center gap-3 uppercase italic">
                <div className="bg-neo-secondary p-2 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <Trophy className="w-6 h-6 text-black stroke-[2.5px]" />
                </div>
                NEXT EXAM
              </h3>
              <div className="relative z-10">
                <div className="text-7xl font-black text-black mb-1 leading-none tracking-tighter italic">
                  {differenceInDays(new Date(upcomingExam.exam_date), new Date()).toString().padStart(2, '0')}
                </div>
                <div className="text-xs font-black text-black/40 uppercase tracking-widest mb-8">DAYS REMAINING</div>

                <div className="p-5 bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] mb-8 rotate-1">
                  <div className="font-black text-neo-accent uppercase tracking-tight text-lg mb-1">{upcomingExam.subject}</div>
                  <div className="text-[10px] font-black text-black/40 uppercase tracking-widest">{format(new Date(upcomingExam.exam_date), 'MMMM do, yyyy')}</div>
                </div>

                <Link to={`/study/${upcomingExam.id}`}>
                  <button className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-sm shadow-[6px_6px_0px_0px_#FFD93D] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all">
                    PREPARE NOW
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#000] text-center">
              <div className="w-16 h-16 bg-white border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_#000] rotate-12">
                <Trophy className="w-8 h-8 text-black/20 stroke-[2.5px]" />
              </div>
              <p className="text-black/40 font-black uppercase tracking-widest text-xs mb-6">NO UPCOMING EXAMS</p>
              <Link to="/create">
                <button className="text-neo-accent font-black uppercase tracking-widest text-xs hover:underline underline-offset-4 decoration-2">SCHEDULE AN EXAM</button>
              </Link>
            </div>
          )}

          {/* Premium Banner */}
          {!isPremium && (
            <div className="bg-black border-4 border-black p-8 shadow-[8px_8px_0px_0px_#C4B5FD] group cursor-pointer active:scale-95 transition-all">
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-neo-muted border-2 border-black shadow-[4px_4px_0px_0px_#FFF] -rotate-6">
                    <Crown className="w-6 h-6 text-black stroke-[2.5px]" />
                  </div>
                  <h3 className="font-black text-white uppercase tracking-widest text-lg italic">GO PREMIUM</h3>
                </div>
                <p className="text-white/70 font-bold mb-8 text-sm leading-snug uppercase tracking-tight">UNLOCK UNLIMITED PLANS, AI MENTORING, AND ADVANCED ANALYTICS.</p>
                <button className="w-full py-4 bg-neo-muted text-black font-black uppercase tracking-widest text-sm shadow-[6px_6px_0px_0px_#FFF] group-hover:bg-white transition-all">
                  UPGRADE NOW
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
