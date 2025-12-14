import React, { useState, useEffect } from 'react';
import { TrendingUp, Brain, Target, Clock, Calendar, Award, Zap, Users, BookOpen, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { useToast } from '../hooks/useToast';
import { usePayment } from '../hooks/usePayment';

interface AnalyticsData {
  studyPatterns: Array<{
    hour: number;
    sessions: number;
    avgDuration: number;
  }>;
  subjectPerformance: Array<{
    subject: string;
    mastery: number;
    timeSpent: number;
    accuracy: number;
  }>;
  learningVelocity: Array<{
    date: string;
    conceptsLearned: number;
    retentionRate: number;
  }>;
  focusMetrics: {
    averageFocusScore: number;
    peakFocusHour: number;
    distractionPatterns: Array<{
      timeOfDay: string;
      distractions: number;
    }>;
  };
  aiInsights: Array<{
    type: 'strength' | 'weakness' | 'recommendation' | 'achievement';
    title: string;
    description: string;
    actionItems: string[];
    priority: 'low' | 'medium' | 'high';
  }>;
  socialMetrics: {
    rank: number;
    totalUsers: number;
    studyStreak: number;
    achievements: number;
  };
}

export function AdvancedAnalytics() {
  const { user, loading } = useAuth() as { user: any; loading: boolean };
  const { showToast } = useToast();
  const { paymentData, initiatePayment } = usePayment();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [isSubscribed, setIsSubscribed] = useState(true); // Subscription always true for now
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
    setShowPaywall(false); // Never show paywall
  }, [user, timeRange, isSubscribed]);

  const fetchAnalyticsData = async () => {
    try {
      setLoadingData(true);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case 'quarter':
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      // Fetch study sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());

      if (sessionsError) throw sessionsError;

      // Fetch flashcard data
      const { data: flashcards, error: flashcardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user?.id);

      if (flashcardsError) throw flashcardsError;

      // Fetch practice test attempts
      const { data: testAttempts, error: testsError } = await supabase
        .from('practice_test_attempts')
        .select('*')
        .eq('user_id', user?.id)
        .gte('completed_at', startDate.toISOString());

      if (testsError) throw testsError;

      // Fetch focus sessions
      const { data: focusSessions, error: focusError } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('started_at', startDate.toISOString());

      if (focusError) throw focusError;

      // -------------- Process data for analytics -----------------
      // Leaderboard rank & total users
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard_view')
        .select('user_id, rank')
        .order('rank', { ascending: true });

      if (leaderboardError) throw leaderboardError;

      const totalUsers = leaderboardData?.length || 0;
      const userEntry = leaderboardData?.find((row) => row.user_id === user?.id);
      const rank = userEntry ? userEntry.rank : totalUsers;

      // Achievements count
      const { data: userAchievements, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', user?.id);

      if (achievementsError) throw achievementsError;

      // Study streak (consecutive days with ≥1 session)
      const calculateStreak = (sessionsArr: any[]) => {
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dayStr = date.toISOString().split('T')[0];
          const hasSession = sessionsArr.some(
            (s) => s.completed_at && s.completed_at.startsWith(dayStr)
          );
          if (hasSession) {
            streak += 1;
          } else {
            break;
          }
        }
        return streak;
      };

      const studyStreak = calculateStreak(sessions || []);

      const socialMetrics = {
        rank,
        totalUsers,
        studyStreak,
        achievements: userAchievements?.length || 0,
      };

      const analytics = processAnalyticsData(
        sessions || [],
        flashcards || [],
        testAttempts || [],
        focusSessions || [],
        socialMetrics
      );
      setAnalyticsData(analytics);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const processAnalyticsData = (sessions: any[], flashcards: any[], testAttempts: any[], focusSessions: any[], socialMetrics: AnalyticsData['socialMetrics']): AnalyticsData => {
    // Study patterns by hour
    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const hourSessions = sessions.filter(s =>
        s.completed_at && new Date(s.completed_at).getHours() === hour
      );
      return {
        hour,
        sessions: hourSessions.length,
        avgDuration: hourSessions.length > 0
          ? hourSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / hourSessions.length
          : 0
      };
    });

    // Subject performance
    const subjectMap = new Map();
    sessions.forEach(session => {
      const subject = session.topic || 'General';
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          subject,
          totalTime: 0,
          sessionCount: 0,
          flashcardCount: 0,
          totalMastery: 0
        });
      }
      const data = subjectMap.get(subject);
      data.totalTime += session.duration_minutes || 0;
      data.sessionCount += 1;
    });

    flashcards.forEach(card => {
      const subject = card.topic || 'General';
      if (subjectMap.has(subject)) {
        const data = subjectMap.get(subject);
        data.flashcardCount += 1;
        data.totalMastery += card.mastery_level || 0;
      }
    });

    const subjectPerformance = Array.from(subjectMap.values()).map(data => ({
      subject: data.subject,
      mastery: data.flashcardCount > 0 ? (data.totalMastery / data.flashcardCount) * 20 : 0, // Convert to percentage
      timeSpent: data.totalTime,
      accuracy: Math.min(100, (data.totalMastery / Math.max(data.flashcardCount, 1)) * 25) // Estimated accuracy
    }));

    // Learning velocity (concepts learned over time)
    const learningVelocity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = format(date, 'MMM dd');

      const dayFlashcards = flashcards.filter(f =>
        f.created_at && format(new Date(f.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );

      const dayMastery = dayFlashcards.reduce((sum, f) => sum + (f.mastery_level || 0), 0);

      return {
        date: dateStr,
        conceptsLearned: dayFlashcards.length,
        retentionRate: dayFlashcards.length > 0 ? (dayMastery / dayFlashcards.length) * 20 : 0
      };
    });

    // Focus metrics
    const avgFocusScore = focusSessions.length > 0
      ? focusSessions.reduce((sum, s) => sum + (s.focus_score || 0), 0) / focusSessions.length
      : 0;

    const peakFocusHour = hourlyData.reduce((peak, current) =>
      current.avgDuration > peak.avgDuration ? current : peak
    ).hour;

    // Distraction patterns derived from focus session distribution
    const partOfDay = (hour: number) => {
      if (hour >= 5 && hour < 12) return 'Morning';
      if (hour >= 12 && hour < 17) return 'Afternoon';
      if (hour >= 17 && hour < 21) return 'Evening';
      return 'Night';
    };
    const dpMap: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    focusSessions.forEach((fs) => {
      if (fs.started_at) {
        const hr = new Date(fs.started_at).getHours();
        const key = partOfDay(hr);
        dpMap[key] += 1;
      }
    });
    const distractionPatterns = Object.entries(dpMap).map(([timeOfDay, distractions]) => ({ timeOfDay, distractions }));

    // AI Insights
    const aiInsights = generateAIInsights(sessions, flashcards, testAttempts, subjectPerformance);

    // Social metrics (simulated)
    // socialMetrics computed in fetchAnalyticsData

    return {
      studyPatterns: hourlyData,
      subjectPerformance,
      learningVelocity,
      focusMetrics: {
        averageFocusScore: avgFocusScore,
        peakFocusHour,
        distractionPatterns
      },
      aiInsights,
      socialMetrics
    };
  };

  const generateAIInsights = (sessions: any[], flashcards: any[], testAttempts: any[], subjectPerformance: any[]) => {
    const insights = [];

    // Study pattern insights
    if (sessions.length > 0) {
      const avgSessionLength = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sessions.length;
      if (avgSessionLength < 25) {
        insights.push({
          type: 'recommendation' as const,
          title: 'Optimize Study Sessions',
          description: 'Your average study session is shorter than recommended. Longer focused sessions can improve retention.',
          actionItems: ['Try 25-30 minute focused sessions', 'Use the Pomodoro technique', 'Minimize distractions'],
          priority: 'medium' as const
        });
      }
    }

    // Subject performance insights
    const weakSubject = subjectPerformance.find(s => s.mastery < 40);
    if (weakSubject) {
      insights.push({
        type: 'weakness' as const,
        title: `Improve ${weakSubject.subject} Performance`,
        description: `Your mastery in ${weakSubject.subject} is below average. Focus on this subject for better results.`,
        actionItems: ['Create more flashcards', 'Take practice tests', 'Review fundamentals'],
        priority: 'high' as const
      });
    }

    const strongSubject = subjectPerformance.find(s => s.mastery > 80);
    if (strongSubject) {
      insights.push({
        type: 'strength' as const,
        title: `Excellent Progress in ${strongSubject.subject}`,
        description: `You're performing exceptionally well in ${strongSubject.subject}. Keep up the great work!`,
        actionItems: ['Maintain current study routine', 'Help others in study groups', 'Take advanced practice tests'],
        priority: 'low' as const
      });
    }

    // Achievement insights
    if (flashcards.length > 50) {
      insights.push({
        type: 'achievement' as const,
        title: 'Flashcard Master',
        description: 'You\'ve created over 50 flashcards! This shows great dedication to active learning.',
        actionItems: ['Continue creating quality flashcards', 'Review regularly for spaced repetition'],
        priority: 'low' as const
      });
    }

    return insights;
  };

  const handleSubscribe = async () => {
    try {
      await initiatePayment();
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Failed to start payment. Please try again.', 'error');
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-neon-purple/20 border-b-neon-purple rounded-full animate-spin animation-delay-150"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12 glass-panel rounded-3xl border border-white/5">
        <Brain className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Analytics Data</h3>
        <p className="text-gray-400">Start studying to see your personalized insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 shadow-xl text-center max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-bold mb-4 text-white">Unlock All Features</h2>
            <p className="mb-6 text-gray-400">Subscribe for <span className="font-bold text-neon-blue">₹199</span> to access all features.</p>
            <button
              onClick={handleSubscribe}
              className="bg-gradient-to-r from-neon-purple to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-200 shadow-lg shadow-neon-purple/20"
            >
              Go to Subscription
            </button>
          </div>
        </div>
      )}
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Advanced Analytics</h1>
            <p className="text-gray-400 mt-2">AI-powered insights into your learning journey</p>
          </div>
          <div className="flex gap-2">
            {(['week', 'month', 'quarter'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 border ${timeRange === range
                    ? 'bg-neon-blue/20 border-neon-blue text-neon-blue'
                    : 'bg-black/20 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Brain className="h-6 w-6 text-neon-purple" />
            AI-Powered Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyticsData.aiInsights.length === 0 ? (
              <div className="col-span-1 md:col-span-2 text-center py-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 inline-block">
                  <Brain className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-white">No insights yet!</h4>
                  <p className="text-gray-400 max-w-sm mx-auto">
                    Start creating study plans, generating flashcards, and taking practice tests to receive personalized AI-powered feedback.
                  </p>
                </div>
              </div>
            ) : (
              analyticsData.aiInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`glass-card rounded-xl p-4 border ${insight.priority === 'high' ? 'border-red-500/30 bg-red-500/10' :
                      insight.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10' :
                        'border-green-500/30 bg-green-500/10'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${insight.type === 'strength' ? 'bg-green-500/20' :
                        insight.type === 'weakness' ? 'bg-red-500/20' :
                          insight.type === 'achievement' ? 'bg-purple-500/20' :
                            'bg-blue-500/20'
                      }`}>
                      {insight.type === 'strength' && <Star className="h-5 w-5 text-green-400" />}
                      {insight.type === 'weakness' && <Target className="h-5 w-5 text-red-400" />}
                      {insight.type === 'achievement' && <Award className="h-5 w-5 text-purple-400" />}
                      {insight.type === 'recommendation' && <Zap className="h-5 w-5 text-blue-400" />}
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-semibold text-white mb-1">{insight.title}</h4>
                      <p className="text-gray-300 text-sm mb-2">{insight.description}</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {insight.actionItems.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Social Metrics */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Users className="h-6 w-6 text-neon-blue" />
            Social Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-4 rounded-2xl mb-3 inline-block shadow-lg shadow-orange-500/20">
                <Award className="h-8 w-8 text-white" />
              </div>
              <p className="text-3xl font-bold text-white">#{analyticsData.socialMetrics.rank}</p>
              <p className="text-gray-400 text-sm">Global Rank</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-2xl mb-3 inline-block shadow-lg shadow-green-500/20">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.socialMetrics.studyStreak}</p>
              <p className="text-gray-400 text-sm">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-2xl mb-3 inline-block shadow-lg shadow-pink-500/20">
                <Star className="h-8 w-8 text-white" />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.socialMetrics.achievements}</p>
              <p className="text-gray-400 text-sm">Achievements</p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-2xl mb-3 inline-block shadow-lg shadow-blue-500/20">
                <Users className="h-8 w-8 text-white" />
              </div>
              <p className="text-3xl font-bold text-white">{analyticsData.socialMetrics.totalUsers.toLocaleString()}</p>
              <p className="text-gray-400 text-sm">Total Users</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Study Patterns */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="h-6 w-6 text-neon-blue" />
              Study Patterns by Hour
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.studyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="hour" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#F9FAFB',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Bar dataKey="sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Performance Radar */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Target className="h-6 w-6 text-neon-green" />
              Subject Performance
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={analyticsData.subjectPerformance}>
                  <PolarGrid stroke="#374151" opacity={0.5} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                  <Radar
                    name="Mastery"
                    dataKey="mastery"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Accuracy"
                    dataKey="accuracy"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#F9FAFB',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Learning Velocity */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-neon-purple" />
              Learning Velocity
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.learningVelocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#F9FAFB',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="conceptsLearned"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="retentionRate"
                    stroke="#EC4899"
                    strokeWidth={3}
                    dot={{ fill: '#EC4899', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Focus Metrics */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Brain className="h-6 w-6 text-neon-yellow" />
              Focus Analysis
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Average Focus Score</span>
                <span className="text-2xl font-bold text-neon-yellow">
                  {Math.round(analyticsData.focusMetrics.averageFocusScore)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Peak Focus Hour</span>
                <span className="text-xl font-bold text-neon-blue">
                  {analyticsData.focusMetrics.peakFocusHour}:00
                </span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.focusMetrics.distractionPatterns}>
                    <XAxis dataKey="timeOfDay" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: '#F9FAFB',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                    <Bar dataKey="distractions" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}