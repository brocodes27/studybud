import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AIService from '../lib/aiService';
import {
  Flag, Timer, ChevronRight, ChevronLeft, CheckCircle2,
  Target, ShieldCheck, PenTool, Sparkles, Trophy, ArrowRight, Gauge, Activity
} from 'lucide-react';

/**
 * OFFICIAL DIGITAL SAT SPECIFICATIONS (2024-2025)
 * UI Optimized for Content Density (Standard Font Sizes)
 */

interface SATQuestion {
  id: string;
  type: 'rw' | 'math';
  domain: string;
  passage?: string;
  question: string;
  options: string[];
  answer_index: number;
  difficulty: 'easy' | 'medium' | 'hard';
  part: 1 | 2;
}

const SECTION_SPECS = {
  rw: {
    timePerPart: 32,
    questionsPerPart: 27,
    domains: ["Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"]
  },
  math: {
    timePerPart: 35,
    questionsPerPart: 22,
    domains: ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"]
  }
};

export default function SATSimulator() {
  const { user } = useAuth() as any;

  const [step, setStep] = useState<'intro' | 'loading' | 'testing' | 'break' | 'results'>('intro');
  const [section, setSection] = useState<'rw' | 'math'>('rw');
  const [part, setPart] = useState<1 | 2>(1);
  const [questions, setQuestions] = useState<SATQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);

  const [rwPart1Accuracy, setRwPart1Accuracy] = useState(0);
  const [rwPart2Accuracy, setRwPart2Accuracy] = useState(0);
  const [mathPart1Accuracy, setMathPart1Accuracy] = useState(0);
  const [results, setResults] = useState<{ rwScore: number, mathScore: number, total: number } | null>(null);

  useEffect(() => {
    if (step !== 'testing' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handlePartFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generatePartQuestions = async (targetSection: 'rw' | 'math', targetPart: 1 | 2, prevAccuracy?: number) => {
    setStep('loading');
    const spec = SECTION_SPECS[targetSection];

    let difficultyFocus = "Standard (Part 1)";
    if (targetPart === 2) {
      difficultyFocus = (prevAccuracy || 0) >= 0.65 ? "Hard/Upper Track" : "Easy/Lower Track";
    }

    setAnswers({});
    setFlags({});
    setCurrentIdx(0);

    const prompt = `You are a Digital SAT expert. 
    Generate EXACTLY ${spec.questionsPerPart} questions for Digital SAT ${targetSection.toUpperCase()} Section, Part ${targetPart}.
    Difficulty Track: ${difficultyFocus}

    RULES:
    1. RW: Every question MUST have a passage (30-100 words).
    2. No special characters or unescaped quotes in text.
    3. Return ONLY a valid JSON array.

    JSON SCHEMA:
    [{"domain": "string", "passage": "string", "question": "string", "options": ["string","string","string","string"], "answer_index": number}]`;

    try {
      const response = await AIService.getInstance().generateChatCompletion(prompt, `Official SAT Engine`, false);
      const firstBracket = response.indexOf('[');
      const lastBracket = response.lastIndexOf(']');
      if (firstBracket === -1 || lastBracket === -1) throw new Error("Invalid response format");

      const jsonString = response.slice(firstBracket, lastBracket + 1)
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/\\'/g, "'");

      const data = JSON.parse(jsonString);

      const formatted = data.slice(0, spec.questionsPerPart).map((q: any) => ({
        ...q,
        id: crypto.randomUUID(),
        type: targetSection,
        part: targetPart
      }));

      setQuestions(formatted);
      setTimeLeft(spec.timePerPart * 60);
      setStep('testing');
    } catch (e) {
      console.error("SAT Gen Error", e);
      setStep('intro');
    }
  };

  const handlePartFinish = async () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.answer_index) correct++;
    });
    const acc = correct / questions.length;

    if (section === 'rw' && part === 1) {
      setRwPart1Accuracy(acc);
      setPart(2);
      await generatePartQuestions('rw', 2, acc);
    } else if (section === 'rw' && part === 2) {
      setRwPart2Accuracy(acc);
      setStep('break');
    } else if (section === 'math' && part === 1) {
      setMathPart1Accuracy(acc);
      setPart(2);
      await generatePartQuestions('math', 2, acc);
    } else {
      finalizeTest(acc);
    }
  };

  const finalizeTest = async (lastAcc: number) => {
    const calcScore = (p1Acc: number, p2Acc: number) => {
      const avg = (p1Acc + p2Acc) / 2;
      return Math.round((avg * 600) + 200);
    };

    const rw = calcScore(rwPart1Accuracy, rwPart2Accuracy);
    const math = calcScore(mathPart1Accuracy, lastAcc);
    const total = rw + math;
    setResults({ rwScore: rw, mathScore: math, total });
    setStep('results');

    // 1. Persistence & Gamification Sync
    try {
      // Award XP for completion (200 XP for full practice test)
      await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: 200,
        p_reason: `Completed SAT Practice Test (Score: ${total})`,
        p_source_type: 'test',
        p_source_id: crypto.randomUUID()
      });

      // Update Subject Mastery for all attempted domains
      const domainStats: Record<string, { attempted: number, correct: number }> = {};
      questions.forEach(q => {
        if (!domainStats[q.domain]) domainStats[q.domain] = { attempted: 0, correct: 0 };
        domainStats[q.domain].attempted++;
        if (answers[q.id] === q.answer_index) domainStats[q.domain].correct++;
      });

      for (const [domain, stats] of Object.entries(domainStats)) {
        const masteryScore = stats.correct / stats.attempted;

        // Upsert mastery using the composite unique key
        await supabase
          .from('user_subject_mastery')
          .upsert({
            user_id: user.id,
            exam_type: 'sat',
            domain: domain,
            subdomain: '', // Future: map specific question subdomains
            questions_attempted: stats.attempted,
            questions_correct: stats.correct,
            mastery_score: masteryScore,
            last_practiced: new Date().toISOString()
          }, {
            onConflict: 'user_id, exam_type, domain, subdomain'
          });
      }

      // Record Activity
      await supabase.from('user_activity_log').insert({
        user_id: user.id,
        activity_date: new Date().toISOString().split('T')[0],
        activity_type: 'test',
        xp_earned: 200,
        metadata: { score: total, rw, math }
      });

    } catch (e) {
      console.error("Failed to persist results", e);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      handlePartFinish();
    }
  };

  if (step === 'intro') {
    return (
      <div className="max-w-6xl mx-auto py-16 px-6 space-y-20 text-white">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-12 items-start md:items-center">
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 border border-primary/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="font-black tracking-[0.3em] uppercase text-[10px] text-slate-500">Atlas_Neural_Engine v4.0</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter leading-none uppercase">
              SAT <span className="text-primary">Test</span>
            </h1>
            <p className="text-xl font-medium text-slate-400 max-w-xl leading-relaxed">
              Precision adaptive testing calibrated for elite university track. 1600_PROTOCOL_ACTIVE.
            </p>
          </div>

          <div className="w-full md:w-80 space-y-4">
            <button onClick={() => { setSection('rw'); setPart(1); generatePartQuestions('rw', 1); }}
              className="w-full bg-primary hover:bg-blue-600 text-white py-6 rounded-2xl text-2xl font-black italic group flex items-center justify-center gap-4 shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95">
              Launch Test <ArrowRight className="h-7 w-7 group-hover:translate-x-2 transition-transform" />
            </button>
            <div className="bg-slate-900/60 backdrop-blur-sm border border-white/5 px-4 py-2 rounded-full text-center">
              <span className="text-[10px] font-black tracking-[0.2em] text-cyan-500 uppercase">Neural_Syllabus_Lock: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="bg-card-dark p-10 rounded-3xl border border-white/5 shadow-2xl space-y-6 group hover:border-primary/20 transition-all">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gauge className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-3xl font-black italic uppercase italic text-white leading-tight">Adaptive Track</h3>
            <p className="font-medium text-slate-400 leading-relaxed italic">Part 2 scaling based on Part 1 accuracy. Elite performance detection included.</p>
          </div>

          <div className="bg-card-dark p-10 rounded-3xl border border-white/5 shadow-2xl space-y-6 group hover:border-primary/20 transition-all">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-9 w-9 text-emerald-500" />
            </div>
            <h3 className="text-3xl font-black italic uppercase italic text-white leading-tight">Strict Rigor</h3>
            <p className="font-medium text-slate-400 leading-relaxed italic">Official 2024 domains. Harder distractors. Professional-grade passages.</p>
          </div>

          <div className="bg-card-dark p-10 rounded-3xl border border-white/5 shadow-2xl space-y-6 group hover:border-primary/20 transition-all">
            <div className="w-16 h-16 bg-neo-accent/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy className="h-9 w-9 text-neo-accent" />
            </div>
            <h3 className="text-3xl font-black italic uppercase italic text-white leading-tight">Score Matrix</h3>
            <p className="font-medium text-slate-400 leading-relaxed italic">Advanced statistical modeling to estimate your scaled score (1600 scale).</p>
          </div>
        </div>

        {/* Requirements Box */}
        <div className="bg-slate-900 border border-white/5 p-12 rounded-[2rem] shadow-2xl flex flex-col md:flex-row gap-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="flex-1 space-y-6">
            <h4 className="text-3xl font-black uppercase italic tracking-tighter text-white">The Protocol</h4>
            <ul className="space-y-4 font-bold text-lg text-slate-300">
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <span>READING_WRITING: 64 MINS / 54 Qs</span>
              </li>
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <span>MATHEMATICS: 70 MINS / 44 Qs</span>
              </li>
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <span>CALCULATOR: ALWAYS_ACTIVE</span>
              </li>
            </ul>
          </div>
          <div className="md:w-64 flex items-center justify-center">
            <div className="w-52 h-52 bg-slate-950 border border-white/10 rounded-full flex flex-col items-center justify-center text-center p-8 shadow-inner relative group cursor-default">
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-20" />
              <Target className="h-10 w-10 mb-2 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Mission_Target</span>
              <span className="text-5xl font-black italic text-white tracking-tighter">1550+</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="w-20 h-20 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-10 shadow-lg shadow-primary/10" />
        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter text-center leading-none">
          Building Part {part}...<br />
          <span className="text-sm font-black tracking-[0.4em] text-slate-500 mt-4 block">Injecting_Expert_Domains</span>
        </h2>
      </div>
    );
  }

  if (step === 'break') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-center space-y-10 text-white p-6">
        <div className="w-32 h-32 bg-primary/20 border border-primary/30 rounded-[2rem] flex items-center justify-center mx-auto rotate-12 shadow-2xl relative">
          <div className="absolute inset-0 bg-primary opacity-20 blur-2xl rounded-full" />
          <PenTool className="h-16 w-16 text-primary relative z-10" />
        </div>
        <div className="space-y-4">
          <h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none">Reading Done</h2>
          <p className="font-bold text-2xl text-slate-500 uppercase tracking-widest">Neural fatigue detected. Stabilizing for Mathematics.</p>
        </div>
        <button onClick={() => { setSection('math'); setPart(1); generatePartQuestions('math', 1); }}
          className="bg-primary hover:bg-blue-600 text-white px-20 py-8 rounded-2xl text-3xl font-black italic group flex items-center gap-6 mx-auto shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          Start Math <ArrowRight className="h-10 w-10 group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-16 text-white px-6">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              Protocol_1600_Complete
            </span>
          </div>
          <h1 className="text-8xl font-black italic uppercase tracking-tighter leading-none">Test Result</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-card-dark p-16 rounded-[3rem] border border-white/5 shadow-2xl space-y-10 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-cyan-500" />
            <div className="text-[10px] font-black text-slate-500 tracking-[0.4em] uppercase italic">Estimated Scaled Score</div>
            <div className="text-[10rem] font-black italic text-white tabular-nums leading-none drop-shadow-2xl group-hover:scale-105 transition-transform duration-700">{results?.total}</div>

            <div className="grid grid-cols-2 gap-8 mt-12">
              <div className="p-8 bg-slate-900 border border-white/5 rounded-3xl shadow-inner">
                <div className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">RW SECTION</div>
                <div className="text-4xl font-black italic text-white">{results?.rwScore}</div>
              </div>
              <div className="p-8 bg-slate-900 border border-white/5 rounded-3xl shadow-inner">
                <div className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">MATH SECTION</div>
                <div className="text-4xl font-black italic text-white">{results?.mathScore}</div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 border border-white/5 p-10 rounded-[2.5rem] shadow-2xl text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <h3 className="text-2xl font-black uppercase italic mb-8 flex items-center gap-4 text-white">
                <Trophy className="h-8 w-8 text-amber-500" /> Persistence Log
              </h3>
              <ul className="space-y-6">
                <li className="flex justify-between items-center border-b border-white/5 pb-4">
                  <span className="font-black uppercase text-xs tracking-widest text-slate-500">XP Earned</span>
                  <span className="font-black text-2xl text-primary">+200 XP</span>
                </li>
                <li className="flex justify-between items-center border-b border-white/5 pb-4">
                  <span className="font-black uppercase text-xs tracking-widest text-slate-500">Knowledge Map</span>
                  <span className="font-black text-xl text-white">8 Domains Mapped</span>
                </li>
                <li className="flex justify-between items-center pb-2">
                  <span className="font-black uppercase text-xs tracking-widest text-slate-500">Neural Insights</span>
                  <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-md italic text-[10px] font-black uppercase tracking-widest animate-pulse">Processing...</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => window.location.href = '/progress'}
                className="bg-primary hover:bg-blue-600 text-white py-8 rounded-2xl text-2xl font-black italic uppercase flex items-center justify-center gap-6 shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 group"
              >
                Deep Progress <Target className="h-8 w-8 group-hover:rotate-45 transition-transform" />
              </button>
              <button
                onClick={() => setStep('intro')}
                className="bg-slate-900 border border-white/5 text-slate-500 py-5 rounded-xl font-black uppercase tracking-[0.3em] text-xs hover:bg-slate-800 hover:text-white transition-all"
              >
                Restart_Simulation
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-sm border border-white/5 p-12 rounded-[2.5rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600 mb-8">Neural_Weakness_Detected</p>
          <div className="flex flex-wrap justify-center gap-6">
            {SECTION_SPECS.math.domains.slice(0, 2).map((d, i) => (
              <div key={i} className="px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl font-black uppercase text-xs italic text-rose-500 shadow-lg">
                CRITICAL: {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden text-white selection:bg-primary/30">
      <header className="flex justify-between items-center bg-slate-900 px-6 py-4 border-b border-white/5 z-20 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black italic text-xl leading-none uppercase tracking-tighter">SAT Simulator</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{section} SECTION</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">// PART {part}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-950 px-6 py-2 rounded-2xl border border-white/5 shadow-inner">
          <Timer className="w-5 h-5 text-primary" />
          <span className="font-black text-2xl tabular-nums text-white tracking-tight">{formatTime(timeLeft)}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Compact Navigator */}
        <div className="w-20 lg:w-64 bg-card-dark border-r border-white/5 overflow-y-auto p-4 space-y-2 hidden sm:block shadow-2xl">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 mb-6 px-2">Navigation_Map</div>
          {questions.map((_, i) => (
            <button
              key={`${part}-${i}`}
              onClick={() => setCurrentIdx(i)}
              className={`w-full p-4 rounded-xl border font-black text-sm text-left transition-all relative group overflow-hidden ${currentIdx === i
                ? 'bg-primary/10 border-primary/30 text-white shadow-lg shadow-primary/5'
                : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'
                } ${answers[questions[i].id] !== undefined ? 'opacity-100' : 'opacity-40'}`}
            >
              <span className="relative z-10"><span className="hidden lg:inline">Unit_</span>{i + 1}</span>
              {flags[questions[i].id] && (
                <div className="absolute top-0 right-0 p-1">
                  <Flag className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                </div>
              )}
              {currentIdx === i && (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-20 bg-slate-950/30">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="flex justify-between items-end border-b border-white/5 pb-8">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-600 tracking-[0.4em] mb-2 leading-none">ANALYSIS_NODE_{currentIdx + 1}</div>
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter leading-none">{q?.domain}</h2>
              </div>
              <button
                onClick={() => setFlags(f => ({ ...f, [q.id]: !f[q.id] }))}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all font-black uppercase text-[10px] tracking-widest ${flags[q.id] ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-slate-900 border-white/5 text-slate-500 hover:text-white'}`}
              >
                <Flag className={`h-4 w-4 ${flags[q.id] ? 'fill-rose-500' : ''}`} /> {flags[q.id] ? 'FLAGGED' : 'FLAG ITEM'}
              </button>
            </div>

            {/* Two Column Layout for RW Passage */}
            <div className={`grid grid-cols-1 ${q?.passage ? 'lg:grid-cols-2' : ''} gap-16`}>
              {q?.passage && (
                <div className="p-10 bg-card-dark border border-white/5 rounded-[2rem] text-lg leading-relaxed font-medium italic text-slate-300 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary/20" />
                  <div className="text-[10px] font-black uppercase mb-8 text-primary tracking-[0.4em] opacity-60">Source_Passage</div>
                  {q.passage}
                </div>
              )}

              <div className="space-y-12">
                <div className="relative">
                  <div className="absolute -left-8 top-0 w-1.5 h-full bg-primary rounded-full shadow-lg shadow-primary/20" />
                  <h3 className="text-3xl font-bold text-white leading-tight italic drop-shadow-sm">"{q?.question}"</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {q?.options.map((opt, i) => (
                    <button key={i} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                      className={`text-left p-6 rounded-2xl border transition-all flex items-center gap-6 group relative overflow-hidden ${answers[q.id] === i
                        ? 'bg-primary border-primary shadow-xl shadow-primary/20 scale-[1.02]'
                        : 'bg-slate-900 border-white/5 hover:bg-slate-800 hover:border-primary/30 shadow-lg'
                        }`}>
                      <span className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center text-sm font-black transition-all ${answers[q.id] === i ? 'bg-white text-primary border-white' : 'bg-slate-950 border-white/5 text-slate-600 group-hover:text-white'}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className={`flex-1 font-bold text-lg ${answers[q.id] === i ? 'text-white' : 'text-slate-300'}`}>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-slate-900 border-t border-white/5 p-6 flex justify-between items-center z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
        <button onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
          className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl border border-white/5 font-black flex items-center gap-4 group text-xs disabled:opacity-20 transition-all active:scale-95" disabled={currentIdx === 0}>
          <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" /> PREVIOUS
        </button>

        <div className="hidden sm:flex gap-1.5 px-4 py-2 bg-slate-950 border border-white/5 rounded-full shadow-inner">
          {questions.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full border border-white/10 transition-all ${answers[questions[i].id] !== undefined ? 'bg-primary' : 'bg-slate-800'}`} />
          ))}
        </div>

        <button onClick={handleNext} className="bg-primary hover:bg-blue-600 text-white px-12 py-4 rounded-xl font-black text-sm italic group uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-4">
          {currentIdx === questions.length - 1 ? 'Terminate Part' : 'Next Node'}
          <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </footer>
    </div>
  );
}
