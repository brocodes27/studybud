import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flame, Trophy, Zap, Check, X, ArrowRight,
    Brain, Target, Sparkles, LayoutDashboard,
    FileUp, Globe, Youtube, Monitor, List,
    ChevronRight, AlertCircle, Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AIService from '../../lib/aiService';
import {
    getUserGamification,
    recordDailyCheckin,
    calculateLevel,
    type Achievement
} from '../../lib/gamification';
import { MasteryHeatmap } from '../MasteryHeatmap';

interface DailyQuestion {
    id: string;
    domain: string;
    subdomain: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

interface CheckinState {
    hasCheckedIn: boolean;
    streak: number;
    totalXp: number;
    level: number;
}

export function DailyCheckin() {
    const { user } = useAuth() as any;
    const navigate = useNavigate();
    const [state, setState] = useState<'loading' | 'question' | 'result' | 'mission'>('loading');
    const [question, setQuestion] = useState<DailyQuestion | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [checkinResult, setCheckinResult] = useState<{
        xpEarned: number;
        streak: number;
        streakBonus: number;
        totalXp: number;
        levelUp: boolean;
        newLevel?: number;
        achievements: Achievement[];
    } | null>(null);
    const [checkinState, setCheckinState] = useState<CheckinState>({
        hasCheckedIn: false,
        streak: 0,
        totalXp: 0,
        level: 1,
    });
    const [todayMission, setTodayMission] = useState<any>(null);
    const [logicGaps, setLogicGaps] = useState<any[]>([]);

    // Load initial state
    useEffect(() => {
        if (user?.id) {
            loadCheckinState();
            loadLogicGaps();
        }
    }, [user?.id]);

    const loadCheckinState = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Check if already checked in today
            const { data: existingCheckin } = await supabase
                .from('daily_checkins')
                .select('*')
                .eq('user_id', user.id)
                .eq('checkin_date', today)
                .maybeSingle();

            // Get gamification state
            const gamification = await getUserGamification(user.id);

            // Get today's mission (from exam_plans)
            const { data: plans } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (plans && plans.length > 0) {
                const plan = plans[0];
                const created = new Date(plan.created_at);
                const dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const schedule = plan.plan?.daily_schedule || [];
                const todayTask = schedule.find((d: any) => d.day === dayNumber) || schedule[0];
                setTodayMission({ plan, task: todayTask, dayNumber });
            }

            if (existingCheckin) {
                setCheckinState({
                    hasCheckedIn: true,
                    streak: gamification?.current_streak || 0,
                    totalXp: gamification?.total_xp || 0,
                    level: gamification?.current_level || 1,
                });
                setState('mission');
            } else {
                setCheckinState({
                    hasCheckedIn: false,
                    streak: gamification?.current_streak || 0,
                    totalXp: gamification?.total_xp || 0,
                    level: gamification?.current_level || 1,
                });
                await generateDailyQuestion();
                setState('question');
            }
        } catch (error) {
            console.error('Error loading checkin state:', error);
            setState('mission');
        }
    };

    const loadLogicGaps = async () => {
        try {
            const { data: mastery } = await supabase
                .from('user_subject_mastery')
                .select('*')
                .eq('user_id', user.id)
                .lt('mastery_score', 60)
                .order('mastery_score', { ascending: true })
                .limit(3);
            setLogicGaps(mastery || []);
        } catch (error) {
            console.error('Error loading logic gaps:', error);
        }
    };

    const generateDailyQuestion = async () => {
        try {
            // 1. Get user's study goals
            const { data: goalsList } = await supabase
                .from('user_study_goals')
                .select('*')
                .eq('user_id', user.id)
                .limit(1);

            const goals = goalsList?.[0];

            // 2. Get user's weakest domain from mastery data
            const { data: mastery } = await supabase
                .from('user_subject_mastery')
                .select('*')
                .eq('user_id', user.id)
                .eq('exam_type', goals?.target_exam || 'sat')
                .order('mastery_score', { ascending: true })
                .limit(3);

            const weakDomains = mastery?.map(m => m.domain) || goals?.weak_areas || ['Algebra'];
            const chosenDomain = weakDomains[Math.floor(Math.random() * weakDomains.length)];
            const targetScore = goals?.target_score || 1600;
            const userName = user?.user_metadata?.full_name || 'Student';

            // Generate question using AI
            const prompt = `
Generate a highly personalized Digital SAT practice question for ${userName}.
Target Exam: ${goals?.target_exam || 'SAT'}
Target Score: ${targetScore}
Current Weak Domain: ${chosenDomain}

Context: The student is leveling up their skills. Make the question challenging but appropriate for a target score of ${targetScore}.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "domain": "${chosenDomain}",
  "subdomain": "specific subtopic",
  "question": "The question text with any necessary context",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correctIndex": 0,
  "explanation": "Brief explanation of the correct answer"
}

Make it appropriate difficulty for SAT prep. Include any formulas in plain text.`;

            const response = await AIService.getInstance().generateChatCompletion(
                prompt,
                "You are an elite SAT architect. Return ONLY valid JSON, no markdown."
            );

            // Parse JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const questionData = JSON.parse(jsonMatch[0]);
                setQuestion({
                    id: crypto.randomUUID(),
                    ...questionData,
                });
            } else {
                throw new Error('Failed to parse question');
            }
        } catch (error) {
            console.error('Error generating question:', error);
            // Fallback question
            setQuestion({
                id: crypto.randomUUID(),
                domain: 'Algebra',
                subdomain: 'Linear Equations',
                question: 'If 3x + 5 = 20, what is the value of x?',
                options: ['A) 3', 'B) 5', 'C) 7', 'D) 15'],
                correctIndex: 1,
                explanation: '3x + 5 = 20 → 3x = 15 → x = 5',
            });
        }
    };

    const handleAnswerSelect = async (index: number) => {
        if (selectedAnswer !== null || !question) return;

        setSelectedAnswer(index);
        const correct = index === question.correctIndex;
        setIsCorrect(correct);

        try {
            // Record the check-in
            const result = await recordDailyCheckin(
                user.id,
                question.domain,
                correct
            );
            setCheckinResult(result);

            // Short delay to show answer, then transition to result
            setTimeout(() => {
                setState('result');
            }, 1500);
        } catch (error) {
            console.error('Error recording checkin:', error);
            setState('result');
        }
    };

    const handleContinue = () => {
        setState('mission');
    };

    const handleMagicIngest = (type: string) => {
        localStorage.setItem('syow_preselect_type', type);
        navigate('/syow');
    };

    const handlePlugGap = (gap: any) => {
        const message = `ATLAS, I have a logic gap in **"${gap.domain} : ${gap.subdomain}"**. My current mastery is only ${gap.mastery_score}%. \n\nLet's start a Feynman Session to plug this gap immediately.`;

        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', {
            detail: {
                message,
                voice: true
            }
        }));

        navigate('/atlas', { state: { initialMessage: message } });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'GOOD MORNING';
        if (hour < 18) return 'GOOD AFTERNOON';
        return 'GOOD EVENING';
    };

    const levelInfo = calculateLevel(checkinState.totalXp);

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-10 selection:bg-primary/30">
            <div className="max-w-6xl mx-auto">
                {/* Header with XP and Streak */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                NEURAL_CORE // {getGreeting()}
                            </span>
                        </div>
                        <h1 className="text-6xl font-black italic tracking-tighter uppercase text-white leading-none">
                            Daily <span className="text-primary">Intel</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4 bg-card-dark border border-white/5 px-8 py-4 rounded-2xl shadow-2xl relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-neo-accent opacity-50" />
                            <Flame className="w-8 h-8 text-neo-accent group-hover:scale-110 transition-transform" />
                            <div>
                                <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">STREAK</div>
                                <div className="font-black text-3xl text-white tabular-nums leading-none">
                                    {checkinState.streak} <span className="text-xs italic text-slate-500 font-bold ml-1 uppercase">Days</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-card-dark border border-white/5 px-8 py-4 rounded-2xl shadow-2xl relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-50" />
                            <div className="text-4xl group-hover:scale-110 transition-transform cursor-default">{levelInfo.badge}</div>
                            <div>
                                <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">LEVEL {levelInfo.level}</div>
                                <div className="font-black text-2xl italic uppercase text-white tracking-tight leading-none">{levelInfo.name}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {state === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-40 bg-slate-900/50 border border-white/5 rounded-3xl backdrop-blur-md"
                        >
                            <div className="w-20 h-20 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-10" />
                            <p className="font-black uppercase tracking-[0.4em] text-slate-500 text-sm">Synchronizing_Systems...</p>
                        </motion.div>
                    )}

                    {state === 'question' && question && (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-card-dark border border-white/5 rounded-3xl shadow-2xl overflow-hidden shadow-primary/5"
                        >
                            <div className="bg-slate-900 px-10 py-8 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg">
                                        <Brain className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none mb-2">Daily Power Up</h2>
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded border border-primary/20">{question.domain}</span>
                                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{question.subdomain}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-primary font-black text-3xl tabular-nums">+{isCorrect === null ? '60' : isCorrect ? '60' : '40'} <span className="text-sm italic opacity-50">XP</span></div>
                                </div>
                            </div>

                            <div className="p-10 md:p-16">
                                <div className="relative mb-16">
                                    <div className="absolute -left-8 top-0 w-1 h-full bg-primary rounded-full shadow-lg shadow-primary/20" />
                                    <p className="text-4xl font-bold tracking-tight leading-[1.15] text-white italic drop-shadow-sm">"{question.question}"</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    {question.options.map((option, index) => {
                                        let bgClass = 'bg-slate-900 hover:bg-slate-800 hover:scale-[1.02] border-white/5';
                                        let textClass = 'text-slate-300';

                                        if (selectedAnswer !== null) {
                                            if (index === question.correctIndex) {
                                                bgClass = 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20';
                                                textClass = 'text-emerald-400';
                                            } else if (index === selectedAnswer && !isCorrect) {
                                                bgClass = 'bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/20';
                                                textClass = 'text-rose-400';
                                            } else {
                                                bgClass = 'bg-slate-900 opacity-30 border-white/5';
                                                textClass = 'text-slate-600';
                                            }
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(index)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full p-8 border rounded-2xl ${bgClass} ${textClass} text-left font-bold text-xl transition-all shadow-xl disabled:cursor-not-allowed flex items-center justify-between group`}
                                            >
                                                <span className="leading-tight">{option}</span>
                                                {selectedAnswer !== null && index === question.correctIndex && (
                                                    <Check className="w-8 h-8 shrink-0 text-emerald-400 stroke-[4px]" />
                                                )}
                                                {selectedAnswer === index && !isCorrect && (
                                                    <X className="w-8 h-8 shrink-0 text-rose-400 stroke-[4px]" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedAnswer !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-16 p-10 bg-slate-900 border border-white/5 rounded-3xl shadow-inner shadow-black/20"
                                    >
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <Sparkles className="w-6 h-6 text-primary" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Atlas_Neural_Insight</p>
                                        </div>
                                        <p className="text-2xl font-medium leading-relaxed italic text-slate-300">"{question.explanation}"</p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {state === 'result' && checkinResult && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-card-dark border border-white/5 rounded-[3rem] p-16 md:p-24 text-center shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                                className={`w-40 h-40 mx-auto mb-12 rounded-3xl flex items-center justify-center ${isCorrect ? 'bg-emerald-500/20 text-emerald-500' : 'bg-primary/20 text-primary'
                                    } shadow-2xl border border-white/5`}
                            >
                                {isCorrect ? (
                                    <Trophy size={80} strokeWidth={1.5} />
                                ) : (
                                    <Target size={80} strokeWidth={1.5} />
                                )}
                            </motion.div>

                            <h2 className="text-6xl font-black uppercase italic mb-6 tracking-tighter text-white">
                                {isCorrect ? 'Nailed it!' : 'Stabilized'}
                            </h2>
                            <p className="text-slate-500 font-bold mb-16 text-2xl uppercase tracking-[0.2em] leading-tight">
                                {isCorrect
                                    ? "Neural mastery spiking. Logic gaps plugged."
                                    : "Data acquired. Analyzing errors for recalibration."}
                            </p>

                            <div className="flex flex-col md:flex-row justify-center gap-8 mb-16">
                                <div className="bg-primary/10 border border-primary/20 p-8 rounded-3xl shadow-xl flex-1">
                                    <Zap className="w-10 h-10 mx-auto mb-4 text-primary" />
                                    <div className="text-5xl font-black text-white tabular-nums">+{checkinResult.xpEarned}</div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mt-2">XP Earned</div>
                                </div>

                                <div className="bg-neo-accent/10 border border-neo-accent/20 p-8 rounded-3xl shadow-xl flex-1">
                                    <Flame className="w-10 h-10 mx-auto mb-4 text-neo-accent" />
                                    <div className="text-5xl font-black text-white tabular-nums">{checkinResult.streak}</div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-neo-accent mt-2">Day Streak</div>
                                </div>
                            </div>

                            <button
                                onClick={handleContinue}
                                className="bg-primary hover:bg-blue-600 text-white px-16 py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-6 mx-auto"
                            >
                                MISSION CONTROL <ArrowRight size={28} strokeWidth={3} />
                            </button>
                        </motion.div>
                    )}

                    {state === 'mission' && (
                        <motion.div
                            key="mission"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-16"
                        >
                            <div className="grid lg:grid-cols-3 gap-12">
                                <div className="lg:col-span-2 space-y-10">
                                    {todayMission && (
                                        <div className="bg-card-dark border border-white/10 glass rounded-3xl shadow-2xl relative group overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-primary/20 text-primary px-8 py-3 rounded-bl-3xl border-l border-b border-primary/30 font-black italic tracking-widest uppercase text-xs">
                                                Day {todayMission.dayNumber} Protocol
                                            </div>
                                            <div className="p-12">
                                                <div className="flex items-center gap-6 mb-12">
                                                    <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-lg">
                                                        <Target className="w-10 h-10" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">PRIMARY TARGET</h2>
                                                        <h3 className="text-5xl font-black uppercase italic tracking-tighter text-white leading-none">{todayMission.plan.subject}</h3>
                                                    </div>
                                                </div>

                                                <div className="bg-slate-900 border border-white/5 p-10 rounded-2xl mb-12 relative shadow-inner">
                                                    <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 opacity-40">
                                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                                        <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Unit_Focus</span>
                                                    </div>
                                                    <h4 className="text-3xl font-black text-white italic uppercase mb-2">{todayMission.task?.topic || 'General Practice'}</h4>
                                                    <p className="font-bold text-slate-500 leading-relaxed uppercase text-sm tracking-wide">{todayMission.task?.description}</p>
                                                </div>

                                                <div className="grid sm:grid-cols-2 gap-8">
                                                    <Link
                                                        to="/atlas"
                                                        className="bg-primary hover:bg-blue-600 text-white p-8 rounded-2xl font-black uppercase italic text-2xl text-center shadow-xl shadow-primary/10 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-6"
                                                    >
                                                        <Brain className="w-10 h-10" /> Launch Atlas
                                                    </Link>
                                                    <Link
                                                        to="/sat-simulator"
                                                        className="bg-slate-800 hover:bg-slate-700 text-white p-8 rounded-2xl font-black uppercase italic text-2xl text-center border border-white/5 shadow-xl transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-6"
                                                    >
                                                        <Activity className="w-10 h-10 text-primary" /> Simulator
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-900/60 backdrop-blur-sm border border-white/5 p-10 rounded-3xl shadow-xl">
                                        <div className="flex items-center gap-4 mb-10">
                                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                                <Zap className="w-7 h-7" />
                                            </div>
                                            <h3 className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">Neural Ingestion</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-6">
                                            {[
                                                { type: 'pdf', icon: FileUp, label: 'PDF Source' },
                                                { type: 'link', icon: Globe, label: 'Web Data' },
                                                { type: 'youtube', icon: Youtube, label: 'Video Feed', color: 'text-rose-500' },
                                            ].map((item) => (
                                                <button
                                                    key={item.type}
                                                    onClick={() => handleMagicIngest(item.type)}
                                                    className="bg-slate-800 border border-white/5 p-8 rounded-2xl flex flex-col items-center gap-4 hover:bg-slate-700 hover:border-primary/20 transition-all shadow-lg group"
                                                >
                                                    <item.icon className={`w-12 h-12 ${item.color || 'text-slate-400'} group-hover:scale-110 transition-transform`} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <div className="bg-slate-900/60 border border-white/5 p-8 rounded-3xl shadow-xl">
                                        <div className="flex items-center gap-4 mb-8 px-2">
                                            <Activity className="w-6 h-6 text-primary" />
                                            <h4 className="text-xl font-black uppercase tracking-tighter italic text-white">Neural activity</h4>
                                        </div>
                                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5 shadow-inner">
                                            <MasteryHeatmap />
                                        </div>
                                    </div>

                                    <div className="bg-slate-900 border border-white/5 p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/30" />
                                        <div className="flex items-center gap-4 mb-8 px-2">
                                            <AlertCircle className="w-7 h-7 text-amber-500" />
                                            <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">Neural Gaps</h4>
                                        </div>
                                        <div className="space-y-4">
                                            {logicGaps.length > 0 ? logicGaps.map((gap, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl group hover:border-primary/50 transition-all cursor-pointer shadow-lg"
                                                    onClick={() => handlePlugGap(gap)}
                                                >
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-black tracking-widest text-primary uppercase mb-1">{gap.domain}</div>
                                                            <h5 className="font-black uppercase text-base text-white truncate italic">{gap.subdomain}</h5>
                                                        </div>
                                                        <div className="text-right pl-4">
                                                            <div className="text-3xl font-black text-amber-500 leading-none mb-1">{gap.mastery_score}%</div>
                                                            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Mastery</div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-4 border-t border-white/5 flex items-center gap-3 text-[10px] font-black text-primary group-hover:translate-x-2 transition-transform uppercase tracking-widest">
                                                        Plug Gap with Atlas <ChevronRight size={14} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-slate-600 font-black uppercase text-center py-12 border-2 border-dashed border-white/5 rounded-2xl opacity-40">
                                                    No_Gaps_MAPPED_YET
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pt-16 border-t border-white/5">
                                {[
                                    { label: 'Curriculum', icon: List, href: '/curriculum' },
                                    { label: 'Video Vault', icon: Youtube, href: '/videos' },
                                    { label: 'Feynman', icon: Sparkles, href: '/feynman' },
                                    { label: 'Roadmaps', icon: Activity, href: '/roadmaps' },
                                    { label: 'Social Deck', icon: LayoutDashboard, href: '/social' },
                                    { label: 'SYOW Feed', icon: Monitor, href: '/syow' },
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.href}
                                        className="bg-slate-900 border border-white/5 p-8 rounded-2xl text-center shadow-lg hover:bg-slate-800 hover:border-primary/20 transition-all hover:-translate-y-1 group"
                                    >
                                        <action.icon className="w-10 h-10 mb-4 mx-auto text-slate-500 group-hover:text-primary transition-colors" />
                                        <span className="font-black uppercase text-[10px] tracking-widest text-slate-500 group-hover:text-white transition-colors">{action.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <footer className="mt-48 text-center pb-24 border-t border-white/5 pt-20">
                <div className="flex items-center justify-center gap-12 mb-10 opacity-10">
                    <Brain size={32} />
                    <Activity size={32} />
                    <Sparkles size={32} />
                </div>
                <div className="inline-flex items-center gap-4 bg-slate-900 px-6 py-2 rounded-full border border-white/5 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">All Systems Operational</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.8em] text-slate-700 italic">
                    Deep_Focus_2026
                </p>
            </footer>
        </div>
    );
}

export default DailyCheckin;
