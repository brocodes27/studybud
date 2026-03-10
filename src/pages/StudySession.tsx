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
      showToast('Failed to load session', 'error');
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

      showToast('Session recorded successfully', 'success');

      if (currentDay < studyPlan.plan.daily_schedule.length - 1) {
        setCurrentDay(currentDay + 1);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      showToast('Failed to save session', 'error');
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-[#64748B]">Loading session...</p>
      </div>
    );
  }

  if (!studyPlan) return null;

  const currentTask = studyPlan.plan.daily_schedule[currentDay];
  const isCompleted = completedTasks.has(currentTask.day);

  return (
    <div className="fixed inset-0 bg-white font-sans flex flex-col overflow-hidden z-[50]">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#0A192F]/5 flex items-center justify-between px-8 bg-white shadow-sm z-50 shrink-0">
        <div className="flex items-center gap-3 w-1/3">
          <BookOpen className="text-[#00D1FF] h-5 w-5 stroke-[2.5px]" />
          <h2 className="text-sm font-bold text-[#64748B] truncate max-w-[200px]">
            {studyPlan.subject} – Day {currentTask.day}
          </h2>
        </div>

        <div className="flex justify-center w-1/3">
          <div className="bg-[#00D1FF]/10 border border-[#00D1FF]/20 px-6 py-1.5 rounded-full flex items-center gap-3 transition-all shadow-float-cyan">
            <Timer className={`h-4 w-4 text-[#00D1FF] ${isStudying ? 'animate-pulse' : ''}`} />
            <span className="text-[#00D1FF] font-extrabold text-xl tabular-nums leading-none">
              {formatTime(studyTime)}
            </span>
          </div>
        </div>

        <div className="flex justify-end w-1/3 gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#64748B] hover:text-[#0A192F] transition-all group"
          >
            <Layout className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 overflow-hidden">
        {/* Reading Area (65%) */}
        <section className="w-[65%] overflow-y-auto custom-scrollbar bg-white relative">
          <div className="max-w-3xl mx-auto py-16 px-12">
            <article className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[#00D1FF] font-bold tracking-[0.2em] text-xs uppercase">Core Concept</span>
                  {isCompleted && (
                    <span className="px-2 py-0.5 bg-[#34D399]/10 text-[#34D399] text-xs font-bold border border-[#34D399]/20 rounded-full">
                      Completed
                    </span>
                  )}
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-[#0A192F]">
                  {currentTask.topic}
                </h1>
              </div>

              <div className="space-y-8">
                <div className="bg-[#00D1FF]/5 border-l-4 border-[#00D1FF] p-8 rounded-r-2xl text-xl text-[#0A192F] leading-relaxed font-medium">
                  {currentTask.description}
                </div>

                {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Practice Questions</h3>
                    <div className="grid gap-3">
                      {currentTask.practice_questions.map((q, idx) => (
                        <div key={idx} className="bg-[#F8FAFF] border-2 border-[#0A192F]/5 p-5 rounded-[16px] flex items-start gap-4 hover:border-[#00D1FF]/20 transition-all">
                          <div className="w-6 h-6 rounded-full bg-[#00D1FF]/10 flex items-center justify-center text-xs font-extrabold text-[#00D1FF] shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="text-base font-medium text-[#0A192F] leading-snug">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="pt-12 flex flex-col items-center gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsStudying(!isStudying)}
                    className={`flex items-center gap-3 px-8 py-4 rounded-[16px] font-bold text-base transition-all shadow-lg ${isStudying
                        ? 'bg-amber-500 text-white shadow-amber-500/20 hover:-translate-y-0.5'
                        : 'bg-[#00D1FF] text-[#0A192F] shadow-float-cyan hover:-translate-y-0.5 active:scale-95'
                      }`}
                  >
                    {isStudying ? <><Pause className="h-5 w-5 fill-white" /> Pause Focus</> : <><Play className="h-5 w-5 fill-[#0A192F]" /> Start Focus</>}
                  </button>

                  <button
                    onClick={completeTask}
                    className="flex items-center gap-3 bg-[#0A192F] text-white px-8 py-4 rounded-[16px] font-bold text-base transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    <CheckCircle className="h-5 w-5 stroke-[2.5px]" />
                    Mark Complete
                  </button>
                </div>

                <p className="text-xs font-medium text-[#64748B]">Timer tracks your focus time automatically</p>
              </div>

              {/* Footer Nav */}
              <nav className="mt-20 pt-8 border-t border-[#0A192F]/5 flex justify-between items-center">
                <button
                  onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
                  disabled={currentDay === 0}
                  className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#0A192F] disabled:opacity-0 transition-all"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  onClick={() => setCurrentDay(Math.min(studyPlan.plan.daily_schedule.length - 1, currentDay + 1))}
                  disabled={currentDay === studyPlan.plan.daily_schedule.length - 1}
                  className="flex items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#0A192F] disabled:opacity-0 transition-all"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            </article>
          </div>
        </section>

        {/* AI Sidebar (35%) */}
        <aside className="w-[35%] bg-[#F8FAFF] border-l border-[#0A192F]/5 flex flex-col shadow-lg z-40">
          {/* AI Header */}
          <div className="p-5 border-b border-[#0A192F]/5 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center text-[#00D1FF] shadow-float-cyan">
                <Bot size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0A192F] tracking-tight">Atlas</h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse"></div>
                  <p className="text-xs font-medium text-[#64748B]">Ready to help</p>
                </div>
              </div>
            </div>
            <Zap className="h-4 w-4 text-[#00D1FF] opacity-50" />
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {messages.map((m, i) => (
              <motion.div
                initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-4 rounded-[16px] text-sm leading-relaxed ${m.role === 'user'
                    ? 'bg-[#00D1FF] text-[#0A192F] rounded-tr-none font-medium'
                    : 'bg-white text-[#0A192F] rounded-tl-none border-2 border-[#0A192F]/5 font-medium'
                  }`}>
                  {m.content}
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Input */}
          <div className="p-5 bg-white border-t border-[#0A192F]/5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setChatInput("Summarize this topic")}
                className="px-3 py-1.5 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-xs font-bold text-[#00D1FF] hover:bg-[#00D1FF]/20 transition-all"
              >
                Summarize
              </button>
              <button
                onClick={() => setChatInput("Give me a practice problem")}
                className="px-3 py-1.5 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-xs font-bold text-[#00D1FF] hover:bg-[#00D1FF]/20 transition-all"
              >
                Practice
              </button>
            </div>

            <div className="relative">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="w-full bg-[#F8FAFF] border-2 border-[#0A192F]/10 rounded-[14px] py-4 pl-5 pr-14 text-sm font-medium focus:ring-0 focus:border-[#00D1FF] placeholder:text-[#64748B]/50 transition-all"
                placeholder="Ask Atlas anything..."
                type="text"
              />
              <button
                onClick={handleSendMessage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-[#00D1FF] rounded-[10px] text-[#0A192F] hover:scale-105 active:scale-95 transition-all shadow-float-cyan"
              >
                <Send size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}