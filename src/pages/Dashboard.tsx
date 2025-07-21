import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, TrendingUp, Plus, Target, CheckCircle, AlertCircle, Zap, Star, Trophy, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';

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
  const { user, role, loading } = useAuth() as any;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    totalPlans: 0,
    activePlans: 0,
    completedTasks: 0,
    upcomingExams: 0
  });
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [usageDaysThisMonth, setUsageDaysThisMonth] = useState<number>(0);

  // Calculate trial days left
  let trialDaysLeft = null;
  if (user?.trial_start && user?.trial_active) {
    const now = new Date();
    const diff = now.getTime() - user.trial_start.getTime();
    const daysUsed = Math.floor(diff / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, 7 - daysUsed);
  }

  useEffect(() => {
    if (user) {
      fetchPremiumStatus();
      fetchDashboardData();
      fetchUsageThisMonth();
    }
  }, [user]);

  const fetchPremiumStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id);

    if (error || !data || data.length === 0) {
      setIsPremium(false);
      return;
    }
    setIsPremium(data[0].status === 'active');
  };

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
      } else {
        setStudyPlans(data || []);
        calculateStats(data || []);
        extractTodaysTasks(data || []);
      }
    } catch (error) {
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

    // Fetch completed tasks count
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

    // Get completed task days
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
        // Calculate which day of the study plan we should be on
        const planCreatedDate = new Date(plan.created_at);
        const daysSinceCreated = Math.floor((today.getTime() - planCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentStudyDay = daysSinceCreated + 1; // Day 1 is the first day

        // Find the task for the current study day
        const currentTask = plan.plan.daily_schedule.find(task => task.day === currentStudyDay);
        
        if (currentTask) {
          const taskKey = `${plan.id}-${currentTask.day}`;
          const isCompleted = completedTasks.has(taskKey);
          
          // Only show if not completed and exam hasn't passed
          const examDate = new Date(plan.exam_date);
          if (examDate > today) {
            tasks.push({
              ...currentTask,
              planId: plan.id,
              subject: plan.subject,
              examDate: plan.exam_date,
              completed: isCompleted
            });
          }
        }
      });

      setTodaysTasks(tasks);
    } catch (error) {
      // Still show tasks even if we can't check completion status
      plans.forEach(plan => {
        const planCreatedDate = new Date(plan.created_at);
        const daysSinceCreated = Math.floor((today.getTime() - planCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentStudyDay = daysSinceCreated + 1;

        const currentTask = plan.plan.daily_schedule.find(task => task.day === currentStudyDay);
        
        if (currentTask) {
          const examDate = new Date(plan.exam_date);
          if (examDate > today) {
            tasks.push({
              ...currentTask,
              planId: plan.id,
              subject: plan.subject,
              examDate: plan.exam_date,
              completed: false
            });
          }
        }
      });
      setTodaysTasks(tasks);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12 && hour > 5) return 'Good morning';
    if (hour < 17 && hour > 12) return 'Good afternoon';
    return 'Good evening';
  };

  const getUpcomingExam = () => {
    const today = new Date();
    const upcoming = studyPlans
      .filter(plan => new Date(plan.exam_date) > today)
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())[0];
    
    return upcoming;
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin animation-delay-150"></div>
        </div>
      </div>
    );
  }

  const upcomingExam = getUpcomingExam();

  return (
    <div className="space-y-8">
      {/* Trial Days Left Banner */}
      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl px-6 py-4 flex items-center gap-4 shadow-md">
          <span className="font-semibold text-lg">🎁 {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left in your free trial!</span>
          <span className="ml-auto text-white/80 text-sm">Enjoy all premium features, no credit card required.</span>
        </div>
      )}
      {/* Welcome Header */}
      <div className="glass rounded-2xl p-8 border border-gray-700/50 card-hover">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              {getGreeting()}, {user?.user_metadata?.full_name || 'Student'}! 
              <span className="text-3xl">👋</span>
            </h1>
            <p className="text-gray-300 text-lg">
              Ready to conquer your studies today? Let's make it extraordinary! ✨
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-2xl glow-blue">
              <Trophy className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>
      </div>
      {/* Usage Left Banner */}
      {isPremium === false && (
        <div className="bg-blue-900/80 border border-blue-500/40 text-blue-200 rounded-xl px-6 py-4 flex items-center gap-4 shadow-md">
          <Star className="h-6 w-6 text-yellow-400" />
          <span className="font-semibold">{usageDaysThisMonth} of 7 free study plan days used this month.</span>
          <span className="ml-auto text-blue-300 text-sm">Upgrade to premium for unlimited plans!</span>
        </div>
      )}
      {isPremium === true && (
        <div className="bg-green-900/80 border border-green-500/40 text-green-200 rounded-xl px-6 py-4 flex items-center gap-4 shadow-md">
          <CheckCircle className="h-6 w-6 text-green-400" />
          <span className="font-semibold">Unlimited study plan usage this month.</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-xl glow-blue">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Plans</p>
              <p className="text-3xl font-bold text-white">{stats.totalPlans}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-xl glow-green">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Plans</p>
              <p className="text-3xl font-bold text-white">{stats.activePlans}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-xl glow-purple">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Completed Tasks</p>
              <p className="text-3xl font-bold text-white">{stats.completedTasks}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 rounded-xl">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Upcoming Exams</p>
              <p className="text-3xl font-bold text-white">{stats.upcomingExams}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Tasks */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl border border-gray-700/50 p-8 card-hover">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                Today's Study Tasks
              </h3>
              {todaysTasks.length > 0 && (
                <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30">
                  {todaysTasks.length} tasks
                </span>
              )}
            </div>

            {todaysTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto" />
                </div>
                <p className="text-gray-400 mb-6 text-lg">No study tasks scheduled for today</p>
                <Link
                  to="/create"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold glow-blue btn-pulse"
                >
                  <Plus className="h-5 w-5" />
                  Create Study Plan
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {todaysTasks.map((task, index) => (
                  <div key={index} className="glass border border-gray-700/50 rounded-xl p-6 hover:bg-gray-800/30 transition-all duration-300 card-hover">
                    <div className="flex items-start justify-between">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-white text-lg">{task.topic}</h4>
                          {task.completed && (
                            <div className="bg-green-500/20 p-1 rounded-full">
                              <CheckCircle className="h-5 w-5 text-green-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-gray-300 mb-3">{task.subject}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="h-4 w-4" />
                          Day {task.day} of study plan
                        </div>
                      </div>
                      <Link
                        to={`/study/${task.planId}`}
                        className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                          task.completed
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 glow-blue'
                        }`}
                      >
                        {task.completed ? 'Completed' : 'Start Study'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Next Exam */}
          {upcomingExam && (
            <div className="glass rounded-2xl p-6 border border-orange-500/30 card-hover">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                Next Exam
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-white text-lg">{upcomingExam.subject}</p>
                  <p className="text-gray-300">
                    {format(new Date(upcomingExam.exam_date), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="glass rounded-xl p-4 border border-gray-700/50">
                  <p className="text-sm text-gray-400">Days remaining</p>
                  <p className="text-3xl font-bold text-orange-400">
                    {differenceInDays(new Date(upcomingExam.exam_date), new Date())}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="glass rounded-2xl border border-gray-700/50 p-6 card-hover">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                to="/create"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-700/50 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-300 group"
              >
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-lg group-hover:glow-blue transition-all duration-300">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <span className="font-medium text-gray-300 group-hover:text-white">Create New Plan</span>
              </Link>

              <Link
                to="/plans"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-700/50 hover:bg-green-500/10 hover:border-green-500/30 transition-all duration-300 group"
              >
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-2 rounded-lg group-hover:glow-green transition-all duration-300">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="font-medium text-gray-300 group-hover:text-white">View All Plans</span>
              </Link>

              <Link
                to="/progress"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-700/50 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all duration-300 group"
              >
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg group-hover:glow-purple transition-all duration-300">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span className="font-medium text-gray-300 group-hover:text-white">Track Progress</span>
              </Link>

              <Link
                to="/ai-study-buddy"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-700/50 hover:bg-pink-500/10 hover:border-pink-500/30 transition-all duration-300 group"
              >
                <div className="bg-gradient-to-br from-pink-500 to-red-500 p-2 rounded-lg group-hover:glow-pink transition-all duration-300">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <span className="font-medium text-gray-300 group-hover:text-white">AI Study Buddy</span>
              </Link>
            </div>
          </div>

          {/* Motivational Quote */}
          <div className="glass rounded-2xl p-6 border border-yellow-500/30 card-hover">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Daily Motivation</h3>
            </div>
            <p className="text-gray-300 italic">
              "Success is not final, failure is not fatal: it is the courage to continue that counts."
            </p>
            <p className="text-yellow-400 text-sm mt-2">- Winston Churchill</p>
          </div>
        </div>
      </div>
    </div>
  );
}