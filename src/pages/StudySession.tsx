import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!studyPlan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Study plan not found</p>
      </div>
    );
  }

  const currentTask = studyPlan.plan.daily_schedule[currentDay];
  const isCurrentTaskCompleted = completedTasks.has(currentTask.day);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/plans')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Plans
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{studyPlan.subject}</h1>
          <p className="text-gray-600">Exam: {format(new Date(studyPlan.exam_date), 'MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Upcoming (reflects reschedules) */}
      {(() => {
        const upcoming = getUpcoming(studyPlan);
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Upcoming</h3>
            {upcoming.length > 0 ? (
              <ul className="text-sm text-gray-700 space-y-1">
                {upcoming.map((d) => (
                  <li key={`${studyPlan.id}-${d.date}-${d.topic}`}>
                    {format(new Date(`${d.date}T00:00:00`), 'MMM dd')}: {d.topic}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">No upcoming sessions</div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Study Plan Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Study Schedule</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {studyPlan.plan.daily_schedule.map((task, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentDay(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                    index === currentDay
                      ? 'bg-blue-100 border-2 border-blue-300'
                      : completedTasks.has(task.day)
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Day {task.day}</span>
                    {completedTasks.has(task.day) && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">{task.topic}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Study Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Current Task */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Day {currentTask.day}</h2>
                <p className="text-gray-600">{format(new Date(currentTask.date), 'MMMM d, yyyy')}</p>
              </div>
              {isCurrentTaskCompleted && (
                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                  <CheckCircle className="h-5 w-5" />
                  Completed
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{currentTask.topic}</h3>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {currentTask.question_type}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Study Focus
                </h4>
                <p className="text-gray-700 leading-relaxed">{currentTask.description}</p>
              </div>

              {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h4 className="font-semibold text-blue-800 mb-3">Practice Questions</h4>
                  <div className="space-y-3">
                    {currentTask.practice_questions.map((question, index) => (
                      <div key={index} className="bg-white rounded-md p-3 border border-blue-200">
                        <p className="text-gray-800 text-sm leading-relaxed">{question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Study Timer */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600 mb-4">
                {formatTime(studyTime)}
              </div>
              
              <div className="flex justify-center gap-4 mb-6">
                <button
                  onClick={toggleStudySession}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    isStudying
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isStudying ? (
                    <>
                      <Pause className="h-5 w-5" />
                      Pause Study
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Start Study
                    </>
                  )}
                </button>

                {!isCurrentTaskCompleted && studyTime > 0 && (
                  <button
                    onClick={completeTask}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors duration-200"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Complete Task
                  </button>
                )}
              </div>

              {/* Notes */}
              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Study Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your study session..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors duration-200 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
              disabled={currentDay === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous Day
            </button>

            <button
              onClick={() => setCurrentDay(Math.min(studyPlan.plan.daily_schedule.length - 1, currentDay + 1))}
              disabled={currentDay === studyPlan.plan.daily_schedule.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Next Day
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}