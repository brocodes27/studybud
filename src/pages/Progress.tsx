import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, CheckCircle, Clock, Target, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, startOfWeek, endOfWeek, differenceInDays, parseISO } from 'date-fns';

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
  const { user } = useAuth();
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
      // Fetch study sessions (last 30 days for chart, all time for total)
      const { data: allSessions, error: allSessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user?.id);

      if (allSessionsError) throw allSessionsError;

      const { data: recentSessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('completed_at', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      if (sessionsError) throw sessionsError;

      // Fetch task completions
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user?.id);

      if (completionsError) throw completionsError;

      // Fetch exam plans
      const { data: plans, error: plansError } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', user?.id);

      if (plansError) throw plansError;

      // Calculate total study time from all sessions
      const totalStudyTime = allSessions?.reduce((sum, session) => sum + (session.duration_minutes || 0), 0) || 0;
      const completedTasks = completions?.length || 0;
      
      // Calculate total tasks from all plans
      const totalTasks = plans?.reduce((sum, plan) => sum + (plan.plan?.daily_schedule?.length || 0), 0) || 0;

      // Calculate real study streak
      const streakDays = calculateStudyStreak(allSessions || [], completions || []);

      // Generate weekly progress data
      const weekStart = startOfWeek(new Date());
      const weeklyProgress = Array.from({ length: 7 }, (_, i) => {
        const date = format(new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const dayName = format(new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000), 'EEE');
        
        const dayMinutes = recentSessions?.filter(s => 
          s.completed_at && format(new Date(s.completed_at), 'yyyy-MM-dd') === date
        ).reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;

        const dayTasks = completions?.filter(c => 
          c.completed_at && format(new Date(c.completed_at), 'yyyy-MM-dd') === date
        ).length || 0;

        return {
          date: dayName,
          minutes: dayMinutes,
          tasks: dayTasks
        };
      });

      // Calculate subject progress with real data
      const subjectProgress = plans?.map(plan => {
        const planCompletions = completions?.filter(c => c.plan_id === plan.id).length || 0;
        const totalPlanTasks = plan.plan?.daily_schedule?.length || 0;
        
        return {
          subject: plan.subject,
          completed: planCompletions,
          total: totalPlanTasks
        };
      }).filter(subject => subject.total > 0) || []; // Only show subjects with tasks

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
      // Set default values on error
      setProgressData({
        totalStudyTime: 0,
        completedTasks: 0,
        totalTasks: 0,
        streakDays: 0,
        weeklyProgress: Array.from({ length: 7 }, (_, i) => ({
          date: format(new Date(startOfWeek(new Date()).getTime() + i * 24 * 60 * 60 * 1000), 'EEE'),
          minutes: 0,
          tasks: 0
        })),
        subjectProgress: []
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return '0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const completionRate = progressData.totalTasks > 0 
    ? Math.round((progressData.completedTasks / progressData.totalTasks) * 100)
    : 0;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin animation-delay-150"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Study Progress</h1>
        <p className="text-gray-400 mt-2">Track your learning journey and achievements</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-xl glow-blue">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Study Time</p>
              <p className="text-3xl font-bold text-white">{formatTime(progressData.totalStudyTime)}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-xl glow-green">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Tasks Completed</p>
              <p className="text-3xl font-bold text-white">{progressData.completedTasks}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-xl glow-purple">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Completion Rate</p>
              <p className="text-3xl font-bold text-white">{completionRate}%</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-700/50 card-hover">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 rounded-xl">
              <Award className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Study Streak</p>
              <p className="text-3xl font-bold text-white">
                {progressData.streakDays} {progressData.streakDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weekly Progress Chart */}
        <div className="glass rounded-2xl border border-gray-700/50 p-6 card-hover">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            Weekly Study Time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData.weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  formatter={(value) => [`${value} minutes`, 'Study Time']}
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.8)',
                    border: '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '12px',
                    color: '#F9FAFB'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Progress */}
        <div className="glass rounded-2xl border border-gray-700/50 p-6 card-hover">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-2 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            Subject Progress
          </h3>
          
          {progressData.subjectProgress.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-4 inline-block">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto" />
              </div>
              <p className="text-gray-400">No study plans created yet</p>
              <p className="text-gray-500 text-sm mt-2">Create a study plan to see your progress here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {progressData.subjectProgress.map((subject, index) => {
                const progress = subject.total > 0 ? (subject.completed / subject.total) * 100 : 0;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{subject.subject}</span>
                      <span className="text-sm text-gray-400">
                        {subject.completed}/{subject.total} tasks
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-300">{Math.round(progress)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Achievement Section */}
      <div className="glass rounded-2xl p-6 border border-yellow-500/30 card-hover">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-2 rounded-lg">
            <Award className="h-6 w-6 text-white" />
          </div>
          Achievements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`glass rounded-xl p-4 text-center border ${
            progressData.totalTasks > 0 ? 'border-yellow-500/30' : 'border-gray-700/50'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
              progressData.totalTasks > 0 
                ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                : 'bg-gray-600'
            }`}>
              <Award className="h-6 w-6 text-white" />
            </div>
            <h4 className="font-semibold text-white">First Study Plan</h4>
            <p className="text-sm text-gray-400">
              {progressData.totalTasks > 0 ? '✅ Completed' : 'Create your first AI study plan'}
            </p>
          </div>
          
          <div className={`glass rounded-xl p-4 text-center border ${
            progressData.completedTasks >= 10 ? 'border-blue-500/30' : 'border-gray-700/50'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
              progressData.completedTasks >= 10 
                ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                : 'bg-gray-600'
            }`}>
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <h4 className="font-semibold text-white">Task Master</h4>
            <p className="text-sm text-gray-400">
              {progressData.completedTasks >= 10 
                ? '✅ Completed 10+ tasks' 
                : `Complete ${10 - progressData.completedTasks} more tasks`}
            </p>
          </div>
          
          <div className={`glass rounded-xl p-4 text-center border ${
            progressData.streakDays >= 5 ? 'border-green-500/30' : 'border-gray-700/50'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
              progressData.streakDays >= 5 
                ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                : 'bg-gray-600'
            }`}>
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h4 className="font-semibold text-white">Consistent Learner</h4>
            <p className="text-sm text-gray-400">
              {progressData.streakDays >= 5 
                ? `✅ ${progressData.streakDays}-day streak!` 
                : `Build a ${5 - progressData.streakDays} more day streak`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}