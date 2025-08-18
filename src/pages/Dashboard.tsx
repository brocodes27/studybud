import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, TrendingUp, Plus, Target, CheckCircle, AlertCircle, Zap, Star, Trophy, MessageCircle, Sparkles, Crown, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
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
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="loading-spinner w-12 h-12"></div>
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
  const [usageDaysThisMonth, setUsageDaysThisMonth] = useState<number>(0);

  // CBSE Exam Progress State
  const [examAttempts, setExamAttempts] = useState<any[]>([]);
  const [examLoading, setExamLoading] = useState(true);
  const [examError, setExamError] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

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
      fetchDashboardData();
      fetchUsageThisMonth();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchAttempts = async () => {
      setExamLoading(true);
      setExamError(null);
      try {
        const { data, error } = await supabase
          .from('cbse_exam_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('exam_date', { ascending: true });
        if (error) throw error;
        setExamAttempts(data || []);
      } catch (err: any) {
        setExamError(err.message || 'Failed to fetch exam attempts');
      }
      setExamLoading(false);
    };
    fetchAttempts();
  }, [user]);

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
      setTodaysTasks([]);
    }
  };

  // Get upcoming exam
  const upcomingExam = studyPlans
    .filter(plan => new Date(plan.exam_date) > new Date())
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())[0];

  if (dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  // Determine the best display name for the greeting
  const displayName =
    fullName ||
    user?.user_metadata?.full_name ||
    (typeof user?.full_name === 'string' ? user.full_name : undefined) ||
    (typeof user?.email === 'string' ? user.email.split('@')[0] : undefined) ||
    'Student';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome back, <span className="gradient-text-primary">{displayName}!</span>
        </h1>
        <p className="text-gray-400 text-lg">Ready to continue your learning journey?</p>
      </div>

      {/* Trial Days Left Banner */}
      {trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="card-elevated bg-gradient-to-r from-warning-500/10 to-warning-600/10 border-warning-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-warning-500 to-warning-600 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Free Trial Active</h3>
                <p className="text-warning-200">{trialDaysLeft} days remaining in your trial</p>
              </div>
            </div>
            <Button variant="warning" size="lg">
              Upgrade Now
            </Button>
          </div>
        </div>
      )}

      {/* Usage Left Banner */}
      {isPremium === false && (
        <div className="card-elevated bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-primary-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Study Plan Usage</h3>
                <p className="text-primary-200">{usageDaysThisMonth} of 7 free study plan days used this month</p>
              </div>
            </div>
            <Button variant="primary" size="lg">
              Upgrade to Premium
            </Button>
          </div>
        </div>
      )}
      
      {isPremium === true && (
        <div className="card-elevated bg-gradient-to-r from-success-500/10 to-success-600/10 border-success-500/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-success-500 to-success-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Premium Active</h3>
              <p className="text-success-200">Unlimited study plan usage this month</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-elevated">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center glow-blue">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Total Plans</p>
              <p className="text-3xl font-bold text-white">{stats.totalPlans}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-success-500 to-success-600 rounded-2xl flex items-center justify-center glow-green">
              <Target className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Active Plans</p>
              <p className="text-3xl font-bold text-white">{stats.activePlans}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center glow-purple">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Completed Tasks</p>
              <p className="text-3xl font-bold text-white">{stats.completedTasks}</p>
            </div>
          </div>
        </div>

        <div className="card-elevated">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-warning-500 to-warning-600 rounded-2xl flex items-center justify-center glow-yellow">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium">Upcoming Exams</p>
              <p className="text-3xl font-bold text-white">{stats.upcomingExams}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Tasks */}
        <div className="lg:col-span-2">
          <div className="card-elevated">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                Today's Study Tasks
              </h3>
              {todaysTasks.length > 0 && (
                <span className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-primary-300 px-4 py-2 rounded-full text-sm font-medium border border-primary-500/30">
                  {todaysTasks.length} tasks
                </span>
              )}
            </div>

            {todaysTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-gray-400 mb-6 text-lg">No study tasks scheduled for today</p>
                <Button variant="primary" size="lg" icon={<Plus className="w-5 h-5" />}>
                  Create Study Plan
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {todaysTasks.map((task, index) => (
                  <div key={index} className="card-hover-subtle bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="font-semibold text-white text-lg">{task.topic}</h4>
                          {task.completed && (
                            <div className="w-6 h-6 bg-gradient-to-r from-success-500 to-success-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-gray-300 mb-3">{task.subject}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          Day {task.day} of study plan
                        </div>
                      </div>
                      <Link to={`/study/${task.planId}`}>
                        <Button
                          variant={task.completed ? "success" : "primary"}
                          size="md"
                          icon={task.completed ? <CheckCircle className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                        >
                          {task.completed ? 'Completed' : 'Start Study'}
                        </Button>
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
            <div className="card-elevated bg-gradient-to-r from-warning-500/10 to-warning-600/10 border-warning-500/30">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                Next Exam
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-white text-lg">{upcomingExam.subject}</p>
                  <p className="text-gray-300">
                    {format(new Date(upcomingExam.exam_date), 'EEEE, MMMM do, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-warning-300">
                  <Clock className="w-4 h-4" />
                  {differenceInDays(new Date(upcomingExam.exam_date), new Date())} days remaining
                </div>
                <Button variant="warning" size="sm" className="w-full">
                  View Study Plan
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card-elevated">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Link to="/create">
                <Button variant="primary" size="sm" className="w-full" icon={<Plus className="w-4 h-4" />}>
                  Create New Plan
                </Button>
              </Link>
              <Link to="/tools">
                <Button variant="secondary" size="sm" className="w-full" icon={<Sparkles className="w-4 h-4" />}>
                  Study Tools
                </Button>
              </Link>
              <Link to="/ai-study-buddy">
                <Button variant="accent" size="sm" className="w-full" icon={<MessageCircle className="w-4 h-4" />}>
                  AI Study Buddy
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Progress */}
          <div className="card-elevated">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              Recent Progress
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Tasks Completed</span>
                <span className="text-white font-semibold">{stats.completedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Study Plans</span>
                <span className="text-white font-semibold">{stats.totalPlans}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Active Plans</span>
                <span className="text-white font-semibold">{stats.activePlans}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}