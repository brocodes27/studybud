import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, CheckCircle, Clock, Target, Award, BookOpen, BarChart3, Zap, Trophy, Flame, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
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

      // Calculate total study time
      const totalStudyTime = sessions?.reduce((total, session) => {
        if (session.duration_minutes) {
          return total + session.duration_minutes;
        }
        return total;
      }, 0) || 0;

      // Calculate completed tasks
      const completedTasks = completions?.length || 0;

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

      // Generate subject progress data
      const subjectProgress = [
        { subject: 'Mathematics', completed: 45, total: 60 },
        { subject: 'Physics', completed: 32, total: 50 },
        { subject: 'Chemistry', completed: 28, total: 45 },
        { subject: 'Biology', completed: 38, total: 55 }
      ];

      setProgressData({
        totalStudyTime,
        completedTasks,
        totalTasks: completedTasks + 20, // Mock total tasks
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

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="loading-spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">
          Your <span className="gradient-text-primary">Progress</span>
        </h1>
        <p className="text-gray-400 text-lg">Track your learning journey and celebrate your achievements</p>
      </div>



      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Weekly Progress Chart */}
        <div className="card-elevated">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Weekly Study Activity</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData.weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Progress Chart */}
        <div className="card-elevated">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Subject Progress</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData.subjectProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="subject" 
                  stroke="#9ca3af"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#9ca3af"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb'
                  }}
                />
                <Bar 
                  dataKey="completed" 
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="total" 
                  fill="#374151"
                  radius={[4, 4, 0, 0]}
                  opacity={0.3}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="card-elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">Recent Achievements</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-xl border border-primary-500/20">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Study Streak</h4>
              <p className="text-sm text-gray-400">Maintained {progressData.streakDays} day streak</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-success-500/10 to-success-600/10 rounded-xl border border-success-500/20">
            <div className="w-12 h-12 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Task Master</h4>
              <p className="text-sm text-gray-400">Completed {progressData.completedTasks} tasks</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-accent-500/10 to-accent-600/10 rounded-xl border border-accent-500/20">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Time Warrior</h4>
              <p className="text-sm text-gray-400">Studied for {formatTime(progressData.totalStudyTime)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Motivation Section */}
      
    </div>
  );
}