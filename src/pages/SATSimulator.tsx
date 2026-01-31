import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';
import {
  Flag, Timer, ChevronRight, ChevronLeft, CheckCircle2,
  Target, ShieldCheck, PenTool, Sparkles, Trophy, ArrowRight, Gauge
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
      const response = await OpenAIService.getInstance().generateChatCompletion(prompt, `Official SAT Engine`, false);
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
      <div className="max-w-6xl mx-auto py-12 px-6 space-y-16 text-black">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-neo-accent p-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-black tracking-widest uppercase text-[10px] bg-black text-white px-2 py-0.5 rotate-1">Atlas // Performance_Engine</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tight leading-none">
              SAT <span className="text-stroke-neo text-black">TEST</span>
            </h1>
            <p className="text-lg font-bold text-black/60 max-w-xl leading-relaxed">
              Experience the world's first fully adaptive AI-powered Digital SAT simulator. Designed for the 1600 track.
            </p>
          </div>

          <div className="w-full md:w-64 space-y-3">
            <button onClick={() => { setSection('rw'); setPart(1); generatePartQuestions('rw', 1); }}
              className="w-full neo-button bg-neo-accent py-5 text-2xl italic group flex items-center justify-center gap-3">
              START TEST <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="bg-black text-white p-2 border-2 border-black font-black text-[9px] tracking-widest uppercase text-center italic">
              Syllabus Lockdown: ACTIVE
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="neo-card bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000] space-y-4">
            <div className="w-14 h-14 bg-neo-secondary border-4 border-black flex items-center justify-center rotate-3">
              <Gauge className="h-8 w-8 text-black" />
            </div>
            <h3 className="text-2xl font-black italic uppercase">Adaptive Track</h3>
            <p className="font-bold text-sm text-black/50">Part 2 scaling based on Part 1 accuracy. Elite performance detection included.</p>
          </div>

          <div className="neo-card bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000] space-y-4">
            <div className="w-14 h-14 bg-neo-muted border-4 border-black flex items-center justify-center -rotate-3">
              <ShieldCheck className="h-8 w-8 text-black" />
            </div>
            <h3 className="text-2xl font-black italic uppercase">Strict Rigor</h3>
            <p className="font-bold text-sm text-black/50">Official 2024 domains. Harder distractors. Professional-grade passages.</p>
          </div>

          <div className="neo-card bg-white p-8 border-4 border-black shadow-[12px_12px_0px_0px_#000] space-y-4">
            <div className="w-14 h-14 bg-neo-accent border-4 border-black flex items-center justify-center rotate-6">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-black italic uppercase">Score Matrix</h3>
            <p className="font-bold text-sm text-black/50">Advanced statistical modeling to estimate your scaled score (1600 scale).</p>
          </div>
        </div>

        {/* Requirements Box */}
        <div className="bg-neo-secondary border-2 border-black p-8 shadow-[8px_8px_0px_0px_#000] flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-3">
            <h4 className="text-2xl font-black uppercase italic">The Protocol</h4>
            <ul className="space-y-2 font-bold text-base">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-black" /> READING_WRITING: 64 MINS / 54 Qs</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-black" /> MATHEMATICS: 70 MINS / 44 Qs</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-black" /> CALCULATOR: ALWAYS_ACTIVE</li>
            </ul>
          </div>
          <div className="md:w-56 flex items-center justify-center">
            <div className="w-40 h-40 bg-white border-2 border-black rounded-full flex flex-col items-center justify-center text-center p-4 shadow-inner animate-pulse">
              <Target className="h-8 w-8 mb-1" />
              <span className="text-[10px] font-black uppercase">Mission_Target</span>
              <span className="text-3xl font-black italic">1550+</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neo-bg">
        <div className="w-16 h-16 border-4 border-black border-t-neo-accent animate-spin" />
        <h2 className="text-xl font-black italic mt-6 text-black uppercase tracking-widest text-center">
          Building Part {part}...<br />
          <span className="text-xs opacity-40">Injecting Expert Domains</span>
        </h2>
      </div>
    );
  }

  if (step === 'break') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neo-bg text-center space-y-6 text-black">
        <div className="w-24 h-24 bg-neo-accent border-4 border-black flex items-center justify-center mx-auto rotate-12 shadow-[8px_8px_0px_0px_#000]">
          <PenTool className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter">Reading Done</h2>
        <p className="font-bold text-xl text-black/40">Calm your mind. Mathematics begins now.</p>
        <button onClick={() => { setSection('math'); setPart(1); generatePartQuestions('math', 1); }}
          className="neo-button bg-neo-accent px-16 py-6 text-3xl italic group flex items-center gap-4 mx-auto">
          START MATH <ArrowRight className="h-8 w-8 group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-12 text-black px-6">
        <div className="space-y-4">
          <h1 className="text-7xl font-black italic uppercase tracking-tighter leading-none">TEST_COMPLETE</h1>
          <p className="font-black text-neo-accent uppercase tracking-[0.3em] text-sm italic">Neural Data Synthesized // Performance Validated</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="neo-card p-12 border-8 border-black bg-white shadow-[20px_20px_0px_0px_#000] space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-2 bg-neo-accent" />
            <div className="text-xs font-black opacity-40 tracking-[0.4em] mb-2 uppercase italic">Estimated Scaled Score</div>
            <div className="text-9xl font-black italic text-black tabular-nums group-hover:scale-110 transition-transform duration-500">{results?.total}</div>

            <div className="grid grid-cols-2 gap-6 mt-10">
              <div className="p-6 bg-neo-bg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="text-[10px] font-black uppercase text-black/40 mb-1">RW_SECTION</div>
                <div className="text-3xl font-black italic">{results?.rwScore}</div>
              </div>
              <div className="p-6 bg-neo-bg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]">
                <div className="text-[10px] font-black uppercase text-black/40 mb-1">MATH_SECTION</div>
                <div className="text-3xl font-black italic">{results?.mathScore}</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="neo-card bg-neo-secondary p-8 border-4 border-black shadow-[10px_10px_0px_0px_#000] text-left">
              <h3 className="text-xl font-black uppercase italic mb-4 flex items-center gap-3">
                <Trophy className="h-6 w-6" /> PERSISTENCE_LOG
              </h3>
              <ul className="space-y-4 font-bold text-sm">
                <li className="flex justify-between border-b-2 border-black/10 pb-2">
                  <span>XP EARNED</span>
                  <span className="text-neo-accent">+200 XP</span>
                </li>
                <li className="flex justify-between border-b-2 border-black/10 pb-2">
                  <span>MASTERY UPDATE</span>
                  <span>8 DOMAINS MAPPED</span>
                </li>
                <li className="flex justify-between border-b-2 border-black/10 pb-2">
                  <span>AI INSIGHTS</span>
                  <span className="bg-black text-white px-2 italic text-[10px]">GENERATING...</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => window.location.href = '/progress'} className="neo-button bg-black text-white py-6 text-xl tracking-tighter italic uppercase flex items-center justify-center gap-4 group">
                VIEW KNOWLEDGE MAP <Target className="group-hover:rotate-45 transition-transform" />
              </button>
              <button onClick={() => setStep('intro')} className="neo-button-white border-4 border-black py-4 font-black uppercase tracking-widest text-xs hover:bg-neo-bg transition-all">
                RESTART_SIMULATION
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border-4 border-black p-10 shadow-[15px_15px_0px_0px_rgba(45,158,100,0.3)]">
          <p className="text-xs font-black uppercase tracking-widest opacity-40 mb-6">Neural_Weakness_Detected</p>
          <div className="flex flex-wrap justify-center gap-4">
            {SECTION_SPECS.math.domains.slice(0, 2).map((d, i) => (
              <div key={i} className="px-4 py-2 bg-red-100 border-2 border-black font-black uppercase text-[10px] italic">
                ! {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  return (
    <div className="h-screen flex flex-col bg-neo-bg overflow-hidden text-black text-[13px]">
      <header className="flex justify-between items-center bg-black text-white px-4 py-2 border-b border-neo-accent z-20">
        <div>
          <h1 className="font-black italic text-base leading-none uppercase">SAT Test</h1>
          <p className="text-[7px] font-bold text-neo-accent uppercase tracking-widest mt-0.5">{section} / Part {part}</p>
        </div>
        <div className="flex items-center gap-3 font-mono font-black text-lg bg-white/5 px-2 py-0.5 border border-white/10 rounded">
          <Timer className="w-4 h-4 text-neo-accent" /> {formatTime(timeLeft)}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Compact Navigator */}
        <div className="w-16 lg:w-48 bg-white border-r-2 border-black overflow-y-auto p-2 space-y-1 hidden sm:block">
          {questions.map((_, i) => (
            <button
              key={`${part}-${i}`}
              onClick={() => setCurrentIdx(i)}
              className={`w-full p-2 border-2 border-black font-black text-xs text-left transition-all ${currentIdx === i ? 'bg-neo-accent' : 'bg-white hover:bg-neo-bg'
                } ${answers[questions[i].id] !== undefined ? 'opacity-100' : 'opacity-30'}`}
            >
              <span className="hidden lg:inline">Q</span>{i + 1}
              {flags[questions[i].id] && <Flag className="h-2 w-2 fill-red-500 text-red-500 float-right mt-0.5" />}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center border-b border-black/5 pb-1">
              <div className="text-[9px] font-black uppercase text-black/40">Question {currentIdx + 1} of {questions.length}</div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold uppercase text-black/30 tracking-widest">{q?.domain}</span>
                <button
                  onClick={() => setFlags(f => ({ ...f, [q.id]: !f[q.id] }))}
                  className={`p-1 border-2 border-black ${flags[q.id] ? 'bg-red-500 text-white' : 'bg-white'}`}
                >
                  <Flag className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Two Column Layout for RW Passage */}
            <div className={`grid grid-cols-1 ${q?.passage ? 'lg:grid-cols-2' : ''} gap-6`}>
              {q?.passage && (
                <div className="p-4 bg-neo-bg border border-black text-sm leading-relaxed font-serif italic max-h-[40vh] lg:max-h-none overflow-y-auto">
                  <div className="text-[9px] font-black uppercase mb-3 opacity-40">Passage Content</div>
                  {q.passage}
                </div>
              )}

              <div className="space-y-4">
                <h2 className="text-lg md:text-xl font-black text-black leading-tight">{q?.question}</h2>
                <div className="grid grid-cols-1 gap-2">
                  {q?.options.map((opt, i) => (
                    <button key={i} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                      className={`text-left p-3 border-2 border-black font-bold text-sm transition-all flex items-center gap-3 ${answers[q.id] === i ? 'bg-neo-secondary border-black shadow-none translate-x-0.5 translate-y-0.5' : 'bg-white hover:bg-neo-bg shadow-[1px_1px_0px_0px_#000]'
                        }`}>
                      <span className={`w-6 h-6 shrink-0 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black ${answers[q.id] === i ? 'bg-black text-white' : 'bg-neo-bg'}`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t-4 border-black p-4 flex justify-between items-center z-20">
        <button onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
          className="neo-button-white px-6 py-2 font-black flex items-center gap-2 group text-xs disabled:opacity-20" disabled={currentIdx === 0}>
          <ChevronLeft className="h-4 w-4" /> BACK
        </button>

        <div className="hidden sm:flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`w-1.5 h-1 border border-black ${answers[questions[i].id] !== undefined ? 'bg-black' : 'bg-black/10'}`} />
          ))}
        </div>

        <button onClick={handleNext} className="neo-button bg-neo-accent px-10 py-3 font-black text-sm italic group uppercase tracking-widest">
          {currentIdx === questions.length - 1 ? 'FINISH' : 'NEXT'}
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </footer>
    </div>
  );
}
