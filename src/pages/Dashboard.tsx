import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  BookOpen, Target, CheckCircle,
  AlertCircle, ArrowRight, Flame, Trophy,
  Zap, Brain, BatteryLow, Ghost, ListChecks, Mic,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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
    { id: 'fire', label: 'ON FIRE', icon: Zap, color: 'bg-orange-500', text: 'I am ready to conquer the world!' },
    { id: 'ok', label: 'STEADY', icon: Brain, color: 'bg-blue-500', text: 'Focused and ready to work.' },
    { id: 'tired', label: 'DRAINED', icon: BatteryLow, color: 'bg-yellow-500', text: 'I need a light load today.' },
    { id: 'dead', label: 'COOKED', icon: Ghost, color: 'bg-gray-500', text: 'Help me survive.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] mb-10"
    >
      <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic mb-2">
        STATUS REPORT, AGENT.
      </h2>
      <p className="text-black/60 font-bold mb-8 text-lg">HOW ARE YOUR ENERGY LEVELS?</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {vibes.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className="group relative flex flex-col items-center p-6 border-4 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all bg-white hover:bg-black/5"
          >
            <div className={`p-4 rounded-full border-4 border-black mb-4 ${v.color} text-white group-hover:scale-110 transition-transform`}>
              <v.icon size={24} strokeWidth={3} />
            </div>
            <span className="font-black text-xl uppercase tracking-widest mb-2">{v.label}</span>
            <span className="text-xs font-bold text-center text-black/50 leading-tight">{v.text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export function Dashboard() {
  const { user, role, loading, fullName } = useAuth() as any;

  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [stats, setStats] = useState<any>({
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
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchUserGoals();
    }
  }, [user]);

  const fetchUserGoals = async () => {
    try {
      const { data } = await supabase.from('user_study_goals').select('*').eq('user_id', user.id).single();
      if (data) setUserGoals(data);
    } catch (e) {
      console.log('No goals found yet');
    }
  };

  useEffect(() => {
    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('GOOD MORNING');
    else if (hour < 18) setGreeting('GOOD AFTERNOON');
    else setGreeting('GOOD EVENING');
  }, []);

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
    const upcomingExamsList = plans.filter(plan => {
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

      // Also get streak/xp info
      const { data: gamification } = await supabase.from('user_gamification').select('current_streak, total_xp').eq('user_id', user.id).single();

      setStats({
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedTasks: completions?.length || 0,
        upcomingExams: upcomingExamsList.length,
        streak: gamification?.current_streak || 0,
        xp: gamification?.total_xp || 0
      });
    } catch (error) {
      setStats({
        totalPlans: plans.length,
        activePlans: activePlans.length,
        completedTasks: 0,
        upcomingExams: upcomingExamsList.length,
        streak: 0,
        xp: 0
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

  // Mission Control Logic
  const primaryTask = todaysTasks.find(t => !t.completed) || todaysTasks[0];
  const remainingTasksCount = todaysTasks.filter(t => !t.completed).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-7xl mx-auto">

      {/* Vibe Check Section - Shows first if no vibe selected */}
      <AnimatePresence>
        {!vibe && (
          <VibeCheck onSelect={setVibe} />
        )}
      </AnimatePresence>

      {/* Main Dashboard - Only visible after vibe check */}
      {vibe && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Hero / Mission Control */}
          <div className="relative bg-white border-4 border-black p-8 md:p-12 shadow-[12px_12px_0px_0px_#000] mb-12 overflow-hidden group">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-neo-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-black text-white px-3 py-1 font-black text-xs uppercase tracking-widest">
                      {greeting}
                    </span>
                    {vibe === 'tired' || vibe === 'dead' ? (
                      <span className="bg-neo-muted text-black border-2 border-black px-3 py-1 font-black text-xs uppercase tracking-widest">
                        MODE: RECOVERY
                      </span>
                    ) : (
                      <span className="bg-neo-accent text-white border-2 border-black px-3 py-1 font-black text-xs uppercase tracking-widest">
                        MODE: ATTACK
                      </span>
                    )}
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter uppercase italic leading-none mb-4">
                    {displayName}
                  </h1>
                  <p className="text-xl font-bold text-black/60 max-w-2xl">
                    {remainingTasksCount > 0
                      ? `YOU HAVE ${remainingTasksCount} MISSION OBJECTIVES PENDING.`
                      : "ALL SYSTEMS CLEAR. GREAT WORK TODAY."}
                  </p>
                </div>

                {/* Streak Counter */}
                <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] rotate-2">
                  <div className="flex items-center gap-3">
                    <Flame className="w-8 h-8 text-orange-500 fill-orange-500" />
                    <div>
                      <div className="text-4xl font-black leading-none">{stats.streak.toString().padStart(2, '0')}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest">DAY STREAK</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Goal Tracker */}
              {userGoals && (
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="bg-black text-white px-4 py-2 border-2 border-black flex items-center gap-2 -rotate-1">
                    <Target className="w-4 h-4 text-neo-accent" />
                    <span className="font-black text-xs uppercase italic">{userGoals.target_exam} MISSION</span>
                  </div>
                  <div className="bg-white text-black px-4 py-2 border-2 border-black flex items-center gap-2 rotate-1">
                    <Trophy className="w-4 h-4 text-neo-secondary" />
                    <span className="font-black text-xs uppercase italic">TARGET: {userGoals.target_score}</span>
                  </div>
                  {userGoals.exam_date && (
                    <div className="bg-neo-muted text-black px-4 py-2 border-2 border-black flex items-center gap-2 -rotate-1">
                      <Calendar className="w-4 h-4" />
                      <span className="font-black text-xs uppercase italic">
                        {differenceInDays(new Date(userGoals.exam_date), new Date())} DAYS LEFT
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Action Card */}
              {primaryTask ? (
                <div className="bg-neo-bg border-4 border-black p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[8px_8px_0px_0px_#000] transition-all cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-white border-2 border-black font-black text-xs uppercase tracking-widest">
                        PRIORITY TARGET
                      </span>
                      <span className="font-bold text-xs uppercase text-black/50">
                        {primaryTask.subject}
                      </span>
                    </div>
                    <h3 className="text-3xl font-black uppercase italic mb-2">
                      {primaryTask.topic}
                    </h3>
                    <p className="font-bold text-black/60 text-sm">
                      {vibe === 'tired'
                        ? "Take it slow. Just 15 minutes of focus."
                        : "Let's crush this topic and move on."}
                    </p>
                  </div>
                  <Link to={`/study/${primaryTask.planId}`}>
                    <button className="whitespace-nowrap bg-neo-accent text-white border-4 border-black px-8 py-4 font-black uppercase tracking-widest text-lg shadow-[4px_4px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-3">
                      ENGAGE <ArrowRight className="w-6 h-6 stroke-[3px]" />
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="bg-neo-secondary border-4 border-black p-8 text-center shadow-[8px_8px_0px_0px_#000]">
                  <h3 className="text-2xl font-black uppercase italic mb-4">NO ACTIVE MISSIONS</h3>
                  <Link to="/create">
                    <button className="bg-white text-black border-4 border-black px-6 py-3 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
                      CREATE NEW PLAN
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'COMPLETED', val: stats.completedTasks, icon: CheckCircle, color: 'text-green-600' },
              { label: 'PENDING', val: remainingTasksCount, icon: Target, color: 'text-red-600' },
              { label: 'ACTIVE PLANS', val: stats.activePlans, icon: BookOpen, color: 'text-blue-600' },
              { label: 'NEXT EXAM', val: stats.upcomingExams, icon: Trophy, color: 'text-yellow-600' },
            ].map((s, i) => (
              <div key={i} className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex items-center justify-between group hover:-translate-y-1 transition-transform">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{s.label}</div>
                  <div className="text-3xl font-black">{s.val}</div>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-20 group-hover:opacity-100 transition-opacity`} />
              </div>
            ))}
          </div>

          {/* Secondary Sections Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Col: Task List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black uppercase italic flex items-center gap-3">
                  <ListChecks className="w-6 h-6" />
                  MISSION LOG
                </h3>
              </div>

              <div className="space-y-4">
                {todaysTasks.length > 0 ? (
                  todaysTasks.filter(t => t !== primaryTask).map((task, i) => (
                    <div key={i} className={`border-4 border-black p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_#000] ${task.completed ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-0.5">{task.subject}</span>
                        </div>
                        <div className="font-bold uppercase">{task.topic}</div>
                      </div>
                      {task.completed ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <Link to={`/study/${task.planId}`}>
                          <button className="text-xs font-black uppercase tracking-widest border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-colors">
                            START
                          </button>
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center p-8 border-2 border-dashed border-black/20 font-bold text-black/40">
                    NO OTHER TASKS ASSIGNED
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: Tools & Extras */}
            <div className="space-y-6">

              {/* Tools Quick Access */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000]">
                <h3 className="text-xl font-black uppercase italic mb-4 border-b-4 border-black pb-2">ARMORY</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Link to="/sat-simulator" className="flex flex-col items-center justify-center p-4 border-2 border-black hover:bg-neo-accent hover:text-white transition-all group">
                    <Brain className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">SAT SIM</span>
                  </Link>
                  <Link to="/guided-paper" className="flex flex-col items-center justify-center p-4 border-2 border-black hover:bg-neo-secondary hover:text-black transition-colors group">
                    <BookOpen className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">SOLVER</span>
                  </Link>
                  <Link to="/videos" className="flex flex-col items-center justify-center p-4 border-2 border-black hover:bg-neo-muted hover:text-black transition-colors group">
                    <Zap className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">VIDEOS</span>
                  </Link>
                  <Link to="/feynman" className="flex flex-col items-center justify-center p-4 border-2 border-black hover:bg-black hover:text-white transition-colors group">
                    <Mic className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">FEYNMAN</span>
                  </Link>
                </div>
              </div>

              {/* Exam Countdown (Mini) */}
              {upcomingExam && (
                <div className="bg-black text-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#C4B5FD]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-white/60">INCOMING EVENT</span>
                    <AlertCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-black uppercase italic mb-1">{upcomingExam.subject}</div>
                  <div className="text-sm font-bold text-white/80 mb-4">
                    {differenceInDays(new Date(upcomingExam.exam_date), new Date())} DAYS REMAINING
                  </div>
                  <Link to={`/study/${upcomingExam.id}`}>
                    <button className="w-full bg-white text-black font-black uppercase text-xs py-2 hover:bg-neo-accent hover:text-white transition-colors">
                      PREPARE DEFENSE
                    </button>
                  </Link>
                </div>
              )}

            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
