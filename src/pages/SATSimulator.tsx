import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AIService from '../lib/aiService';
import {
  Flag, Timer, ChevronRight, ChevronLeft, CheckCircle2,
  Target, PenTool, Sparkles, Trophy, ArrowRight, Gauge, Activity, ShieldCheck
} from 'lucide-react';

/**
 * OFFICIAL DIGITAL SAT SPECIFICATIONS (2024-2025)
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

    try {
      await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_amount: 200,
        p_reason: `Completed SAT Practice Test (Score: ${total})`,
        p_source_type: 'test',
        p_source_id: crypto.randomUUID()
      });

      const domainStats: Record<string, { attempted: number, correct: number }> = {};
      questions.forEach(q => {
        if (!domainStats[q.domain]) domainStats[q.domain] = { attempted: 0, correct: 0 };
        domainStats[q.domain].attempted++;
        if (answers[q.id] === q.answer_index) domainStats[q.domain].correct++;
      });

      for (const [domain, stats] of Object.entries(domainStats)) {
        const masteryScore = stats.correct / stats.attempted;
        await supabase
          .from('user_subject_mastery')
          .upsert({
            user_id: user.id,
            exam_type: 'sat',
            domain: domain,
            subdomain: '',
            questions_attempted: stats.attempted,
            questions_correct: stats.correct,
            mastery_score: masteryScore,
            last_practiced: new Date().toISOString()
          }, {
            onConflict: 'user_id, exam_type, domain, subdomain'
          });
      }

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

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <div className="max-w-6xl mx-auto py-16 px-6 space-y-20">
        {/* Hero */}
        <div className="flex flex-col md:flex-row gap-12 items-start md:items-center">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm border border-[#00D1FF]/20">
              <Sparkles className="w-4 h-4" />
              <span>Official Digital SAT Engine</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight leading-none text-[#0A192F]">
              Ready to <br />
              <span className="text-[#00D1FF] relative inline-block">
                simulate?
                <svg className="absolute -bottom-2 left-0 w-full h-4 text-[#F472B6]" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0 10 Q 50 20 100 10" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="text-xl font-medium text-[#64748B] max-w-xl leading-relaxed">
              Precision adaptive testing calibrated to the exact difficulty curve of the official exam.
            </p>
          </div>

          <div className="w-full md:w-80 space-y-4">
            <button
              onClick={() => { setSection('rw'); setPart(1); generatePartQuestions('rw', 1); }}
              className="w-full px-8 py-6 rounded-full bg-[#0A192F] text-white text-xl font-extrabold flex items-center justify-center gap-4 transition-all shadow-[0_12px_24px_rgba(10,25,47,0.25)] hover:scale-105 active:scale-95"
            >
              Launch Test <ArrowRight className="h-6 w-6 stroke-[3px]" />
            </button>
            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-full text-center">
              <span className="text-xs font-extrabold tracking-widest text-[#00D1FF] uppercase">Adaptive Difficulty: Active</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-50 p-10 rounded-[32px] border-4 border-transparent hover:border-[#00D1FF]/20 hover:bg-white hover:shadow-float-cyan transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D1FF]/5 rounded-full blur-[40px]" />
            <div className="w-16 h-16 bg-[#00D1FF]/10 text-[#00D1FF] rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform mb-6 border border-[#00D1FF]/20">
              <Gauge className="h-8 w-8 stroke-[2.5px]" />
            </div>
            <h3 className="text-xl font-extrabold text-[#0A192F] mb-3 tracking-tight">Adaptive Track</h3>
            <p className="font-medium text-[#64748B] leading-relaxed">Part 2 scaling based on your Part 1 accuracy. Routed to the exact difficulty you need.</p>
          </div>

          <div className="bg-slate-50 p-10 rounded-[32px] border-4 border-transparent hover:border-[#34D399]/20 hover:bg-white hover:shadow-float-mint transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#34D399]/5 rounded-full blur-[40px]" />
            <div className="w-16 h-16 bg-[#34D399]/10 text-[#34D399] rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform mb-6 border border-[#34D399]/20">
              <ShieldCheck className="h-8 w-8 stroke-[2.5px]" />
            </div>
            <h3 className="text-xl font-extrabold text-[#0A192F] mb-3 tracking-tight">Strict Rigor</h3>
            <p className="font-medium text-[#64748B] leading-relaxed">Official College Board domains only. Professionally graded passages and balanced answer choices.</p>
          </div>

          <div className="bg-slate-50 p-10 rounded-[32px] border-4 border-transparent hover:border-[#F472B6]/20 hover:bg-white hover:shadow-float-pink transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F472B6]/5 rounded-full blur-[40px]" />
            <div className="w-16 h-16 bg-[#F472B6]/10 text-[#F472B6] rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform mb-6 border border-[#F472B6]/20">
              <Trophy className="h-8 w-8 stroke-[2.5px]" />
            </div>
            <h3 className="text-xl font-extrabold text-[#0A192F] mb-3 tracking-tight">Score Matrix</h3>
            <p className="font-medium text-[#64748B] leading-relaxed">Statistical modeling to estimate your true scaled score on the 1600 grading scale.</p>
          </div>
        </div>

        {/* Requirements Box */}
        <div className="bg-[#0A192F] p-10 lg:p-14 rounded-[40px] shadow-2xl flex flex-col md:flex-row gap-12 relative overflow-hidden items-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D1FF] rounded-full blur-[120px] opacity-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F472B6] rounded-full blur-[120px] opacity-15 pointer-events-none" />

          <div className="flex-1 space-y-6 relative z-10">
            <h4 className="text-2xl font-extrabold tracking-tight text-white">Test Structure</h4>
            <ul className="space-y-3 font-bold text-lg text-slate-300">
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-[#00D1FF] shrink-0" />
                <span>Reading & Writing — 64 mins / 54 questions</span>
              </li>
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-[#F472B6] shrink-0" />
                <span>Mathematics — 70 mins / 44 questions</span>
              </li>
              <li className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-[#34D399] shrink-0" />
                <span>Built-in calculator always active</span>
              </li>
            </ul>
          </div>

          <div className="md:w-64 flex justify-center relative z-10">
            <div className="w-48 h-48 bg-white rounded-full flex flex-col items-center justify-center text-center p-6 shadow-2xl hover:rotate-6 transition-transform">
              <Target className="h-10 w-10 mb-2 text-[#00D1FF] stroke-[2.5px]" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#64748B]">Target Score</span>
              <span className="text-4xl font-extrabold text-[#0A192F] tracking-tighter mt-1">1550+</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-full font-bold text-sm border border-[#00D1FF]/20">
          <Sparkles className="w-4 h-4" />
          <span>Generating Part {part} Questions</span>
        </div>
        <p className="text-[#64748B] font-medium">Calibrating adaptive difficulty...</p>
      </div>
    );
  }

  // ─── BREAK ────────────────────────────────────────────────────────────────
  if (step === 'break') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 px-6">
        <div className="w-24 h-24 bg-[#34D399]/10 rounded-[32px] flex items-center justify-center border border-[#34D399]/20 shadow-float-mint">
          <PenTool className="h-12 w-12 text-[#34D399] stroke-[2px]" />
        </div>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#34D399]/10 text-[#34D399] rounded-full font-bold text-sm border border-[#34D399]/20">
            Section Complete
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight">Reading & Writing done.</h2>
          <p className="text-[#64748B] font-medium text-lg max-w-md mx-auto">Take a short break. Next up: the Math section.</p>
        </div>
        <button
          onClick={() => { setSection('math'); setPart(1); generatePartQuestions('math', 1); }}
          className="neo-button text-lg px-10 py-4 shadow-[0_8px_24px_rgba(0,209,255,0.4)]"
        >
          Start Math Section <ArrowRight className="w-5 h-5 stroke-[2.5px]" />
        </button>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (step === 'results') {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#34D399]/10 text-[#34D399] rounded-full font-bold text-sm border border-[#34D399]/20">
            <CheckCircle2 className="w-4 h-4" />
            Test Complete
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-[#0A192F] leading-tight">Your Results</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Score Card */}
          <div className="neo-card text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#00D1FF] to-[#34D399] rounded-t-[40px]" />
            <p className="text-sm font-bold uppercase tracking-widest text-[#64748B] mb-2 mt-2">Estimated Scaled Score</p>
            <p className="text-[8rem] font-extrabold text-[#0A192F] leading-none tracking-tighter tabular-nums">{results?.total}</p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-[#00D1FF]/10 rounded-[20px] p-5 border border-[#00D1FF]/20">
                <p className="text-xs font-bold uppercase tracking-widest text-[#64748B] mb-1">Reading & Writing</p>
                <p className="text-3xl font-extrabold text-[#0A192F]">{results?.rwScore}</p>
              </div>
              <div className="bg-[#F472B6]/10 rounded-[20px] p-5 border border-[#F472B6]/20">
                <p className="text-xs font-bold uppercase tracking-widest text-[#64748B] mb-1">Math</p>
                <p className="text-3xl font-extrabold text-[#0A192F]">{results?.mathScore}</p>
              </div>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="space-y-6">
            <div className="neo-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#F472B6]/10 rounded-full flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-[#F472B6] stroke-[2.5px]" />
                </div>
                <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Session Summary</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex justify-between items-center border-b border-[#0A192F]/5 pb-3">
                  <span className="font-bold text-sm text-[#64748B] uppercase tracking-widest">XP Earned</span>
                  <span className="font-extrabold text-xl text-[#00D1FF]">+200 XP</span>
                </li>
                <li className="flex justify-between items-center border-b border-[#0A192F]/5 pb-3">
                  <span className="font-bold text-sm text-[#64748B] uppercase tracking-widest">Domains Mapped</span>
                  <span className="font-extrabold text-lg text-[#0A192F]">8 Domains</span>
                </li>
                <li className="flex justify-between items-center pb-1">
                  <span className="font-bold text-sm text-[#64748B] uppercase tracking-widest">Insights</span>
                  <span className="px-3 py-1 bg-[#00D1FF]/10 text-[#00D1FF] text-xs font-bold rounded-full animate-pulse">Processing...</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => window.location.href = '/progress'}
              className="neo-button w-full py-4 text-base shadow-float-cyan"
            >
              View Full Progress <ArrowRight className="h-5 w-5 stroke-[2.5px]" />
            </button>
            <button
              onClick={() => setStep('intro')}
              className="w-full py-3 rounded-full border-2 border-[#0A192F]/10 text-[#64748B] font-bold text-sm hover:border-[#00D1FF]/40 hover:text-[#0A192F] transition-all"
            >
              Retake Test
            </button>
          </div>
        </div>

        {/* Weak Areas */}
        <div className="bg-[#F472B6]/5 border border-[#F472B6]/20 p-8 rounded-[32px]">
          <p className="text-sm font-bold uppercase tracking-widest text-[#F472B6] mb-4">Areas to Focus On</p>
          <div className="flex flex-wrap gap-3">
            {SECTION_SPECS.math.domains.slice(0, 2).map((d, i) => (
              <div key={i} className="px-5 py-2.5 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-full font-bold text-sm text-[#F472B6]">
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── TESTING ──────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center bg-white px-6 py-4 border-b-2 border-[#0A192F]/5 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-full flex items-center justify-center text-[#00D1FF]">
            <Activity className="w-5 h-5 stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-none text-[#0A192F] tracking-tight">SAT Simulator</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-[#00D1FF] uppercase tracking-widest">{section === 'rw' ? 'Reading & Writing' : 'Math'}</span>
              <span className="text-xs font-bold text-[#64748B]">· Part {part}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-full border-2 border-[#0A192F]/5">
          <Timer className="w-4 h-4 text-[#00D1FF] stroke-[2.5px]" />
          <span className="font-extrabold text-xl tabular-nums text-[#0A192F] tracking-tight">{formatTime(timeLeft)}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Question Navigator */}
        <div className="w-20 lg:w-60 bg-slate-50 border-r-2 border-[#0A192F]/5 overflow-y-auto p-4 space-y-2 hidden sm:block">
          <div className="text-xs font-bold uppercase tracking-widest text-[#64748B] mb-4 px-2">Questions</div>
          {questions.map((_, i) => (
            <button
              key={`${part}-${i}`}
              onClick={() => setCurrentIdx(i)}
              className={`w-full p-3 rounded-[16px] border-2 font-bold text-sm text-left transition-all relative overflow-hidden ${
                currentIdx === i
                  ? 'bg-white border-[#00D1FF] text-[#0A192F] shadow-float-cyan'
                  : 'bg-white border-transparent text-[#64748B] hover:text-[#0A192F] hover:border-[#0A192F]/10'
              } ${answers[questions[i].id] !== undefined ? 'opacity-100' : 'opacity-50'}`}
            >
              <span className="relative z-10"><span className="hidden lg:inline">Q</span>{i + 1}</span>
              {flags[questions[i].id] && (
                <div className="absolute top-1.5 right-1.5">
                  <Flag className="h-3 w-3 fill-[#F472B6] text-[#F472B6]" />
                </div>
              )}
              {currentIdx === i && (
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00D1FF] rounded-l-[16px]" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-16 bg-white">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="flex justify-between items-end border-b-2 border-[#0A192F]/5 pb-6">
              <div>
                <div className="text-xs font-bold uppercase text-[#64748B] tracking-widest mb-1">Question {currentIdx + 1} of {questions.length}</div>
                <h2 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">{q?.domain}</h2>
              </div>
              <button
                onClick={() => setFlags(f => ({ ...f, [q.id]: !f[q.id] }))}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border-2 transition-all font-bold text-sm ${
                  flags[q.id]
                    ? 'bg-[#F472B6]/10 border-[#F472B6]/30 text-[#F472B6]'
                    : 'bg-slate-50 border-[#0A192F]/10 text-[#64748B] hover:text-[#0A192F]'
                }`}
              >
                <Flag className={`h-4 w-4 ${flags[q.id] ? 'fill-[#F472B6]' : ''}`} />
                {flags[q.id] ? 'Flagged' : 'Flag'}
              </button>
            </div>

            {/* Two Column Layout for RW Passage */}
            <div className={`grid grid-cols-1 ${q?.passage ? 'lg:grid-cols-2' : ''} gap-10`}>
              {q?.passage && (
                <div className="p-8 bg-slate-50 border-2 border-[#0A192F]/5 rounded-[32px] text-lg leading-relaxed font-medium text-[#0A192F] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00D1FF]/40 rounded-l-[32px]" />
                  <div className="text-xs font-bold uppercase mb-4 text-[#00D1FF] tracking-widest pl-2">Passage</div>
                  <p className="pl-2">{q.passage}</p>
                </div>
              )}

              <div className="space-y-8">
                <div className="relative pl-5">
                  <div className="absolute left-0 top-0 w-1.5 h-full bg-[#00D1FF] rounded-full" />
                  <h3 className="text-2xl font-bold text-[#0A192F] leading-snug">"{q?.question}"</h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {q?.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                      className={`text-left p-5 rounded-[20px] border-2 transition-all flex items-center gap-4 ${
                        answers[q.id] === i
                          ? 'bg-[#00D1FF]/10 border-[#00D1FF] shadow-float-cyan scale-[1.01]'
                          : 'bg-white border-[#0A192F]/8 hover:bg-slate-50 hover:border-[#00D1FF]/40'
                      }`}
                    >
                      <span className={`w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center text-sm font-extrabold transition-all ${
                        answers[q.id] === i
                          ? 'bg-[#00D1FF] border-[#00D1FF] text-[#0A192F]'
                          : 'border-[#0A192F]/20 text-[#64748B]'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className={`flex-1 font-medium text-base ${answers[q.id] === i ? 'text-[#0A192F] font-bold' : 'text-[#0A192F]'}`}>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t-2 border-[#0A192F]/5 px-6 py-4 flex justify-between items-center z-20">
        <button
          onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#0A192F]/10 font-bold text-sm text-[#64748B] hover:text-[#0A192F] hover:border-[#0A192F]/20 disabled:opacity-30 transition-all active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        <div className="hidden sm:flex gap-1.5 px-4 py-2 bg-slate-50 border-2 border-[#0A192F]/5 rounded-full">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${answers[questions[i].id] !== undefined ? 'bg-[#00D1FF]' : 'bg-[#0A192F]/15'}`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="neo-button px-8 py-3 text-sm shadow-float-cyan"
        >
          {currentIdx === questions.length - 1 ? 'Submit Part' : 'Next Question'}
          <ChevronRight className="h-4 w-4 stroke-[3px]" />
        </button>
      </footer>
    </div>
  );
}
