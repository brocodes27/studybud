import React, { useState, useEffect, useRef } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { 
  Power, Brain, FileText, Zap, BrainCircuit, X, 
  Search, Command, MessageSquare, Video, 
  PenTool, Terminal, Save, BookOpen, Link, Sparkles,
  ChevronRight, Activity, Database, ShieldCheck
} from 'lucide-react';
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

export function RanjanSir() {
  const [notes, setNotes] = useState<string>('');
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isTutorAnalyzing, setIsTutorAnalyzing] = useState(false);
  const [tutorFeedback, setTutorFeedback] = useState<string | null>(null);
  const [lastArchivedContent, setLastArchivedContent] = useState<string>('');
  const [researchQuery, setResearchQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [smartLinks, setSmartLinks] = useState<{phrase: string, insight: string}[]>([]);
  const [isEditing, setIsEditing] = useState(true);
  const [masteryScore, setMasteryScore] = useState(0);
  
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
    const savedNotes = localStorage.getItem('ranjan_sir_journal');
    if (savedNotes) {
        setNotes(savedNotes);
        setLastArchivedContent(savedNotes);
    }
    const savedCards = localStorage.getItem('ranjan_sir_flashcards');
    if (savedCards) setFlashcards(JSON.parse(savedCards));
  }, []);

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
    setIsTutorAnalyzing(true);
    try {
        const prompts: any = {
            feynman: `Run Feynman check on these notes. Identify logical leaps: ${notes}`,
            video: `Generate a Manim scene script for this topic: ${notes}`,
            problems: `Create 5 high-yield exam problems based on: ${notes}`
        };
        const result = await OpenAIService.getInstance().generateChatCompletion(prompts[action], "Proactive Tutor Engine.");
        setNotes(prev => prev + `\n\n--- ⚡ ${action.toUpperCase()}_INSIGHT ---\n${result}`);
        setIsEditing(false);
    } catch (e) { console.error(e); } finally { setIsTutorAnalyzing(false); }
  };

  return (
    <div className="h-screen bg-neo-bg flex flex-col font-sans text-black overflow-hidden p-4">
      {/* 5. REFACTORED SYSTEM HEADER */}
      <header className="flex items-center justify-between bg-black text-white p-4 border-b-4 border-neo-accent shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-neo-secondary p-2 rotate-3 border-2 border-white shadow-[2px_2px_0px_0px_#FFF]">
            <Brain className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">RANJAN_SIR_OS_v4.0</h1>
            <div className="flex items-center gap-2 mt-1">
               <ShieldCheck className="h-3 w-3 text-neo-secondary" />
               <span className="text-[8px] font-bold tracking-widest text-white/60">NEURAL_ENCRYPTION_ACTIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[8px] font-black text-white/40 uppercase">System_Mastery</span>
            <div className="w-32 h-2 bg-white/10 border border-white/20 rounded-full mt-1 overflow-hidden">
               <div className="h-full bg-neo-secondary transition-all duration-1000" style={{ width: `${masteryScore}%` }} />
            </div>
          </div>
          <button className="bg-neo-accent p-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all">
            <Power className="h-4 w-4 stroke-[3px]" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-4 overflow-hidden">
        
        {/* LEFT COLUMN: NEURAL WORKSPACE */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* ACTION STRIP */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
              { icon: MessageSquare, label: "FEYNMAN", action: "feynman", color: "bg-neo-secondary" },
              { icon: Video, label: "VIDEO_GEN", action: "video", color: "bg-neo-accent" },
              { icon: PenTool, label: "PROBLEM_SET", action: "problems", color: "bg-white" },
              { icon: BookOpen, label: "CURRICULUM", action: "curriculum", color: "bg-neo-muted" },
            ].map(btn => (
              <button 
                key={btn.label}
                onClick={() => triggerAIAction(btn.action)}
                className={`${btn.color} border-4 border-black px-4 py-2 flex items-center gap-2 shadow-[4px_4px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all`}
              >
                <btn.icon className="h-4 w-4" />
                <span className="text-[10px] font-black">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* THE JOURNAL SURFACE */}
          <div className="flex-1 bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden relative">
            <div className="bg-black text-white px-6 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-3 w-3 text-neo-secondary animate-pulse" />
                <span className="text-[10px] font-black tracking-widest uppercase">Live_Neural_Journal</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-3 py-1 text-[8px] font-black uppercase border-2 border-white shadow-[2px_2px_0px_0px_#FFF] active:shadow-none transition-all ${isEditing ? 'bg-neo-accent' : 'bg-neo-secondary'}`}
                >
                  {isEditing ? 'Run View' : 'Edit Source'}
                </button>
                <div className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-white/40" />
                    <span className="text-[8px] font-bold text-white/50">{notes === lastArchivedContent ? 'SYNCED' : 'CACHED'}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] overflow-hidden">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="absolute inset-0 w-full h-full p-10 font-mono text-sm focus:outline-none resize-none bg-transparent leading-loose text-black z-20"
                        placeholder="Neural session initialized. Feed the journal..."
                        spellCheck={false}
                    />
                ) : (
                    <div className="absolute inset-0 p-10 overflow-y-auto prose prose-neutral max-w-none z-10 select-text">
                        <ReactMarkdown 
                            remarkPlugins={[remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                h1: ({node, ...props}) => <h1 className="text-3xl font-black uppercase mb-6 border-b-8 border-black pb-2" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-2xl font-black uppercase mb-4 bg-neo-secondary inline-block px-2 border-2 border-black shadow-[4px_4px_0px_0px_#000]" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-black text-neo-accent underline decoration-4 underline-offset-4" {...props} />,
                                p: ({node, ...props}) => <p className="mb-6 leading-relaxed font-bold text-lg" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc ml-8 mb-6 font-bold space-y-2" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal ml-8 mb-6 font-bold space-y-2" {...props} />,
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
          <div className="bg-white border-4 border-black p-2 shadow-[8px_8px_0px_0px_#000] flex items-center gap-3">
             <div className="bg-neo-accent p-2 border-2 border-black">
                <Search className="h-4 w-4 text-white" />
             </div>
             <form onSubmit={handleResearch} className="flex-1 flex gap-2">
                <input 
                   value={researchQuery}
                   onChange={(e) => setResearchQuery(e.target.value)}
                   className="flex-1 font-black text-xs p-2 focus:outline-none placeholder:text-black/20"
                   placeholder="SCAN NEURAL NET FOR TOPIC..."
                />
                <button 
                   type="submit"
                   className="bg-black text-white px-6 py-2 text-[10px] font-black uppercase hover:bg-neo-secondary hover:text-black transition-all"
                >
                   {isResearching ? 'SCANNING...' : 'EXECUTE_QUERY'}
                </button>
             </form>
          </div>
        </div>

        {/* RIGHT COLUMN: AI MENTOR (Always Present) */}
        <div className="w-[450px] bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000] relative overflow-hidden flex flex-col">
            <AIStudyBuddy
                title="RANJAN SIR"
                subtitle="NEURAL_OS_PRO_v4.0"
                variant="mentor"
                storageNamespace="ranjan_sir"
            />
        </div>

      </div>
    </div>
  );
}
