import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
  Brain, TrendingUp, Clock, Target, Award,
  Zap, Star, Activity, Users
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useToast } from '../hooks/useToast';
import { FeatureGate } from './FeatureGate';

interface AnalyticsData {
  studyPatterns: {
    hour: number;
    sessions: number;
    avgDuration: number;
  }[];
  subjectPerformance: {
    subject: string;
    mastery: number;
    timeSpent: number;
    accuracy: number;
  }[];
  learningVelocity: {
    date: string;
    conceptsLearned: number;
    retentionRate: number;
  }[];
  focusMetrics: {
    averageFocusScore: number;
    peakFocusHour: number;
    distractionPatterns: { timeOfDay: string; distractions: number }[];
  };
  aiInsights: {
    type: 'strength' | 'weakness' | 'recommendation' | 'achievement';
    title: string;
    description: string;
    actionItems: string[];
    priority: 'high' | 'medium' | 'low';
  }[];
  socialMetrics: {
    rank: number;
    totalUsers: number;
    studyStreak: number;
    achievements: number;
  };
}

export function AdvancedAnalytics() {
  const { user } = useAuth() as { user: any; loading: boolean };
  const { showToast } = useToast();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, timeRange]);

  const fetchAnalyticsData = async () => {
    setLoadingData(true);
    try {
      // Mock data based on the interface
      const mockData: AnalyticsData = {
        studyPatterns: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          sessions: Math.floor(Math.random() * 10),
          avgDuration: Math.floor(Math.random() * 60)
        })),
        subjectPerformance: [
          { subject: 'Math', mastery: 85, timeSpent: 120, accuracy: 90 },
          { subject: 'Science', mastery: 70, timeSpent: 90, accuracy: 75 },
          { subject: 'History', mastery: 95, timeSpent: 60, accuracy: 98 },
          { subject: 'Literature', mastery: 60, timeSpent: 45, accuracy: 65 },
          { subject: 'Coding', mastery: 80, timeSpent: 150, accuracy: 85 }
        ],
        learningVelocity: Array.from({ length: 7 }, (_, i) => ({
          date: format(subDays(new Date(), 6 - i), 'MMM dd'),
          conceptsLearned: Math.floor(Math.random() * 5) + 1,
          retentionRate: 70 + Math.random() * 20
        })),
        focusMetrics: {
          averageFocusScore: 82,
          peakFocusHour: 10,
          distractionPatterns: [
            { timeOfDay: 'Morning', distractions: 2 },
            { timeOfDay: 'Afternoon', distractions: 5 },
            { timeOfDay: 'Evening', distractions: 3 }
          ]
        },
        aiInsights: [
          {
            type: 'strength',
            title: 'High Retention in STEM',
            description: 'You are showing exceptional retention in Mathematical concepts.',
            actionItems: ['Attempt advanced calculus level 2', 'Help a peer in the Physics group'],
            priority: 'medium'
          },
          {
            type: 'weakness',
            title: 'Afternoon Slump Detected',
            description: 'Your focus scores drop between 2 PM and 4 PM.',
            actionItems: ['Schedule lighter reading during this time', 'Take a 15-minute active break'],
            priority: 'high'
          }
        ],
        socialMetrics: {
          rank: 42,
          totalUsers: 12500,
          studyStreak: 12,
          achievements: 8
        }
      };

      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      showToast('SYNC_ERROR: ANALYTICS_STREAM_FAILED', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  if (loadingData || !analyticsData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-8">
        <div className="w-20 h-20 border-8 border-black border-t-neo-purple animate-spin" />
        <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic">SCANNING_NEURAL_PATTERNS...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Advanced Analytics</h1>
          <p className="text-gray-400 mt-2 uppercase text-xs tracking-widest font-black italic">AI-powered insights into your learning journey</p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 border-4 border-black font-black uppercase text-xs tracking-widest italic transition-all ${timeRange === range
                ? 'bg-neo-secondary text-black shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-white text-black hover:bg-neo-bg shadow-[4px_4px_0px_0px_#000]'
                }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <FeatureGate fallback="blur" featureName="AI Insights">
        <div className="bg-white border-8 border-black p-8 shadow-[16px_16px_0px_0px_#A294F9] rotate-1">
          <h3 className="text-2xl font-black text-black mb-8 flex items-center gap-4 uppercase italic">
            <Brain className="h-8 w-8 text-black stroke-[3px]" />
            AI-Powered Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analyticsData.aiInsights.length === 0 ? (
              <div className="col-span-2 text-center py-12 border-4 border-dashed border-black/20">
                <Brain className="h-16 w-16 text-black/10 mx-auto mb-4" />
                <h4 className="text-xl font-black text-black/40 uppercase">NO_RECOVERY_DATA</h4>
              </div>
            ) : (
              analyticsData.aiInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-6 border-4 border-black shadow-[8px_8px_0px_0px_#000] relative ${insight.priority === 'high' ? 'bg-neo-accent/20' : 'bg-neo-secondary/20'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 border-2 border-black ${insight.type === 'strength' ? 'bg-neo-secondary' :
                      insight.type === 'weakness' ? 'bg-neo-accent' :
                        'bg-black text-white'
                      }`}>
                      {insight.type === 'strength' && <Star className="h-6 w-6" />}
                      {insight.type === 'weakness' && <Target className="h-6 w-6" />}
                      {insight.type === 'achievement' && <Award className="h-6 w-6" />}
                      {insight.type === 'recommendation' && <Zap className="h-6 w-6" />}
                    </div>
                    <div>
                      <h4 className="font-black text-black uppercase italic text-lg leading-none mb-2">{insight.title}</h4>
                      <p className="text-black/70 text-sm font-bold mb-4 uppercase leading-tight">{insight.description}</p>
                      <div className="space-y-2">
                        {insight.actionItems.map((item, i) => (
                          <div key={i} className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-black/40">
                            <span>►</span> {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </FeatureGate>

      {/* Social Metrics */}
      <div className="bg-white border-8 border-black p-8 shadow-[16px_16px_0px_0px_#4D96FF] -rotate-1">
        <h3 className="text-2xl font-black text-black mb-8 flex items-center gap-4 uppercase italic">
          <Users className="h-8 w-8 text-black stroke-[3px]" />
          Social Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center p-6 border-4 border-black bg-neo-bg">
            <p className="text-4xl font-black text-black italic">#{analyticsData.socialMetrics.rank}</p>
            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">Global Rank</p>
          </div>
          <div className="text-center p-6 border-4 border-black bg-neo-secondary">
            <p className="text-4xl font-black text-black italic">{analyticsData.socialMetrics.studyStreak}D</p>
            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">Streak</p>
          </div>
          <div className="text-center p-6 border-4 border-black bg-neo-accent">
            <p className="text-4xl font-black text-white italic">{analyticsData.socialMetrics.achievements}</p>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-2">Badges</p>
          </div>
          <div className="text-center p-6 border-4 border-black bg-black">
            <p className="text-4xl font-black text-white italic">{(analyticsData.socialMetrics.totalUsers / 1000).toFixed(1)}K</p>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-2">Total</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Study Patterns */}
        <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_#000]">
          <h3 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase italic">
            <Clock className="h-6 w-6 text-black stroke-[3px]" />
            Study Density / Hour
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.studyPatterns}>
                <CartesianGrid strokeDasharray="3 3" stroke="#000" opacity={0.1} />
                <XAxis dataKey="hour" stroke="#000" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#000" fontSize={10} fontStyle="italic" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '4px solid #000',
                    borderRadius: '0',
                    fontFamily: 'Black Ops One, cursive'
                  }}
                />
                <Bar dataKey="sessions" fill="#4D96FF" stroke="#000" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Performance Radar */}
        <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_#000]">
          <h3 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase italic">
            <Target className="h-6 w-6 text-black stroke-[3px]" />
            Skill Mastery Radar
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={analyticsData.subjectPerformance}>
                <PolarGrid stroke="#000" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#000', fontSize: 10, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Mastery"
                  dataKey="mastery"
                  stroke="#A294F9"
                  fill="#A294F9"
                  fillOpacity={0.6}
                  strokeWidth={2}
                />
                <Radar
                  name="Accuracy"
                  dataKey="accuracy"
                  stroke="#FF6B6B"
                  fill="#FF6B6B"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning Velocity */}
        <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_#000]">
          <h3 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase italic">
            <TrendingUp className="h-6 w-6 text-black stroke-[3px]" />
            Growth Velocity
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.learningVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#000" opacity={0.1} />
                <XAxis dataKey="date" stroke="#000" fontSize={10} />
                <YAxis stroke="#000" fontSize={10} />
                <Tooltip />
                <Line
                  type="step"
                  dataKey="conceptsLearned"
                  stroke="#000"
                  strokeWidth={4}
                  dot={{ fill: '#4D96FF', r: 6, strokeWidth: 2, stroke: '#000' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Focus Metrics */}
        <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_#000]">
          <h3 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase italic">
            <Activity className="h-6 w-6 text-black stroke-[3px]" />
            Focus Correlation
          </h3>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border-2 border-black bg-neo-bg">
                <p className="text-[10px] font-black uppercase text-black/40">AVG_FOCUS</p>
                <p className="text-2xl font-black italic">{analyticsData.focusMetrics.averageFocusScore}%</p>
              </div>
              <div className="p-4 border-2 border-black bg-neo-secondary">
                <p className="text-[10px] font-black uppercase text-black/40">PEAK_HOUR</p>
                <p className="text-2xl font-black italic">{analyticsData.focusMetrics.peakFocusHour}:00</p>
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.focusMetrics.distractionPatterns}>
                  <XAxis dataKey="timeOfDay" stroke="#000" fontSize={8} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="distractions" fill="#FF6B6B" stroke="#000" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}