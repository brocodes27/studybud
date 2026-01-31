import React, { useState, useEffect, useRef } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import {
  Power, Brain,
  Search, MessageSquare, Video,
  PenTool, BookOpen, Sparkles,
  Activity, Database, ShieldCheck,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';

// Standard Markdown/KaTeX Components
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export function AtlasWorkspace() {
  const [notes, setNotes] = useState<string>('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [lastArchivedContent, setLastArchivedContent] = useState<string>('');
  const [researchQuery, setResearchQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [smartLinks, setSmartLinks] = useState<{ phrase: string, insight: string }[]>([]);
  const [isEditing, setIsEditing] = useState(true);
  const [masteryScore, setMasteryScore] = useState(0);

  // Study Plan State
  const { session } = useAuth() as any;
  const [studyPlans, setStudyPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [showTodayMission, setShowTodayMission] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. DYNAMIC MASTERY CALCULATION
  useEffect(() => {
    const score = Math.min(100, Math.floor((notes.length / 500) * 10 + (flashcards.length * 5)));
    setMasteryScore(score);
  }, [notes, flashcards]);

  // 2. PROACTIVE NEURAL SCAN (Smart Links)
  useEffect(() => {
    const linkTimer = setTimeout(async () => {
      if (!notes.trim() || notes.length < 50 || !isEditing) return;

      try {
        const prompt = `Review the latest segment of my study notes: "${notes.slice(-400)}"
        1. Identify 2 core concepts.
        2. Provide a 1-sentence "Neural Insight" (intuition or shortcut) for each.
        Return as JSON array: [{"phrase": "concept", "insight": "insight text"}]`;

        const response = await OpenAIService.getInstance().generateChatCompletion(prompt, "Neural Analysis Engine.");
        const start = response.indexOf('[');
        const end = response.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          setSmartLinks(JSON.parse(response.slice(start, end + 1)));
        }
      } catch (e) { console.error("Link Error", e); }
    }, 12000);

    return () => clearTimeout(linkTimer);
  }, [notes, isEditing]);

  // 3. AUTO-ARCHIVE (Persistence)
  useEffect(() => {
    const archiveTimer = setTimeout(async () => {
      if (!notes.trim() || notes.length < 100 || notes === lastArchivedContent) return;
      await OpenAIService.getInstance().saveToKnowledgeBase(notes, 'journal');
      setLastArchivedContent(notes);
    }, 45000);
    return () => clearTimeout(archiveTimer);
  }, [notes, lastArchivedContent]);

  // 4. PERSISTENT STATE LOADING
  useEffect(() => {
    const savedNotes = localStorage.getItem('atlas_neural_journal');
    if (savedNotes) {
      setNotes(savedNotes);
      setLastArchivedContent(savedNotes);
    }
    const savedCards = localStorage.getItem('atlas_flashcards');
    if (savedCards) setFlashcards(JSON.parse(savedCards));
  }, []);

  // 5. FETCH STUDY PLANS
  useEffect(() => {
    const fetchPlans = async () => {
      if (!session?.user?.id) return;
      const { data, error } = await supabase
        .from('exam_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudyPlans(data);
        if (data.length > 0) {
          const saved = localStorage.getItem(`atlas_core_selected_plan_${session.user.id}`);
          if (saved && data.some(p => p.id === saved)) {
            setSelectedPlanId(saved);
          } else {
            setSelectedPlanId(data[0].id);
          }
        }
      }
    };
    fetchPlans();
  }, [session?.user?.id]);

  useEffect(() => {
    if (selectedPlanId && session?.user?.id) {
      localStorage.setItem(`atlas_core_selected_plan_${session.user.id}`, selectedPlanId);
    }
  }, [selectedPlanId, session?.user?.id]);

  const getTodayMission = () => {
    const plan = studyPlans.find(p => p.id === selectedPlanId);
    if (!plan) return null;

    let dayNumber = 1;
    if (plan.created_at) {
      const created = new Date(plan.created_at);
      dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }

    const schedule = plan.plan?.daily_schedule || [];
    const today = schedule.find((d: any) => d.day === dayNumber) || schedule[0];
    return { plan, today, dayNumber };
  };

  const missionData = getTodayMission();

  // Handlers
  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchQuery.trim()) return;
    setIsResearching(true);
    try {
      const result = await OpenAIService.getInstance().generateChatCompletion(`Synthesize research on: ${researchQuery}`, "Advanced Researcher.");
      await OpenAIService.getInstance().saveToKnowledgeBase(result, 'research');
      setNotes(prev => prev + `\n\n## 🔍 RESEARCH_SYNTHESIS: ${researchQuery.toUpperCase()}\n${result}`);
      setResearchQuery('');
      setIsEditing(false);
    } catch (e) { console.error(e); } finally { setIsResearching(false); }
  };

  const triggerAIAction = async (action: string) => {
    // Expand sidebar when action is triggered
    setSidebarWidth(700);
    setIsSidebarExpanded(true);

    const missionPrompt = missionData ? `I am currently working on **${missionData.today?.topic}** in my **${missionData.plan?.subject}** module. ` : '';
    const noteContext = notes ? `\n\nJOURNAL_CONTEXT:\n${notes.slice(-1000)}` : '';

    const prompts: any = {
      feynman: `${missionPrompt} ATLAS, let's do a Feynman study session on my notes. Ask me to explain the core concepts and identify my gaps. ${noteContext}`,
      video: `${missionPrompt} Generate a Manim scene script for this topic. Be very detailed with the animations and explanation. ${noteContext}`,
      problems: `${missionPrompt} Create 5 high-yield SAT/Competitive exam problems based on this topic. ${noteContext}`,
      curriculum: `ATLAS, show me the curriculum details and roadmap for my current subject: ${missionData?.plan?.subject || 'General'}. what should be my next steps?`
    };

    window.dispatchEvent(new CustomEvent('trigger-atlas-chat', {
      detail: {
        message: prompts[action],
        voice: action === 'feynman'
      }
    }));
  };

  return (
    <div className="h-screen bg-neo-bg flex flex-col font-sans text-black overflow-hidden p-2">
      {/* 5. REFACTORED SYSTEM HEADER */}
      <header className="flex items-center justify-between bg-black text-white p-3 border-b-2 border-neo-accent shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-neo-secondary p-1.5 rotate-2 border-2 border-white shadow-[1px_1px_0px_0px_#FFF]">
            <Brain className="h-5 w-5 text-black" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight uppercase italic leading-none">ATLAS_HOME_v5.0</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="h-2.5 w-2.5 text-neo-secondary" />
              <span className="text-[7px] font-bold tracking-widest text-white/60">SYSTEM_READY</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[7px] font-black text-white/40 uppercase">System_Mastery</span>
            <div className="w-24 h-1.5 bg-white/10 border border-white/20 rounded-full mt-0.5 overflow-hidden">
              <div className="h-full bg-neo-secondary transition-all duration-1000" style={{ width: `${masteryScore}%` }} />
            </div>
          </div>
          <button className="bg-neo-accent p-1.5 border-2 border-black shadow-[1px_1px_0px_0px_#000] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all">
            <Power className="h-3.5 w-3.5 stroke-[3px]" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-2 overflow-hidden">

        {/* LEFT COLUMN: NEURAL WORKSPACE */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">

          {/* TODAY'S MISSION CONTROL (Moved from sidebar) */}
          {missionData && (
            <div data-tour="atlas-today-panel" className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <div
                className="flex items-center justify-between p-3 bg-neo-bg border-b-2 border-black cursor-pointer hover:bg-neo-secondary transition-colors"
                onClick={() => setShowTodayMission(!showTodayMission)}
              >
                <div className="flex items-center gap-2">
                  <div className="bg-neo-accent p-1.5 border-2 border-black -rotate-6 shadow-[1px_1px_0px_0px_#000]">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tight italic">TODAY'S MISSION</h3>
                </div>
                {showTodayMission ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>

              {showTodayMission && (
                <div className="p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[8px] font-black uppercase text-black/40 mb-0.5 tracking-widest">CURRENT_MODULE</p>
                      <h2 className="text-lg font-black uppercase italic leading-none">{missionData.today?.topic || 'GENERAL STUDY'}</h2>
                      <p className="text-[10px] font-bold text-black/60 mt-1 line-clamp-2">{missionData.today?.description}</p>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <select
                          data-tour="atlas-plan-select"
                          value={selectedPlanId}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                          className="flex-1 bg-neo-bg border-2 border-black p-1.5 font-black text-[9px] uppercase focus:outline-none focus:shadow-[1.5px_1.5px_0px_0px_#000]"
                        >
                          {studyPlans.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.subject} - {p.class}</option>
                          ))}
                        </select>
                        <button
                          data-tour="atlas-quick-reschedule"
                          className="bg-neo-accent text-white border-2 border-black px-3 py-1.5 font-black text-[9px] uppercase shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                          onClick={() => {
                            // Trigger reschedule in AI Buddy via custom event
                            window.dispatchEvent(new CustomEvent('trigger-atlas-reschedule', { detail: selectedPlanId }));
                          }}
                        >
                          RESCHEDULE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTION STRIP */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { icon: MessageSquare, label: "FEYNMAN", action: "feynman", color: "bg-neo-secondary" },
              { icon: Video, label: "VIDEO_GEN", action: "video", color: "bg-neo-accent" },
              { icon: PenTool, label: "PROBLEM_SET", action: "problems", color: "bg-white" },
              { icon: BookOpen, label: "CURRICULUM", action: "curriculum", color: "bg-neo-muted" },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={() => triggerAIAction(btn.action)}
                className={`${btn.color} border-2 border-black px-3 py-1.5 flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all`}
              >
                <btn.icon className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* THE JOURNAL SURFACE */}
          <div className="flex-1 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden relative">
            <div className="bg-black text-white px-4 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-2.5 w-2.5 text-neo-secondary animate-pulse" />
                <span className="text-[9px] font-black tracking-widest uppercase">Live_Neural_Journal</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-2 py-0.5 text-[7px] font-black uppercase border-2 border-white shadow-[1px_1px_0px_0px_#FFF] active:shadow-none transition-all ${isEditing ? 'bg-neo-accent' : 'bg-neo-secondary'}`}
                >
                  {isEditing ? 'Run View' : 'Edit Source'}
                </button>
                <div className="flex items-center gap-1.5">
                  <Database className="h-2.5 w-2.5 text-white/40" />
                  <span className="text-[7px] font-bold text-white/50">{notes === lastArchivedContent ? 'SYNCED' : 'CACHED'}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] overflow-hidden">
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="absolute inset-0 w-full h-full p-6 font-mono text-xs focus:outline-none resize-none bg-transparent leading-relaxed text-black z-20"
                  placeholder="Neural session initialized. Feed the journal..."
                  spellCheck={false}
                />
              ) : (
                <div className="absolute inset-0 p-6 overflow-y-auto prose prose-neutral max-w-none z-10 select-text">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-3xl font-black uppercase mb-6 border-b-8 border-black pb-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-2xl font-black uppercase mb-4 bg-neo-secondary inline-block px-2 border-2 border-black shadow-[4px_4px_0px_0px_#000]" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-black text-neo-accent underline decoration-4 underline-offset-4" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-6 leading-relaxed font-bold text-lg" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc ml-8 mb-6 font-bold space-y-2" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal ml-8 mb-6 font-bold space-y-2" {...props} />,
                    }}
                  >
                    {notes || '*The journal is currently void of data.*'}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* GHOST INSIGHTS OVERLAY */}
            {isEditing && smartLinks.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4 flex gap-3 overflow-x-auto no-scrollbar z-30 pointer-events-none">
                {smartLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_#000] whitespace-nowrap animate-in slide-in-from-bottom-4 pointer-events-auto hover:-translate-y-1 transition-transform">
                    <Sparkles className="h-4 w-4 text-neo-accent animate-spin-slow" />
                    <div>
                      <p className="text-[8px] font-black uppercase text-black/40">{link.phrase}</p>
                      <p className="text-[10px] font-black leading-none">{link.insight}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* INTEGRATED RESEARCH CONSOLE */}
          <div className="bg-white border-2 border-black p-1.5 shadow-[4px_4px_0px_0px_#000] flex items-center gap-2">
            <div className="bg-neo-accent p-1.5 border-2 border-black">
              <Search className="h-3.5 w-3.5 text-white" />
            </div>
            <form onSubmit={handleResearch} className="flex-1 flex gap-2">
              <input
                data-tour="atlas-input"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                className="flex-1 font-black text-[10px] p-1.5 focus:outline-none placeholder:text-black/20"
                placeholder="SCAN NEURAL NET FOR TOPIC..."
              />
              <button
                type="submit"
                className="bg-black text-white px-4 py-1.5 text-[9px] font-black uppercase hover:bg-neo-secondary hover:text-black transition-all"
              >
                {isResearching ? 'SCANNING...' : 'EXECUTE_QUERY'}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: AI MENTOR (Dynamic Width) */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_#000] relative overflow-hidden flex flex-col transition-all duration-500 ease-in-out"
        >
          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => {
              const newWidth = sidebarWidth === 450 ? 750 : 450;
              setSidebarWidth(newWidth);
              setIsSidebarExpanded(newWidth > 450);
            }}
            className="absolute top-4 left-4 z-50 bg-black text-white p-1 border-2 border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neo-accent transition-colors"
          >
            {isSidebarExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <AIStudyBuddy
            title="ATLAS"
            subtitle="NEURAL_OS_PRO_v5.0"
            variant="mentor"
            storageNamespace="atlas_core"
            hideMissionControl={true}
          />
        </div>

      </div>
    </div>
  );
}
