import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle, BookOpen, ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { format } from 'date-fns';

interface StudyPlan {
  id: string;
  subject: string;
  exam_date: string;
  plan: {
    daily_schedule: Array<{
      day: number;
      date: string;
      topic: string;
      question_type: string;
      description: string;
      practice_questions?: string[];
    }>;
  };
}

const getUpcoming = (plan: StudyPlan | null) => {
  if (!plan) return [] as Array<{ day: number; date: string; topic: string }>;
  const todayStr = new Date().toISOString().slice(0, 10);
  const sched = Array.isArray(plan.plan?.daily_schedule) ? plan.plan.daily_schedule : [];
  return sched
    .filter((d: any) => d?.date && d.date >= todayStr)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 3);
};

export function StudySession() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const { showToast } = useToast();

  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [currentDay, setCurrentDay] = useState(0);
  const [isStudying, setIsStudying] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudyPlan();
    fetchCompletedTasks();
  }, [planId]);

  useEffect(() => {
    if (!planId) return;
    const channel = supabase
      .channel('exam_plan_view_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_plans', filter: `id=eq.${planId}` },
        () => {
          fetchStudyPlan();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStudying) {
      interval = setInterval(() => {
        setStudyTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStudying]);

  const fetchStudyPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setStudyPlan(data);
    } catch (error) {
      console.error('Error fetching study plan:', error);
      showToast('Failed to load study plan', 'error');
      navigate('/plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('task_completions')
        .select('day_number')
        .eq('plan_id', planId)
        .eq('user_id', user?.id);

      if (error) throw error;

      const completed = new Set(data?.map(item => item.day_number) || []);
      setCompletedTasks(completed);
    } catch (error) {
      console.error('Error fetching completed tasks:', error);
    }
  };

  const toggleStudySession = () => {
    setIsStudying(!isStudying);
  };

  const completeTask = async () => {
    if (!studyPlan) return;

    const currentTask = studyPlan.plan.daily_schedule[currentDay];

    try {
      const { error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user?.id,
          plan_id: planId,
          day_number: currentTask.day,
          topic: currentTask.topic,
          duration_minutes: Math.floor(studyTime / 60),
          notes: notes
        });

      if (sessionError) throw sessionError;

      const { error: completionError } = await supabase
        .from('task_completions')
        .upsert(
          {
            user_id: user?.id,
            plan_id: planId,
            day_number: currentTask.day,
            task_type: 'study_session'
          },
          { onConflict: 'user_id,plan_id,day_number', ignoreDuplicates: true }
        );

      if (completionError) throw completionError;

      setCompletedTasks(prev => new Set([...prev, currentTask.day]));
      setIsStudying(false);
      setStudyTime(0);
      setNotes('');

      showToast('Study session completed!', 'success');

      if (currentDay < studyPlan.plan.daily_schedule.length - 1) {
        setCurrentDay(currentDay + 1);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      showToast('Failed to save study session', 'error');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  if (!studyPlan) {
    return (
      <div className="text-center py-12 glass-panel rounded-2xl border border-white/10">
        <p className="text-gray-400">Study plan not found</p>
      </div>
    );
  }

  const currentTask = studyPlan.plan.daily_schedule[currentDay];
  const isCurrentTaskCompleted = completedTasks.has(currentTask.day);

  return (
    <div className="space-y-8 animate-fade-in relative p-4 md:p-8">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/plans')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Plans
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">{studyPlan.subject}</h1>
          <p className="text-gray-400 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neon-purple" />
            Exam: {format(new Date(studyPlan.exam_date), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Upcoming (reflects reschedules) */}
      {(() => {
        const upcoming = getUpcoming(studyPlan);
        return (
          <div className="glass-panel rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-neon-green" />
              Upcoming
            </h3>
            {upcoming.length > 0 ? (
              <ul className="space-y-3">
                {upcoming.map((d) => (
                  <li key={`${studyPlan.id}-${d.date}-${d.topic}`} className="flex items-center gap-3 text-sm text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-neon-blue font-mono">{format(new Date(`${d.date}T00:00:00`), 'MMM dd')}</span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
                    <span>{d.topic}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500 italic">No upcoming sessions</div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Study Plan Navigation */}
        <div className="lg:col-span-1">
          <div className="glass-panel rounded-2xl p-6 border border-white/10 h-full max-h-[600px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Study Schedule</h3>
            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {studyPlan.plan.daily_schedule.map((task, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentDay(index)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${index === currentDay
                      ? 'bg-neon-blue/20 border-neon-blue/50 shadow-lg shadow-neon-blue/10'
                      : completedTasks.has(task.day)
                        ? 'bg-neon-green/10 border-neon-green/30 opacity-70'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium text-sm ${index === currentDay ? 'text-white' : 'text-gray-400'}`}>Day {task.day}</span>
                    {completedTasks.has(task.day) && (
                      <CheckCircle className="h-4 w-4 text-neon-green" />
                    )}
                  </div>
                  <p className={`text-xs truncate ${index === currentDay ? 'text-gray-300' : 'text-gray-500'}`}>{task.topic}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Study Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Current Task */}
          <div className="glass-panel rounded-2xl p-8 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Day {currentTask.day}</h2>
                <p className="text-gray-400">{format(new Date(currentTask.date), 'MMMM d, yyyy')}</p>
              </div>
              {isCurrentTaskCompleted && (
                <div className="flex items-center gap-2 bg-neon-green/20 text-neon-green px-4 py-2 rounded-full border border-neon-green/30 shadow-lg shadow-neon-green/10">
                  <CheckCircle className="h-5 w-5" />
                  Completed
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-3">{currentTask.topic}</h3>
                <span className="inline-block px-3 py-1 bg-neon-blue/20 text-neon-blue rounded-lg text-sm font-medium border border-neon-blue/30">
                  {currentTask.question_type}
                </span>
              </div>

              <div className="bg-black/40 rounded-xl p-6 border border-white/5">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-neon-purple" />
                  Study Focus
                </h4>
                <p className="text-gray-300 leading-relaxed">{currentTask.description}</p>
              </div>

              {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                <div className="bg-neon-blue/5 rounded-xl p-6 border border-neon-blue/20">
                  <h4 className="font-semibold text-neon-blue mb-4">Practice Questions</h4>
                  <div className="space-y-3">
                    {currentTask.practice_questions.map((question, index) => (
                      <div key={index} className="bg-black/40 rounded-lg p-4 border border-white/5 hover:border-neon-blue/30 transition-colors">
                        <p className="text-gray-300 text-sm leading-relaxed">{question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Study Timer */}
          <div className="glass-panel rounded-2xl p-8 border border-white/10 text-center">
            <div className="text-7xl font-bold text-white mb-6 font-mono tracking-wider drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              {formatTime(studyTime)}
            </div>

            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={toggleStudySession}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg ${isStudying
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-red-500/10'
                    : 'bg-neon-green text-black hover:bg-neon-green/90 shadow-neon-green/20'
                  }`}
              >
                {isStudying ? (
                  <>
                    <Pause className="h-6 w-6" />
                    Pause Study
                  </>
                ) : (
                  <>
                    <Play className="h-6 w-6" />
                    Start Study
                  </>
                )}
              </button>

              {!isCurrentTaskCompleted && studyTime > 0 && (
                <button
                  onClick={completeTask}
                  className="flex items-center gap-2 bg-neon-blue hover:bg-neon-blue/80 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors duration-200 shadow-lg shadow-neon-blue/20"
                >
                  <CheckCircle className="h-6 w-6" />
                  Complete Task
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="text-left bg-black/40 p-6 rounded-xl border border-white/5">
              <label className="block text-sm font-semibold text-gray-400 mb-3">
                Study Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about your study session..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-neon-blue focus:outline-none transition-colors duration-200 resize-none placeholder-gray-600"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
              disabled={currentDay === 0}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 border border-white/5"
            >
              <ArrowLeft className="h-5 w-5" />
              Previous Day
            </button>

            <button
              onClick={() => setCurrentDay(Math.min(studyPlan.plan.daily_schedule.length - 1, currentDay + 1))}
              disabled={currentDay === studyPlan.plan.daily_schedule.length - 1}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 border border-white/5"
            >
              Next Day
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}