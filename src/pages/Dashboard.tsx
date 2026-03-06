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
  AlertCircle,
  Clock,
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
    { id: 'fire', label: 'ON FIRE', icon: Zap, color: 'bg-primary', text: 'Ready to conquer!' },
    { id: 'ok', label: 'STEADY', icon: Brain, color: 'bg-blue-500', text: 'Focused and steady.' },
    { id: 'tired', label: 'DRAINED', icon: BatteryMedium, color: 'bg-amber-500', text: 'Lower energy today.' },
    { id: 'dead', label: 'COOKED', icon: Ghost, color: 'bg-slate-500', text: 'Survival mode active.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-8 rounded-2xl mb-10 border-primary/20"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight italic uppercase">Status Report, Agent.</h2>
          <p className="text-slate-400 font-medium">Initialize your mindset for this session.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {vibes.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className="group relative flex flex-col items-center p-6 bg-card-dark/50 border border-white/5 rounded-xl hover:border-primary/40 hover:-translate-y-1 transition-all"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${v.color} text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
              <v.icon size={24} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg uppercase tracking-wider mb-1">{v.label}</span>
            <span className="text-xs text-slate-500 text-center font-medium leading-tight">{v.text}</span>
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
  const [userGoals, setUserGoals] = useState<any>(null);
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [vibe, setVibe] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('GOOD EVENING');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchUserGoals();
    }
  }, [user]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('GOOD MORNING');
    else if (hour < 18) setGreeting('GOOD AFTERNOON');
    else setGreeting('GOOD EVENING');
  }, []);

  const fetchUserGoals = async () => {
    try {
      const { data } = await supabase
        .from('user_study_goals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setUserGoals(data);
    } catch (e) {
      console.log('No goals found yet');
    }
  };

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
        <div className="w-16 h-16 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-6 font-bold tracking-[0.3em] text-slate-500 uppercase">Synchronizing Systems...</p>
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
    <div className="space-y-8 animate-fade-in pb-20">
      <AnimatePresence>
        {!vibe && (
          <VibeCheck onSelect={setVibe} />
        )}
      </AnimatePresence>

      {vibe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="relative group">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">{greeting}, {displayName}</h2>
              <div className="glass px-4 py-2 rounded-xl flex items-center justify-between sm:justify-start gap-3 shadow-lg shadow-black/10">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-neo-accent fill-neo-accent" />
                  <span className="font-bold text-xl tabular-nums">{stats.streak.toString().padStart(2, '0')}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Day Streak</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-card-dark to-card-dark border border-primary/30 p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
              <div className="relative z-10 space-y-4 max-w-xl">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider text-primary uppercase bg-primary/10 rounded-full border border-primary/20">
                    Priority Target
                  </span>
                  <span className="px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider text-slate-400 uppercase bg-slate-900/50 rounded-full border border-white/5">
                    Mode: {vibe.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-3xl sm:text-4xl font-black mt-3 tracking-tight italic uppercase break-words">
                    {primaryTask?.subject || "Establish Objective"}
                  </h3>
                  <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-lg mt-2">
                    {primaryTask?.topic || "Initialize a new study plan to begin your focus campaign."}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 w-full sm:w-auto">
                  {primaryTask ? (
                    <Link to={`/study/${primaryTask.planId}`} className="w-full sm:w-auto">
                      <button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]">
                        Engage <ArrowRight className="h-5 w-5 stroke-[2.5]" />
                      </button>
                    </Link>
                  ) : (
                    <Link to="/create" className="w-full sm:w-auto">
                      <button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]">
                        New Plan <Target className="h-5 w-5 stroke-[2.5]" />
                      </button>
                    </Link>
                  )}
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Logistics</span>
                    <span className="text-sm font-bold">{remainingCount} targets pending today</span>
                  </div>
                </div>
              </div>

              {/* Decorative Icon */}
              <div className="hidden md:flex absolute right-[-40px] top-[-20px] items-center justify-center opacity-[0.03] rotate-12 pointer-events-none">
                <Zap size={320} className="text-white" />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Completed', val: stats.completedTasks, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'Pending', val: remainingCount, icon: Target, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { label: 'Active Plans', val: stats.activePlans, icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Next Exam', val: upcomingExam ? format(new Date(upcomingExam.exam_date), 'MMM dd') : 'N/A', icon: Trophy, color: 'text-rose-500', bg: 'bg-rose-500/10' },
            ].map((s, i) => (
              <div key={i} className="glass p-6 rounded-2xl border-white/5 hover:border-white/10 transition-all flex items-center gap-4 group">
                <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center ${s.color} transition-transform group-hover:scale-105`}>
                  <s.icon className="h-6 w-6 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-black tracking-tight">{s.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
            {/* Mission Log (Task List) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase italic flex items-center gap-3">
                  <ListChecks className="h-6 w-6 text-primary" />
                  Mission Log
                </h3>
              </div>

              <div className="space-y-3">
                {todaysTasks.length > 0 ? (
                  todaysTasks.map((task, i) => (
                    <div
                      key={i}
                      className={`group flex items-center justify-between p-5 rounded-2xl border transition-all ${task.completed
                        ? 'bg-slate-900/40 border-slate-800 opacity-60'
                        : 'bg-card-dark border-white/5 hover:border-primary/30 shadow-lg shadow-black/5'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${task.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-700 group-hover:border-primary/50'
                          }`}>
                          {task.completed && <CheckCircle size={14} strokeWidth={3} />}
                        </div>
                        <div>
                          <h4 className={`font-bold transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200 uppercase italic'}`}>
                            {task.topic}
                          </h4>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
                              {task.subject}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                              {task.completed ? (
                                <><CheckCircle size={10} strokeWidth={3} className="text-emerald-500" /> SECURED</>
                              ) : (
                                <><Clock size={10} strokeWidth={3} /> ACTIVE MISSION</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!task.completed && (
                        <Link to={`/study/${task.planId}`}>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-primary/10 rounded-lg text-primary">
                            <ArrowRight size={20} strokeWidth={3} />
                          </div>
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center p-16 glass border-dashed border-2 border-white/5 rounded-3xl opacity-50">
                    <p className="font-bold tracking-[0.2em] uppercase">No mission targets today.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar (Tools & Extras) */}
            <div className="space-y-8">
              {/* Armory (Quick Tools) */}
              <div className="glass p-6 rounded-2xl border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6 border-b border-white/5 pb-2">Armory</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'SAT Sim', icon: Brain, path: '/sat-simulator' },
                    { label: 'Solver', icon: Zap, path: '/guided-paper' },
                    { label: 'Videos', icon: ListChecks, path: '/videos' },
                    { label: 'Feynman', icon: Mic, path: '/feynman' },
                  ].map((tool, i) => (
                    <Link
                      key={i}
                      to={tool.path}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-900/40 rounded-xl border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <tool.icon size={20} className="text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">{tool.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Countdown Sticker */}
              {upcomingExam && (
                <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black tracking-widest uppercase text-rose-500/70 italic">Final Contact</span>
                      <Trophy size={16} className="text-rose-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 mb-1">{upcomingExam.subject}</p>
                    <p className="text-3xl font-black tracking-tight italic uppercase drop-shadow-lg">
                      {differenceInDays(new Date(upcomingExam.exam_date), new Date())} Days
                    </p>
                    <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="bg-rose-500 h-full rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                        style={{ width: '35%' }}
                      ></div>
                    </div>
                    <p className="mt-3 text-[10px] text-slate-500 uppercase tracking-widest font-black italic">Locked and Loaded.</p>
                  </div>
                </div>
              )}

              {/* Focus Timer Mini */}
              <div className="glass p-6 rounded-2xl border-primary/20 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Timer size={18} strokeWidth={2.5} className="animate-pulse" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest italic">Focus Deck</h3>
                </div>
                <div className="text-center py-4 bg-slate-950/40 rounded-xl border border-white/5 mb-6">
                  <span className="text-4xl font-mono font-black text-primary drop-shadow-[0_0_15px_rgba(54,128,247,0.4)]">25:00</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Engage</button>
                  <button className="py-2.5 bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all">Reset</button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
