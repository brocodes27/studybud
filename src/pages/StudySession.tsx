import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Pause,
  CheckCircle,
  BookOpen,
  Timer,
  Layout,
  ChevronLeft,
  ChevronRight,
  Bot,
  Send,
  Zap,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { motion } from 'framer-motion';

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

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'atlas' | 'user', content: string }>>([
    {
      role: 'atlas',
      content: "Hello! I'm Atlas. I'm here to help you master this topic today. Do you have any questions, or would you like to try a practice problem?"
    }
  ]);

  useEffect(() => {
    fetchStudyPlan();
    fetchCompletedTasks();
  }, [planId]);

  useEffect(() => {
    let interval: any;
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
      navigate('/dashboard');
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

  const completeTask = async () => {
    if (!studyPlan) return;
    const currentTask = studyPlan.plan.daily_schedule[currentDay];

    try {
      await supabase.from('study_sessions').insert({
        user_id: user?.id,
        plan_id: planId,
        day_number: currentTask.day,
        topic: currentTask.topic,
        duration_minutes: Math.floor(studyTime / 60),
        notes: notes
      });

      await supabase.from('task_completions').upsert(
        {
          user_id: user?.id,
          plan_id: planId,
          day_number: currentTask.day,
          task_type: 'study_session'
        },
        { onConflict: 'user_id,plan_id,day_number' }
      );

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
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    setChatInput('');

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'atlas',
        content: "That's a great question! Let's break it down together. Which part of the concept is most confusing for you right now?"
      }]);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <h2 className="text-xl font-black text-slate-500 uppercase tracking-[0.3em] mt-8">Initializing Focus Mode...</h2>
      </div>
    );
  }

  if (!studyPlan) return null;

  const currentTask = studyPlan.plan.daily_schedule[currentDay];
  const isCompleted = completedTasks.has(currentTask.day);

  return (
    <div className="fixed inset-0 bg-background-dark text-slate-100 font-sans flex flex-col overflow-hidden z-[50]">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-white/5 backdrop-blur-md z-50 shrink-0">
        <div className="flex items-center gap-3 w-1/3">
          <BookOpen className="text-primary h-5 w-5" />
          <h2 className="text-xs font-black tracking-widest uppercase text-slate-500 truncate max-w-[200px]">
            {studyPlan.subject} – Day {currentTask.day}
          </h2>
        </div>

        <div className="flex justify-center w-1/3">
          <div className="bg-primary/10 border border-primary/20 px-6 py-1.5 rounded-full flex items-center gap-3 timer-pulse transition-all">
            <Timer className={`h-4 w-4 text-primary ${isStudying ? 'animate-pulse' : ''}`} />
            <span className="text-primary font-black text-xl tabular-nums leading-none -mb-0.5">
              {formatTime(studyTime)}
            </span>
          </div>
        </div>

        <div className="flex justify-end w-1/3 gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all group"
          >
            <Layout className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 overflow-hidden">
        {/* Reading Area (65%) */}
        <section className="w-[65%] overflow-y-auto custom-scrollbar bg-background-dark relative">
          <div className="max-w-3xl mx-auto py-16 px-12">
            <article className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-black tracking-[0.4em] text-[10px] uppercase">Core Concept</span>
                  {isCompleted && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 rounded">
                      Secured
                    </span>
                  )}
                </div>
                <h1 className="text-6xl font-black tracking-tighter leading-tight italic uppercase drop-shadow-sm">
                  {currentTask.topic}
                </h1>
              </div>

              <div className="prose prose-invert max-w-none text-xl leading-relaxed text-slate-400 space-y-8 font-medium">
                <div className="bg-primary/5 border-l-4 border-primary p-8 rounded-r-2xl italic text-2xl text-slate-200 shadow-xl shadow-black/5">
                  "{currentTask.description}"
                </div>

                {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                  <div className="space-y-6 pt-6">
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">Session Checkpoints</h3>
                    <div className="grid gap-4">
                      {currentTask.practice_questions.map((q, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/5 p-6 rounded-2xl flex items-start gap-4 hover:border-primary/30 transition-all cursor-default group">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            {idx + 1}
                          </div>
                          <p className="text-lg font-bold text-slate-300 uppercase italic tracking-tight">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="pt-16 flex flex-col items-center gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsStudying(!isStudying)}
                    className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all shadow-xl ${isStudying
                        ? 'bg-amber-500 text-white shadow-amber-500/20'
                        : 'bg-primary text-white shadow-primary/25 hover:scale-105 active:scale-95'
                      }`}
                  >
                    {isStudying ? <><Pause className="fill-white" /> Pause Focus</> : <><Play className="fill-white" /> Start Focus</>}
                  </button>

                  <button
                    onClick={completeTask}
                    className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all shadow-xl border border-white/5 hover:translate-y-[-2px]"
                  >
                    <CheckCircle className="h-6 w-6 stroke-[3]" />
                    Complete
                  </button>
                </div>

                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] mt-4">Deep Focus Engaged</p>
              </div>

              {/* Footer Nav */}
              <nav className="mt-24 pt-8 border-t border-white/5 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
                  disabled={currentDay === 0}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-primary disabled:opacity-0 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  onClick={() => setCurrentDay(Math.min(studyPlan.plan.daily_schedule.length - 1, currentDay + 1))}
                  disabled={currentDay === studyPlan.plan.daily_schedule.length - 1}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-primary disabled:opacity-0 transition-all"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            </article>
          </div>
        </section>

        {/* AI Sidebar (35%) */}
        <aside className="w-[35%] bg-card-dark border-l border-white/5 flex flex-col shadow-2xl z-40">
          {/* AI Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <Bot size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-tighter text-white">Atlas</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Analysis</p>
                </div>
              </div>
            </div>
            <Zap className="h-4 w-4 text-primary opacity-20" />
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/20">
            {messages.map((m, i) => (
              <motion.div
                initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-5 rounded-2xl text-sm leading-relaxed shadow-lg ${m.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                  }`}>
                  <p className={m.role === 'user' ? 'font-bold italic' : 'font-medium'}>{m.content}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Input */}
          <div className="p-6 bg-slate-900 border-t border-white/5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setChatInput("Summarize Faraday's Law")}
                className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/20 transition-all"
              >
                Summarize
              </button>
              <button
                onClick={() => setChatInput("Give me a practice problem")}
                className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/20 transition-all"
              >
                Practice
              </button>
            </div>

            <div className="relative">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-5 pl-6 pr-14 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-600 transition-all shadow-inner"
                placeholder="Ask Atlas anything..."
                type="text"
              />
              <button
                onClick={handleSendMessage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-primary rounded-xl text-white hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30"
              >
                <Send size={18} strokeWidth={3} />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-600 uppercase tracking-[0.4em] font-black">AI Study Terminal</p>
          </div>
        </aside>
      </main>
    </div>
  );
}