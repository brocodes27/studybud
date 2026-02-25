import { useState, useEffect } from 'react';
import { Target, ArrowRight, CheckCircle, XCircle, Award, Sparkles, Brain, Zap, Clock, ShieldCheck, Database, Layout, Power } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import AIService from '../lib/aiService';

interface Question {
    id: string;
    qid?: string;
    pool_id?: string | null;
    question: string;
    options: string[] | null;
    correct_index: number | null;
    qtype: 'mcq' | 'short' | 'long';
    difficulty: 'Easy' | 'Medium' | 'Hard' | string;
    explanation?: string;
    answer_text?: string;
    chapter?: string;
    subject: string;
    class_level: string;
    embedding?: any;
}

const DIFFICULTY_LABELS: Record<string, string> = {
    'easy': 'Beginner',
    'medium': 'Advanced',
    'hard': 'Expert'
};

export function Progresser() {
    const { showToast } = useToast();
    const [step, setStep] = useState<'setup' | 'practicing' | 'summary'>('setup');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState<string>('');
    const [availableChapters, setAvailableChapters] = useState<string[]>([]);
    const [availableDifficulties, setAvailableDifficulties] = useState<string[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(0);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [userAnswer, setUserAnswer] = useState<string | number>('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionTime, setSessionTime] = useState(0);
    const [stats, setStats] = useState({
        correct: 0,
        total: 0,
        consecutiveCorrect: 0,
    });
    const [isVariant, setIsVariant] = useState(false);
    const [variantQuestion, setVariantQuestion] = useState<string | null>(null);
    const [stepByStepExplanation, setStepByStepExplanation] = useState<string | null>(null);

    const subjects = {
        '10': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
        '12': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Computer Science']
    };

    // Timer logic
    useEffect(() => {
        let interval: any;
        if (step === 'practicing') {
            interval = setInterval(() => setSessionTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step]);

    useEffect(() => {
        if (selectedClass && selectedSubject) {
            fetchChapters();
        }
    }, [selectedClass, selectedSubject]);

    useEffect(() => {
        if (selectedChapter) {
            fetchAvailableDifficulties();
        }
    }, [selectedChapter]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const fetchChapters = async () => {
        try {
            const { data, error } = await supabase
                .from('question_bank')
                .select('chapter')
                .eq('class_level', selectedClass)
                .eq('subject', selectedSubject)
                .not('chapter', 'is', null);

            if (error) throw error;
            const uniqueChapters = Array.from(new Set(data.map(item => item.chapter as string))).sort();
            setAvailableChapters(uniqueChapters);
        } catch (err) {
            console.error('Error fetching chapters:', err);
        }
    };

    const fetchAvailableDifficulties = async () => {
        try {
            const { data, error } = await supabase
                .from('question_bank')
                .select('difficulty')
                .eq('class_level', selectedClass)
                .eq('subject', selectedSubject)
                .eq('chapter', selectedChapter)
                .not('difficulty', 'is', null);

            if (error) throw error;
            const difficulties = Array.from(new Set(data.map(item => item.difficulty as string)));
            const sorted = difficulties.sort((a, b) => {
                const order = { 'easy': 0, 'medium': 1, 'hard': 2 };
                return (order[a as keyof typeof order] || 999) - (order[b as keyof typeof order] || 999);
            });
            setAvailableDifficulties(sorted);
        } catch (err) {
            console.error('Error fetching difficulties:', err);
        }
    };

    const handleStart = () => {
        if (!selectedClass || !selectedSubject || !selectedChapter) {
            showToast('Please select class, subject and chapter', 'error');
            return;
        }
        setStep('practicing');
        setSessionTime(0);
        setCurrentLevel(0);
        fetchNextQuestion(0);
    };

    const fetchNextQuestion = async (levelIdx: number, retryCount = 0) => {
        setIsLoading(true);
        setIsVariant(false);
        setVariantQuestion(null);
        setShowFeedback(false);
        setUserAnswer('');
        setIsCorrect(null);

        if (availableDifficulties.length === 0) {
            showToast('No difficulty levels found', 'error');
            setIsLoading(false);
            setStep('setup');
            return;
        }

        const clampedIdx = Math.max(0, Math.min(levelIdx, availableDifficulties.length - 1));
        const difficulty = availableDifficulties[clampedIdx];

        try {
            // Neural Context Bridge: Get relevant previous notes for this chapter
            const context = await AIService.getInstance().findRelevantKnowledge(selectedChapter);

            const { data: references, error } = await supabase
                .from('question_bank')
                .select('*')
                .eq('class_level', selectedClass)
                .eq('subject', selectedSubject)
                .eq('chapter', selectedChapter)
                .eq('difficulty', difficulty)
                .limit(3);

            if (error) throw error;

            const prompt = `You are a high-level educational engine for Class ${selectedClass} ${selectedSubject}.
            Generate ONE ${difficulty} level question for "${selectedChapter}".
            
            STUDENT NEURAL CONTEXT:
            ${context || "No prior notes found."}
            
            STYLE GUIDE:
            ${references?.map(r => `- ${r.question}`).join('\n')}
            
            Return JSON: {"question": "...", "qtype": "mcq", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "..."}`;

            const response = await AIService.getInstance().generateChatCompletion(prompt, "Adaptive Progressor Engine.");
            const match = response.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("Invalid Engine Response");

            const generated = JSON.parse(match[0]);

            setCurrentQuestion({
                id: `neural-${Date.now()}`,
                ...generated,
                class_level: selectedClass,
                subject: selectedSubject,
                chapter: selectedChapter,
                difficulty: difficulty
            });
            setCurrentLevel(clampedIdx);
        } catch (err: any) {
            console.error('Progresser Error:', err);
            showToast('Neural link interrupted. Retrying...', 'info');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckAnswer = async () => {
        if (!currentQuestion) return;
        setIsLoading(true);

        let correct = false;
        try {
            if (currentQuestion.qtype === 'mcq' && !isVariant) {
                correct = Number(userAnswer) === currentQuestion.correct_index;
            } else {
                const evalPrompt = `Evaluate this student's answer for accuracy.
                Question: ${isVariant ? variantQuestion : currentQuestion.question}
                Expected Concept: ${currentQuestion.answer_text || currentQuestion.explanation}
                Answer: ${userAnswer}
                
                Return JSON: {"is_correct": boolean, "feedback": "..."}`;
                const evalRes = await AIService.getInstance().generateChatCompletion(evalPrompt, "Evaluator Mode");
                const match = evalRes.match(/\{[\s\S]*\}/);
                correct = JSON.parse(match ? match[0] : '{"is_correct": false}').is_correct;
            }

            if (!correct) {
                const explPrompt = `Explain why the student is wrong and provide a step-by-step solution. Use LaTeX.
                Question: ${currentQuestion.question}
                Answer: ${userAnswer}`;
                const expl = await AIService.getInstance().generateChatCompletion(explPrompt, "Teacher Mode");
                setStepByStepExplanation(expl);
            }

            setIsCorrect(correct);
            setShowFeedback(true);
            setStats(prev => ({
                ...prev,
                total: prev.total + 1,
                correct: prev.correct + (correct ? 1 : 0),
                consecutiveCorrect: correct ? prev.consecutiveCorrect + 1 : 0
            }));

            // Auto-archive the mistake to neural memory
            if (!correct) {
                await AIService.getInstance().saveToKnowledgeBase(`Struggled with ${selectedChapter} concept: ${currentQuestion.question}`, 'chat');
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (isCorrect) {
            if (stats.consecutiveCorrect >= 2 && currentLevel < availableDifficulties.length - 1) {
                fetchNextQuestion(currentLevel + 1);
                showToast("Rank UP!", "success");
            } else {
                fetchNextQuestion(currentLevel);
            }
        } else {
            if (currentLevel > 0) {
                fetchNextQuestion(currentLevel - 1);
            } else {
                generateEasierVariant();
            }
        }
    };

    const generateEasierVariant = async () => {
        setIsLoading(true);
        try {
            const res = await AIService.getInstance().generateChatCompletion(`Simplify this question for a struggling student: ${currentQuestion?.question}`, "Building Block Mode");
            setVariantQuestion(res);
            setIsVariant(true);
            setShowFeedback(false);
            setUserAnswer('');
            setIsCorrect(null);
        } catch (e) { fetchNextQuestion(0); } finally { setIsLoading(false); }
    };

    const renderMath = (text: string) => {
        const parts = text.split(/(\$[^$]+\$)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('$') && part.endsWith('$')) {
                return <InlineMath key={idx} math={part.slice(1, -1)} />;
            }
            return <span key={idx}>{part}</span>;
        });
    };

    if (step === 'setup') {
        return (
            <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center space-y-12">
                <div className="max-w-4xl w-full bg-slate-800 border border-white/10 shadow-neo p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-neo-accent p-4 border-l-8 border-b-8 border-white/10">
                        <Zap className="h-10 w-10 text-white animate-pulse" />
                    </div>

                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-slate-900 p-5 rotate-2 shadow-neo border border-[#2D9E64]">
                            <Brain className="h-12 w-12 text-white" />
                        </div>
                        <div>
                            <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-none">PROGRESSER</h1>
                            <p className="text-neo-accent font-black uppercase tracking-[0.3em] text-sm mt-2">Neural Adaptive Training</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase text-slate-100/40">PHASE_01: TARGET_CLASS</label>
                            <div className="flex gap-4">
                                {['10', '12'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { setSelectedClass(c); setSelectedSubject(''); }}
                                        className={`flex-1 py-6 border border-white/10 font-black text-4xl transition-all ${selectedClass === c ? 'bg-slate-900 text-white shadow-neo' : 'bg-slate-800 hover:bg-slate-900'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedClass && (
                            <div className="space-y-4 animate-in slide-in-from-right duration-300">
                                <label className="text-xs font-black uppercase text-slate-100/40">PHASE_02: SUBJECT_SCAN</label>
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full p-6 border border-white/10 font-black uppercase text-xl focus:outline-none bg-slate-800 shadow-neo"
                                >
                                    <option value="">-- INITIALIZE --</option>
                                    {subjects[selectedClass as keyof typeof subjects].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {selectedSubject && (
                        <div className="mt-10 space-y-4 animate-in fade-in duration-500">
                            <label className="text-xs font-black uppercase text-slate-100/40">PHASE_03: CHAPTER_SELECT</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {availableChapters.map(chap => (
                                    <button
                                        key={chap}
                                        onClick={() => setSelectedChapter(chap)}
                                        className={`p-4 border border-white/10 font-bold text-xs uppercase text-left transition-all ${selectedChapter === chap ? 'bg-neo-secondary shadow-neo' : 'bg-gray-50 hover:bg-slate-800'}`}
                                    >
                                        {chap}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-16">
                        <button
                            onClick={handleStart}
                            disabled={!selectedChapter}
                            className="w-full group flex items-center justify-between bg-slate-900 text-white px-10 py-8 border border-white/10 font-black text-3xl uppercase tracking-tighter hover:bg-[#2D9E64] hover:text-slate-100 transition-all shadow-neo disabled:opacity-20"
                        >
                            START NEURAL SESSION
                            <ArrowRight className="h-10 w-10 group-hover:translate-x-3 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-800 flex flex-col font-sans">
            {/* HUD */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b-8 border-neo-accent sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">MODULE_ACTIVE</span>
                        <span className="text-2xl font-black tracking-tighter uppercase italic leading-none">{selectedSubject}: {selectedChapter}</span>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-800/10" />
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">CURRENT_BIAS</span>
                            <div className="px-3 py-0.5 bg-neo-secondary text-slate-100 text-[10px] font-black rounded-sm border border-white">
                                {availableDifficulties[currentLevel] ? DIFFICULTY_LABELS[availableDifficulties[currentLevel]] : 'SYNCHRONIZING'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-10">
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">SESSION_TIME</span>
                        <div className="flex items-center gap-2 text-xl font-mono font-black">
                            <Clock className="h-4 w-4 text-neo-accent" />
                            {formatTime(sessionTime)}
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">NEURAL_STREAK</span>
                        <div className="flex items-center gap-2 text-2xl font-black text-neo-secondary italic">
                            {stats.consecutiveCorrect} <Award className="h-6 w-6" />
                        </div>
                    </div>
                    <button onClick={() => setStep('setup')} className="bg-slate-800/10 p-3 hover:bg-red-500 transition-colors border border-white/20">
                        <Power className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <main className="flex-1 max-w-5xl mx-auto w-full py-16 px-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-pulse">
                        <div className="relative">
                            <Database className="h-20 w-20 text-neo-accent" />
                            <Zap className="h-10 w-10 text-slate-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="font-black uppercase tracking-[0.4em] italic text-xl">REROUTING_NEURAL_PATHWAY...</p>
                    </div>
                ) : currentQuestion && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* THE QUESTION BOX */}
                        <div className="bg-slate-800 border border-white/10 shadow-neo p-12 relative overflow-hidden">
                            <div className="absolute top-0 left-0 bg-slate-900 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest">
                                Neural Challenge #{stats.total + 1}
                            </div>
                            <div className="text-3xl font-bold leading-relaxed text-slate-100">
                                {isVariant ? renderMath(variantQuestion || '') : renderMath(currentQuestion.question)}
                            </div>
                        </div>

                        {/* INPUTS */}
                        <div className="space-y-6">
                            {currentQuestion.qtype === 'mcq' && !isVariant ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(currentQuestion.options || []).map((opt, idx) => (
                                        <button
                                            key={idx}
                                            disabled={showFeedback}
                                            onClick={() => setUserAnswer(idx)}
                                            className={`p-8 border border-white/10 text-left font-black text-xl transition-all shadow-neo active:shadow-none hover:-translate-y-1 ${userAnswer === idx ? 'bg-slate-900 text-white' : 'bg-slate-800 hover:bg-slate-900'} ${showFeedback && idx === currentQuestion.correct_index ? 'bg-[#2D9E64] text-white border-white/10' : ''} ${showFeedback && userAnswer === idx && idx !== currentQuestion.correct_index ? 'bg-red-500 text-white' : ''}`}
                                        >
                                            <span className="text-neo-accent mr-4 italic">0{idx + 1}.</span>
                                            {renderMath(opt)}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        disabled={showFeedback}
                                        value={userAnswer as string}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        placeholder="EXPLAIN YOUR THOUGHT PROCESS..."
                                        className="w-full p-10 border border-white/10 bg-slate-900 shadow-neo font-bold text-2xl min-h-[250px] focus:outline-none focus:bg-slate-800 transition-colors"
                                    />
                                </div>
                            )}

                            {!showFeedback && (
                                <button
                                    onClick={handleCheckAnswer}
                                    disabled={userAnswer === ''}
                                    className="w-full bg-neo-accent text-slate-100 py-8 border border-white/10 font-black text-3xl uppercase tracking-tighter shadow-neo hover:translate-y-[-4px] active:shadow-none transition-all disabled:opacity-20"
                                >
                                    EVALUATE_ANSWER
                                </button>
                            )}
                        </div>

                        {/* FEEDBACK OVERLAY */}
                        {showFeedback && (
                            <div className={`p-12 border border-white/10 shadow-neo animate-in zoom-in-95 duration-300 ${isCorrect ? 'bg-neo-secondary' : 'bg-red-50'}`}>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-6">
                                        {isCorrect ? <CheckCircle className="h-16 w-16 text-green-700" /> : <XCircle className="h-16 w-16 text-red-700" />}
                                        <h3 className="text-5xl font-black uppercase italic tracking-tighter leading-none">
                                            {isCorrect ? 'NEURAL_MATCH!' : 'SYSTEM_ERROR'}
                                        </h3>
                                    </div>
                                    <div className="text-2xl font-black italic text-slate-100/20">#{stats.total}</div>
                                </div>

                                <div className="text-2xl font-bold mb-10 leading-snug border-l-8 border-white/10 pl-8">
                                    {renderMath(currentQuestion.explanation || "Correct interpretation. Concepts verified.")}
                                </div>

                                {!isCorrect && stepByStepExplanation && (
                                    <div className="mb-10 p-8 bg-slate-800 border border-white/10 shadow-neo prose prose-xl max-w-none">
                                        <h4 className="text-xl font-black uppercase mb-6 flex items-center gap-3">
                                            <ShieldCheck className="h-6 w-6 text-neo-accent" />
                                            NEURAL_RECOVERY_PROTOCOL
                                        </h4>
                                        <div className="font-bold space-y-4">
                                            {stepByStepExplanation.split('\n').map((l, i) => <p key={i}>{renderMath(l)}</p>)}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleNext}
                                    className="w-full bg-slate-900 text-white py-8 px-8 border border-white/10 font-black text-4xl uppercase tracking-tighter shadow-neo hover:bg-neo-accent hover:text-slate-100 transition-all flex items-center justify-center gap-6 group"
                                >
                                    {isCorrect ? 'EVOLVE_SYSTEM' : 'INITIATE_RETRY'}
                                    <ArrowRight className="h-12 w-12 group-hover:translate-x-4 transition-transform" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* PROGRESS TRACKER HUD (BOTTOM) */}
            <footer className="fixed bottom-0 inset-x-0 bg-slate-800 border-t-8 border-white/10 p-4 flex justify-center gap-3">
                {availableDifficulties.map((lev, idx) => (
                    <div
                        key={lev}
                        className={`h-4 flex-1 max-w-[200px] border border-white/10 transition-all duration-500 ${idx <= currentLevel ? (idx === 0 ? 'bg-neo-secondary' : idx === 1 ? 'bg-neo-accent' : 'bg-neo-muted') : 'bg-slate-900/50'}`}
                    >
                        <div className="h-full w-full relative group">
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {lev.toUpperCase()}
                            </span>
                        </div>
                    </div>
                ))}
            </footer>
        </div>
    );
}
