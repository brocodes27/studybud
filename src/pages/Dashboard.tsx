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
    { id: 'fire', label: 'ON FIRE', icon: Zap, gradient: 'from-[#F472B6] to-[#F59E0B]', text: 'Ready to conquer!' },
    { id: 'ok', label: 'STEADY', icon: Brain, gradient: 'from-[#00D1FF] to-[#6366F1]', text: 'Focused and steady.' },
    { id: 'tired', label: 'DRAINED', icon: BatteryMedium, gradient: 'from-[#34D399] to-[#00D1FF]', text: 'Lower energy today.' },
    { id: 'dead', label: 'COOKED', icon: Ghost, gradient: 'from-[#94A3B8] to-[#64748B]', text: 'Survival mode active.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[28px] mb-10 border border-[#0A192F]/[0.06] shadow-neo-lg relative overflow-hidden"
    >
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#6366F1]/[0.06] rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#00D1FF]/[0.06] rounded-full blur-[60px] pointer-events-none" />

      <div className="flex flex-col mb-10 text-center relative z-10">
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#0A192F] mb-3 font-display">
          Status Report, <span className="text-gradient">Agent.</span>
        </h2>
        <p className="text-[#64748B] text-base font-medium">Initialize your mindset for this session.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        {vibes.map((v, i) => (
          <motion.button
            key={v.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onSelect(v.id)}
            className="group relative flex flex-col items-center p-6 bg-[#FAFBFF] border border-[#0A192F]/[0.04] rounded-2xl hover:bg-white hover:shadow-neo hover:border-transparent hover:-translate-y-1 transition-all duration-300"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br ${v.gradient} text-white shadow-neo group-hover:scale-110 transition-transform`}>
              <v.icon size={24} />
            </div>
            <span className="font-extrabold text-base text-[#0A192F] tracking-tight mb-1 font-display">{v.label}</span>
            <span className="text-[12px] text-[#64748B] text-center font-medium leading-tight">{v.text}</span>
          </motion.button>
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
  const [greeting, setGreeting] = useState('Good Evening');

  useEffect(() => {
    if (user) fetchDashboardData();
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
        <div className="w-12 h-12 border-2 border-[#6366F1]/20 border-t-[#6366F1] rounded-full animate-spin" />
        <p className="mt-5 font-semibold text-[#64748B] text-sm">Loading dashboard...</p>
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
    <div className="space-y-10 animate-fade-in pb-20">
      <AnimatePresence>
        {!vibe && <VibeCheck onSelect={setVibe} />}
      </AnimatePresence>

      {vibe && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0A192F] tracking-tight font-display">
              {greeting}, <span className="text-gradient">{displayName}</span>
            </h1>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#0A192F]/[0.06] shadow-xs">
              <Flame className="w-5 h-5 text-[#F472B6]" />
              <span className="font-extrabold text-xl text-[#0A192F] tabular-nums">{stats.streak.toString().padStart(2, '0')}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Day Streak</span>
            </div>
          </div>

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-[24px] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8"
            style={{ background: 'linear-gradient(135deg, #0A192F 0%, #162544 50%, #0A192F 100%)' }}>
            {/* Gradient orbs */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#00D1FF]/15 rounded-full blur-[80px]" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#6366F1]/15 rounded-full blur-[80px]" />
            <div className="absolute inset-0 noise-heavy" />

            <div className="relative z-10 space-y-5 max-w-2xl text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.08] backdrop-blur-sm rounded-full font-semibold text-[11px] uppercase tracking-wider text-white/70 border border-white/[0.08]">
                <Target className="w-3.5 h-3.5 text-[#00D1FF]" /> Priority Target
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] mb-3 text-white font-display">
                  {primaryTask?.subject || "Establish Objective"}
                </h2>
                <p className="text-white/50 text-base md:text-lg font-medium leading-relaxed">
                  {primaryTask?.topic || "Initialize a new study plan to begin your focus campaign."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
                {primaryTask ? (
                  <Link to={`/study/${primaryTask.planId}`}>
                    <button className="px-8 py-4 rounded-full text-base font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5 group"
                      style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
                      Engage Task <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                ) : (
                  <Link to="/create">
                    <button className="px-8 py-4 rounded-full text-base font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2.5"
                      style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
                      New Plan <Target className="w-5 h-5" />
                    </button>
                  </Link>
                )}

                <div className="text-center sm:text-left">
                  <p className="font-extrabold text-2xl text-white tabular-nums">{remainingCount}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F472B6]">Pending Today</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex relative z-10 p-6">
              <div className="w-40 h-40 rounded-[28px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm flex items-center justify-center rotate-6 shadow-2xl">
                <Brain className="w-20 h-20 text-[#00D1FF]/80" />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Completed', val: stats.completedTasks, gradient: 'from-[#34D399] to-[#00D1FF]' },
              { label: 'Total XP', val: stats.xp, gradient: 'from-[#00D1FF] to-[#6366F1]' },
              { label: 'Active Plans', val: stats.activePlans, gradient: 'from-[#F472B6] to-[#F59E0B]' },
              { label: 'Next Exam', val: upcomingExam ? format(new Date(upcomingExam.exam_date), 'MMM dd') : 'N/A', gradient: 'from-[#6366F1] to-[#F472B6]' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl border border-[#0A192F]/[0.06] p-5 transition-all duration-300 hover:shadow-neo hover:-translate-y-0.5 relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">{s.label}</p>
                <p className={`text-3xl font-extrabold tracking-tighter bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.val}</p>
              </motion.div>
            ))}
          </div>

          {/* Main Layout Bottom */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Mission Log */}
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[24px] border border-[#0A192F]/[0.06] shadow-xs">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight font-display">Mission Log</h3>
                </div>

                <div className="space-y-3">
                  {todaysTasks.length > 0 ? (
                    todaysTasks.map((task, i) => (
                      <div
                        key={i}
                        className={`group relative flex items-center justify-between p-5 rounded-xl border transition-all duration-300 ${
                          task.completed
                            ? 'bg-[#FAFBFF] border-[#0A192F]/[0.04] opacity-50'
                            : 'bg-white border-[#0A192F]/[0.06] hover:border-[#6366F1]/20 hover:shadow-neo-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <button className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            task.completed
                              ? 'bg-[#34D399] text-white'
                              : 'border-[1.5px] border-[#0A192F]/[0.12] text-transparent hover:border-[#6366F1]/30'
                          }`}>
                            <CheckCircle size={14} />
                          </button>
                          <div>
                            <h4 className={`text-base font-bold mb-0.5 transition-all ${task.completed ? 'text-[#94A3B8] line-through' : 'text-[#0A192F]'}`}>
                              {task.topic}
                            </h4>
                            <span className="text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded-md bg-[#FAFBFF] text-[#94A3B8] uppercase">
                              {task.subject}
                            </span>
                          </div>
                        </div>
                        {!task.completed && (
                          <Link to={`/study/${task.planId}`}>
                            <button className="w-9 h-9 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-neo-sm"
                              style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                              <ArrowRight size={16} />
                            </button>
                          </Link>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-12 bg-[#FAFBFF] border border-dashed border-[#0A192F]/[0.08] rounded-xl">
                      <p className="font-semibold text-[#94A3B8] text-sm">No mission targets today.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Focus Deck */}
              <div className="relative overflow-hidden rounded-[24px] p-6"
                style={{ background: 'linear-gradient(135deg, #0A192F, #162544)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F472B6]/10 rounded-full blur-[40px]" />
                <div className="absolute inset-0 noise-heavy" />

                <div className="flex items-center gap-2.5 mb-6 relative z-10">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                    <Timer size={18} />
                  </div>
                  <h3 className="text-base font-bold text-white font-display">Focus Deck</h3>
                </div>

                <div className="text-center py-5 bg-white/[0.05] rounded-xl border border-white/[0.06] mb-5 relative z-10">
                  <span className="text-5xl font-extrabold tracking-tighter text-white font-display">
                    25<span className="bg-gradient-to-r from-[#00D1FF] to-[#6366F1] bg-clip-text text-transparent">:</span>00
                  </span>
                </div>

                <button className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 relative z-10"
                  style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)', boxShadow: '0 4px 16px rgba(99,102,241,0.25)' }}>
                  Initiate Focus
                </button>
              </div>

              {/* Quick Tools */}
              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[24px] border border-[#0A192F]/[0.06] shadow-xs">
                <h3 className="text-base font-bold text-[#0A192F] mb-4 font-display">Quick Tools</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'SAT Sim', icon: Target, path: '/sat-simulator', gradient: 'from-[#F472B6] to-[#F59E0B]' },
                    { label: 'Solver', icon: Zap, path: '/guided-paper', gradient: 'from-[#00D1FF] to-[#6366F1]' },
                    { label: 'Videos', icon: ListChecks, path: '/videos', gradient: 'from-[#34D399] to-[#00D1FF]' },
                    { label: 'Feynman', icon: Mic, path: '/feynman', gradient: 'from-[#6366F1] to-[#F472B6]' },
                  ].map((tool, i) => (
                    <Link
                      key={i}
                      to={tool.path}
                      className="flex flex-col items-center justify-center gap-2.5 p-4 bg-[#FAFBFF] rounded-xl border border-[#0A192F]/[0.04] hover:bg-white hover:shadow-neo-sm hover:-translate-y-0.5 transition-all group"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                        <tool.icon size={20} />
                      </div>
                      <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#0A192F] transition-colors">{tool.label}</span>
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
