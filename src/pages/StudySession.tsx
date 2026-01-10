import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle, BookOpen, ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
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
      showToast('SESSION_READ_ERROR', 'error');
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

      showToast('LOG_SUCCESS: SESSION_RECORDED', 'success');

      if (currentDay < studyPlan.plan.daily_schedule.length - 1) {
        setCurrentDay(currentDay + 1);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      showToast('UPLOAD_CRITICAL: LOG_FAILURE', 'error');
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
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
        <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin" />
        <h2 className="text-3xl font-black text-black uppercase tracking-tighter italic">RETRIEVING_DATA...</h2>
      </div>
    );
  }

  if (!studyPlan) {
    return (
      <div className="bg-neo-accent border-8 border-black p-12 text-center shadow-[16px_16px_0px_0px_#000] rotate-1">
        <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">BUFFER_NULL: PLAN_NOT_FOUND</h3>
        <button
          onClick={() => navigate('/plans')}
          className="mt-8 bg-black text-white px-10 py-4 font-black uppercase tracking-widest border-4 border-black shadow-[6px_6px_0px_0px_#fff]"
        >
          REVERT_TO_BASE
        </button>
      </div>
    );
  }

  const currentTask = studyPlan.plan.daily_schedule[currentDay];
  const isCurrentTaskCompleted = completedTasks.has(currentTask.day);

  return (
    <div className="space-y-12 animate-fade-in relative pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-8 border-black pb-10">
        <div>
          <button
            onClick={() => navigate('/plans')}
            className="flex items-center gap-3 text-black/40 font-black uppercase tracking-[0.2em] mb-4 hover:text-black transition-colors"
          >
            <ArrowLeft className="h-6 w-6 stroke-[4px]" /> REVERT_TO_BASE
          </button>
          <h1 className="text-6xl md:text-8xl font-black text-black uppercase tracking-tighter italic leading-none">{studyPlan.subject}</h1>
          <p className="text-black font-black uppercase tracking-widest text-sm mt-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-neo-accent stroke-[3px]" />
            DEADLINE: {format(new Date(studyPlan.exam_date), 'MMM dd, yyyy')}
          </p>
        </div>

        {/* Upcoming Sticker */}
        {(() => {
          const upcoming = getUpcoming(studyPlan);
          if (upcoming.length === 0) return null;
          return (
            <div className="bg-white border-4 border-black p-6 shadow-[10px_10px_0px_0px_#000] rotate-2 max-w-xs">
              <h3 className="text-[10px] font-black text-black/30 mb-3 uppercase tracking-widest border-b-2 border-black/10 pb-2">NEXT_CHUNKS</h3>
              <ul className="space-y-2">
                {upcoming.map((d) => (
                  <li key={`${studyPlan.id}-${d.date}-${d.topic}`} className="flex items-center gap-3 text-[10px] font-black uppercase">
                    <span className="text-neo-accent italic">{format(new Date(`${d.date}T00:00:00`), 'MMM dd')}</span>
                    <span className="truncate">{d.topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Study Plan Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white border-6 border-black p-8 shadow-[12px_12px_0px_0px_#000] rotate-1 h-full max-h-[700px] flex flex-col">
            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic mb-8 border-b-4 border-black pb-4">TIMELINE_MAP</h3>
            <div className="space-y-4 overflow-y-auto pr-4 custom-scrollbar flex-1">
              {studyPlan.plan.daily_schedule.map((task, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentDay(index)}
                  className={`w-full text-left p-6 border-4 border-black transition-all group relative ${index === currentDay
                    ? 'bg-neo-secondary shadow-none translate-x-[4px] translate-y-[4px]'
                    : completedTasks.has(task.day)
                      ? 'bg-neo-muted/20 opacity-60 shadow-[4px_4px_0px_0px_#000]'
                      : 'bg-white shadow-[6px_6px_0px_0px_#000] hover:bg-neo-bg hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_#000]'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-xs uppercase italic">NODE_{task.day.toString().padStart(3, '0')}</span>
                    {completedTasks.has(task.day) && (
                      <CheckCircle className="h-5 w-5 text-neo-secondary stroke-[4px]" />
                    )}
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight leading-tight line-clamp-2 italic">{task.topic}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Study Area */}
        <div className="lg:col-span-3 space-y-12">
          {/* Current Task */}
          <div className="bg-white border-8 border-black p-12 shadow-[24px_24px_0px_0px_#000] relative overflow-hidden -rotate-1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neo-accent/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

            <div className="flex items-center justify-between mb-10 pb-6 border-b-4 border-black/10">
              <div>
                <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">NODE_{currentTask.day.toString().padStart(3, '0')}</h2>
                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">{format(new Date(currentTask.date), 'MMMM dd, yyyy')}</p>
              </div>
              {isCurrentTaskCompleted && (
                <div className="bg-neo-secondary border-4 border-black px-6 py-2 shadow-[6px_6px_0px_0px_#000] rotate-6 flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-black stroke-[4px]" />
                  <span className="font-black text-black uppercase italic tracking-widest text-sm">ARCHIVED</span>
                </div>
              )}
            </div>

            <div className="space-y-10">
              <div>
                <h3 className="text-4xl font-black text-black mb-4 uppercase tracking-tighter italic leading-tight">{currentTask.topic}</h3>
                <span className="inline-block px-4 py-2 bg-black text-white font-black uppercase text-[10px] tracking-[0.3em] -rotate-1 border-2 border-black">
                  LEVEL: {currentTask.question_type.toUpperCase()}
                </span>
              </div>

              <div className="bg-neo-bg/10 border-4 border-black p-10 rotate-1 shadow-[8px_8px_0px_0px_#000]">
                <h4 className="font-black text-black uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-neo-accent stroke-[3px]" />
                  MISSION_DIRECTIVES
                </h4>
                <p className="text-xl font-black text-black leading-snug italic uppercase tracking-tight">{currentTask.description}</p>
              </div>

              {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                <div className="bg-white border-4 border-black p-10 -rotate-1 shadow-[12px_12px_0px_0px_#000]">
                  <h4 className="font-black text-black uppercase tracking-[0.2em] text-xs mb-8">QUERY_PACKETS_PENDING</h4>
                  <div className="space-y-6">
                    {currentTask.practice_questions.map((question, index) => (
                      <div key={index} className="bg-neo-bg/5 border-2 border-black p-6 hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                        <p className="text-black font-black uppercase text-sm leading-tight italic">{question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Study Timer Sticker */}
          <div className="bg-black text-white border-8 border-black p-12 shadow-[20px_20px_0px_0px_#000] text-center rotate-1 relative">
            {/* Mechanical decoration */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-neo-accent border-4 border-black rotate-12 shadow-[4px_4px_0px_0px_#000]"></div>

            <div className="text-8xl md:text-9xl font-black mb-10 font-mono tracking-tighter tabular-nums text-neo-secondary italic drop-shadow-[8px_8px_0px_#000]">
              {formatTime(studyTime)}
            </div>

            <div className="flex flex-col md:flex-row justify-center gap-6 mb-12">
              <button
                onClick={toggleStudySession}
                className={`flex items-center justify-center gap-4 px-12 py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl transition-all shadow-[8px_8px_0px_0px_#000] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] ${isStudying
                  ? 'bg-neo-accent text-white'
                  : 'bg-neo-secondary text-black'
                  }`}
              >
                {isStudying ? (
                  <>
                    <Pause className="h-10 w-10 stroke-[4px]" />
                    HALT_SESS
                  </>
                ) : (
                  <>
                    <Play className="h-10 w-10 stroke-[4px]" />
                    INIT_SESS
                  </>
                )}
              </button>

              {!isCurrentTaskCompleted && studyTime > 0 && (
                <button
                  onClick={completeTask}
                  className="flex items-center justify-center gap-4 bg-white text-black px-12 py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl transition-all shadow-[8px_8px_0px_0px_#000] hover:bg-neo-secondary active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                >
                  <CheckCircle className="h-10 w-10 stroke-[4px]" />
                  COMMIT_LOG
                </button>
              )}
            </div>

            {/* Notes Input */}
            <div className="text-left bg-white/5 p-10 border-4 border-black shadow-[6px_6px_0px_0px_#000]">
              <label className="block text-[10px] font-black text-white/40 mb-4 uppercase tracking-[0.3em]">
                ADDITIONAL_INSIGHTS_LOG
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="INPUT DATA..."
                rows={3}
                className="w-full px-8 py-5 bg-white border-4 border-black text-black font-black text-xl uppercase italic tracking-tighter focus:bg-neo-bg outline-none transition-all resize-none placeholder-black/20"
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-8">
            <button
              onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
              disabled={currentDay === 0}
              className="flex items-center gap-3 px-8 py-4 bg-white border-4 border-black font-black uppercase tracking-widest text-xs hover:bg-neo-bg disabled:opacity-20 transition-all shadow-[6px_6px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              <ArrowLeft className="h-5 w-5 stroke-[4px]" />
              REVERT_DAY
            </button>

            <button
              onClick={() => setCurrentDay(Math.min(studyPlan.plan.daily_schedule.length - 1, currentDay + 1))}
              disabled={currentDay === studyPlan.plan.daily_schedule.length - 1}
              className="flex items-center gap-3 px-8 py-4 bg-white border-4 border-black font-black uppercase tracking-widest text-xs hover:bg-neo-bg disabled:opacity-20 transition-all shadow-[6px_6px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              COMMIT_NEXT
              <ArrowRight className="h-5 w-5 stroke-[4px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}