import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  CheckCircle,
  ArrowRight,
  Flame,
  Target,
  Trophy,
  Calendar,
  Brain,
  ListChecks,
  Mic,
  Timer,
  BatteryMedium,
  Ghost
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

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

// Vibe Check Component
const VibeCheck = ({ onSelect }: { onSelect: (vibe: string) => void }) => {
  const vibes = [
    { id: 'fire', label: 'ON FIRE', icon: Zap, color: 'bg-[#F472B6]', shadow: 'shadow-float-pink', text: 'Ready to conquer!' },
    { id: 'ok', label: 'STEADY', icon: Brain, color: 'bg-[#00D1FF]', shadow: 'shadow-float-cyan', text: 'Focused and steady.' },
    { id: 'tired', label: 'DRAINED', icon: BatteryMedium, color: 'bg-[#34D399]', shadow: 'shadow-float-mint', text: 'Lower energy today.' },
    { id: 'dead', label: 'COOKED', icon: Ghost, color: 'bg-slate-300', shadow: 'shadow-neo', text: 'Survival mode active.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-8 md:p-12 rounded-[40px] mb-12 border-4 border-[#0A192F]/5 shadow-sm relative overflow-hidden"
    >
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#00D1FF]/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex flex-col mb-10 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0A192F] mb-4">Status Report, <span className="text-[#00D1FF]">Agent.</span></h2>
        <p className="text-[#64748B] text-lg font-medium">Initialize your mindset for this session.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
        {vibes.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`group relative flex flex-col items-center p-8 bg-slate-50 border-4 border-transparent rounded-[32px] hover:bg-white hover:border-[#0A192F]/10 hover:-translate-y-2 transition-all duration-300 ${v.shadow}`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${v.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
              <v.icon size={28} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-xl text-[#0A192F] tracking-tight mb-2">{v.label}</span>
            <span className="text-sm text-[#64748B] text-center font-medium leading-tight">{v.text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export function Dashboard() {
  const { user, role, loading, fullName } = useAuth() as any;
  const { showToast } = useToast();

  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [stats, setStats] = useState({
    totalPlans: 0,
    activePlans: 0,
    completedTasks: 0,
    upcomingExams: 0,
    streak: 0,
    xp: 0
  });
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [vibe, setVibe] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('GOOD EVENING');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user?.id);

      if (error) {
        showToast('DATA_FETCH_ERROR', 'error');
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
    const upcomingExamsList = plans.filter(plan => {
      const examDate = new Date(plan.exam_date);
      const daysUntil = differenceInDays(examDate, today);
      return daysUntil <= 7 && daysUntil >= 0;
    });

    try {
      const { data: completions } = await supabase
        .from('task_completions')
        .select('id')
        .eq('user_id', user?.id);

      const { data: gamification } = await supabase
        .from('user_gamification')
        .select('current_streak, total_xp')
        .eq('user_id', user.id)
        .maybeSingle();

      setStats({
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedTasks: completions?.length || 0,
        upcomingExams: upcomingExamsList.length,
        streak: gamification?.current_streak || 0,
        xp: gamification?.total_xp || 0
      });
    } catch (error) {
      console.error('Stats calc error', error);
    }
  };

  const extractTodaysTasks = async (plans: StudyPlan[]) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tasks: any[] = [];

    try {
      const { data: completions } = await supabase
        .from('task_completions')
        .select('plan_id, day_number')
        .eq('user_id', user?.id);

      const completedKeys = new Set(completions?.map(c => `${c.plan_id}-${c.day_number}`) || []);

      plans.forEach(plan => {
        const planCreatedDate = new Date(plan.created_at);
        const daysSinceCreated = Math.floor((startOfToday.getTime() - planCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentStudyDay = daysSinceCreated + 1;

        const currentTask = plan.plan.daily_schedule.find(task => task.day === currentStudyDay);

        if (currentTask) {
          tasks.push({
            planId: plan.id,
            subject: plan.subject,
            topic: currentTask.topic,
            day: currentTask.day,
            completed: completedKeys.has(`${plan.id}-${currentTask.day}`),
            examDate: plan.exam_date
          });
        }
      });

      setTodaysTasks(tasks);
    } catch (error) {
      console.error('Task extraction error', error);
    }
  };

  if (loading || dashboardLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin"></div>
        <p className="mt-6 font-extrabold tracking-widest text-[#0A192F] uppercase">Loading Elevenfolks...</p>
      </div>
    );
  }

  if (role === 'teacher') return <Navigate to="/teacher" replace />;

  const displayName = fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const primaryTask = todaysTasks.find(t => !t.completed) || todaysTasks[0];
  const remainingCount = todaysTasks.filter(t => !t.completed).length;

  const upcomingExam = studyPlans
    .filter(plan => new Date(plan.exam_date) > new Date())
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())[0];

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <AnimatePresence>
        {!vibe && (
          <VibeCheck onSelect={setVibe} />
        )}
      </AnimatePresence>

      {vibe && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-12"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0A192F] tracking-tight">
              {greeting}, <span className="text-[#00D1FF]">{displayName}</span>
            </h1>
            <div className="bg-white px-6 py-3 rounded-full flex items-center justify-between sm:justify-start gap-4 shadow-sm border-2 border-[#0A192F]/5">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-[#F472B6] fill-[#F472B6]" />
                <span className="font-extrabold text-2xl text-[#0A192F] tabular-nums">{stats.streak.toString().padStart(2, '0')}</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#64748B]">Day Streak</span>
            </div>
          </div>

          {/* Hero Banner Module */}
          <div className="relative overflow-hidden rounded-[40px] bg-[#0A192F] p-8 md:p-12 shadow-[0_20px_40px_rgba(10,25,47,0.15)] flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#00D1FF] rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#F472B6] rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob animation-delay-2000" />

            <div className="relative z-10 space-y-6 max-w-2xl text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full font-bold text-xs uppercase tracking-widest text-[#00D1FF] backdrop-blur-sm">
                <Target className="w-4 h-4" /> Priority Target
              </div>

              <div>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 text-white">
                  {primaryTask?.subject || "Establish Objective"}
                </h2>
                <p className="text-slate-300 text-lg md:text-xl font-medium leading-relaxed">
                  {primaryTask?.topic || "Initialize a new study plan to begin your focus campaign."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                {primaryTask ? (
                  <Link to={`/study/${primaryTask.planId}`} className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto neo-button bg-[#00D1FF] text-[#0A192F] px-10 py-5 text-xl font-extrabold hover:scale-105 transition-transform shadow-float-cyan flex items-center justify-center gap-3">
                      Engage Task <ArrowRight className="h-6 w-6 stroke-[3px]" />
                    </button>
                  </Link>
                ) : (
                  <Link to="/create" className="w-full sm:w-auto">
                    <button className="w-full sm:w-auto neo-button bg-[#00D1FF] text-[#0A192F] px-10 py-5 text-xl font-extrabold hover:scale-105 transition-transform shadow-float-cyan flex items-center justify-center gap-3">
                      New Plan <Target className="h-6 w-6 stroke-[3px]" />
                    </button>
                  </Link>
                )}

                <div className="text-center sm:text-left">
                  <p className="font-extrabold text-2xl text-white">{remainingCount}</p>
                  <p className="text-sm font-bold uppercase tracking-widest text-[#F472B6]">Pending Today</p>
                </div>
              </div>
            </div>

            {/* Visual Element Right Side */}
            <div className="hidden md:flex relative z-10 p-8">
              <div className="w-48 h-48 bg-white/5 backdrop-blur-md rounded-[40px] border-4 border-white/10 flex items-center justify-center rotate-6 shadow-2xl">
                <Brain className="w-24 h-24 text-[#00D1FF] opacity-90" />
              </div>
            </div>
          </div>

          {/* Stats Grid - Massive numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Completed', val: stats.completedTasks, color: '#34D399', bg: 'bg-[#34D399]', shadow: 'shadow-float-mint' },
              { label: 'Total XP', val: stats.xp, color: '#00D1FF', bg: 'bg-[#00D1FF]', shadow: 'shadow-float-cyan' },
              { label: 'Active Plans', val: stats.activePlans, color: '#F472B6', bg: 'bg-[#F472B6]', shadow: 'shadow-float-pink' },
              { label: 'Next Exam', val: upcomingExam ? format(new Date(upcomingExam.exam_date), 'MMM dd') : 'N/A', color: '#0A192F', bg: 'bg-[#0A192F]', shadow: 'shadow-neo', textLight: true },
            ].map((s, i) => (
              <div key={i} className={`p-8 rounded-[32px] ${s.bg} text-${s.textLight ? 'white' : '[#0A192F]'} ${s.shadow} transform hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-6 opacity-20 transition-transform group-hover:scale-110 group-hover:rotate-12">
                  <Target className={`w-16 h-16 ${s.textLight ? 'text-white' : 'text-[#0A192F]'}`} />
                </div>
                <p className={`text-sm font-extrabold uppercase tracking-widest mb-2 opacity-80`}>{s.label}</p>
                <p className={`text-5xl font-extrabold tracking-tighter`}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* Main Layout Bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Mission Log */}
            <div className="lg:col-span-2">
              <div className="bg-white p-8 md:p-10 rounded-[40px] border-4 border-[#0A192F]/5 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full flex items-center justify-center">
                    <ListChecks className="w-6 h-6 stroke-[2.5px]" />
                  </div>
                  <h3 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Mission Log</h3>
                </div>

                <div className="space-y-4">
                  {todaysTasks.length > 0 ? (
                    todaysTasks.map((task, i) => (
                      <div
                        key={i}
                        className={`group relative flex items-center justify-between p-6 rounded-[24px] border-4 transition-all duration-300 ${task.completed
                          ? 'bg-slate-50 border-transparent opacity-60 grayscale'
                          : 'bg-white border-[#0A192F]/5 hover:border-[#00D1FF] hover:shadow-float-cyan'
                          }`}
                      >
                        <div className="flex items-center gap-6">
                          <button className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${task.completed ? 'bg-[#34D399] border-[#34D399] text-white' : 'border-[#64748B] text-transparent hover:border-[#00D1FF]'}`}>
                            <CheckCircle size={16} strokeWidth={3} />
                          </button>
                          <div>
                            <h4 className={`text-xl font-extrabold mb-1 transition-all ${task.completed ? 'text-slate-400 line-through' : 'text-[#0A192F]'}`}>
                              {task.topic}
                            </h4>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-500 uppercase">
                                {task.subject}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!task.completed && (
                          <Link to={`/study/${task.planId}`}>
                            <button className="w-12 h-12 bg-[#0A192F] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-[#00D1FF] shadow-md">
                              <ArrowRight size={20} strokeWidth={3} />
                            </button>
                          </Link>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-16 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[32px]">
                      <p className="font-extrabold text-xl text-slate-400 uppercase tracking-widest">No mission targets today.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Modules */}
            <div className="space-y-10">

              {/* Focus Deck mini widget */}
              <div className="bg-[#0A192F] text-white p-8 rounded-[40px] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F472B6]/20 rounded-full blur-[40px] pointer-events-none" />

                <div className="flex items-center gap-3 mb-8 relative z-10">
                  <div className="w-10 h-10 bg-[#00D1FF] rounded-full flex items-center justify-center text-[#0A192F]">
                    <Timer size={20} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">Focus Deck</h3>
                </div>

                <div className="text-center py-6 bg-white/5 rounded-[24px] border border-white/10 mb-8 relative z-10">
                  <span className="text-6xl font-extrabold tracking-tighter text-white">25<span className="text-[#00D1FF]">:</span>00</span>
                </div>

                <button className="w-full neo-button bg-[#00D1FF] text-[#0A192F] py-4 text-lg shadow-float-cyan hover:scale-[1.02] transition-transform relative z-10">
                  Initiate Focus
                </button>
              </div>

              {/* Quick Tools */}
              <div className="bg-white p-8 rounded-[40px] border-4 border-[#0A192F]/5 shadow-sm">
                <h3 className="text-xl font-extrabold text-[#0A192F] mb-6">Quick Tools</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'SAT Sim', icon: Target, path: '/sat-simulator', color: 'text-[#F472B6]', bg: 'bg-[#F472B6]/10' },
                    { label: 'Solver', icon: Zap, path: '/guided-paper', color: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/10' },
                    { label: 'Videos', icon: ListChecks, path: '/videos', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10' },
                    { label: 'Feynman', icon: Mic, path: '/feynman', color: 'text-[#A855F7]', bg: 'bg-[#A855F7]/10' }, // Kept one small purple icon as exception, or replace with another color. Let's replace with orange/gold
                  ].map((tool, i) => (
                    <Link
                      key={i}
                      to={tool.path}
                      className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 rounded-[24px] border-4 border-transparent hover:bg-white hover:border-[#0A192F]/10 hover:-translate-y-1 hover:shadow-lg transition-all"
                    >
                      <div className={`w-12 h-12 rounded-full ${tool.bg} ${tool.color} flex items-center justify-center`}>
                        <tool.icon size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-bold text-[#0A192F]">{tool.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

