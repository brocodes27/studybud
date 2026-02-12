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
import OpenAIService from '../../lib/openaiService';
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

            const response = await OpenAIService.getInstance().generateChatCompletion(
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
        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', {
            detail: {
                message: `ATLAS, I have a logic gap in **"${gap.domain} : ${gap.subdomain}"**. My current mastery is only ${gap.mastery_score}%. \n\nLet's start a Feynman Session to plug this gap immediately.`,
                voice: true
            }
        }));
        navigate('/atlas');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'GOOD MORNING';
        if (hour < 18) return 'GOOD AFTERNOON';
        return 'GOOD EVENING';
    };

    const levelInfo = calculateLevel(checkinState.totalXp);

    return (
        <div className="min-h-screen bg-neo-bg p-4 md:p-8 selection:bg-neo-accent selection:text-black">
            <div className="max-w-6xl mx-auto">
                {/* Header with XP and Streak */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex flex-col gap-2">
                        <span className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest self-start">
                            NEURAL_OS_v3.2 // {getGreeting()}
                        </span>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase">MISSION_CONTROL</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-white border-4 border-black px-6 py-3 shadow-[6px_6px_0px_0px_#000]">
                            <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                            <div>
                                <div className="text-[10px] font-black uppercase text-black/40 leading-none mb-1">STREAK</div>
                                <div className="font-black text-2xl leading-none">{checkinState.streak} <span className="text-xs italic">DAYS</span></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white border-4 border-black px-6 py-3 shadow-[6px_6px_0px_0px_#000]">
                            <div className="text-3xl grayscale hover:grayscale-0 transition-all cursor-default">{levelInfo.badge}</div>
                            <div>
                                <div className="text-[10px] font-black uppercase text-black/40 leading-none mb-1">LEVEL {levelInfo.level}</div>
                                <div className="font-black text-xl italic uppercase font-serif tracking-tight">{levelInfo.name}</div>
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
                            className="flex flex-col items-center justify-center py-40 bg-white border-8 border-black shadow-[20px_20px_0px_0px_#000] rotate-1"
                        >
                            <div className="w-20 h-20 border-8 border-black border-t-neo-accent animate-spin mb-8" />
                            <p className="font-black uppercase tracking-[0.3em] text-black">INITIALIZING_NEURAL_LINK...</p>
                        </motion.div>
                    )}

                    {state === 'question' && question && (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="bg-white border-8 border-black shadow-[20px_20px_0px_0px_#000] overflow-hidden rotate-[-0.5deg]"
                        >
                            <div className="bg-black text-white p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-neo-accent p-3 border-2 border-white shadow-[4px_4px_0px_0px_#fff]">
                                        <Brain className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tighter italic">DAILY_POWER_UP</h2>
                                        <p className="text-[10px] text-neo-accent font-black uppercase tracking-[0.2em]">{question.domain} // {question.subdomain}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-neo-secondary font-black text-2xl">+{isCorrect === null ? '60' : isCorrect ? '60' : '40'} XP</div>
                                </div>
                            </div>

                            <div className="p-10">
                                <p className="text-3xl font-black tracking-tight leading-tight mb-12 border-l-8 border-neo-accent pl-8 italic">"{question.question}"</p>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {question.options.map((option, index) => {
                                        let bgClass = 'bg-neo-bg hover:bg-neo-secondary hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_#000]';
                                        let borderClass = 'border-black';

                                        if (selectedAnswer !== null) {
                                            if (index === question.correctIndex) {
                                                bgClass = 'bg-neo-secondary shadow-none';
                                                borderClass = 'border-black';
                                            } else if (index === selectedAnswer && !isCorrect) {
                                                bgClass = 'bg-red-400 shadow-none';
                                                borderClass = 'border-black';
                                            } else {
                                                bgClass = 'bg-white opacity-40';
                                            }
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(index)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full p-6 border-4 ${borderClass} ${bgClass} text-left font-black text-xl transition-all shadow-[8px_8px_0px_0px_#000] disabled:cursor-not-allowed flex items-center justify-between group`}
                                            >
                                                <span>{option}</span>
                                                {selectedAnswer !== null && index === question.correctIndex && (
                                                    <Check className="w-8 h-8 text-black stroke-[4px]" />
                                                )}
                                                {selectedAnswer === index && !isCorrect && (
                                                    <X className="w-8 h-8 text-black stroke-[4px]" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedAnswer !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="mt-12 p-8 bg-neo-muted border-4 border-black shadow-[8px_8px_0px_0px_#000]"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <Sparkles className="w-6 h-6 text-black" />
                                            <p className="text-xs font-black uppercase tracking-widest text-black">ATLAS_EXPLANATION</p>
                                        </div>
                                        <p className="text-xl font-bold leading-tight italic">"{question.explanation}"</p>
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
                            className="bg-white border-8 border-black shadow-[20px_20px_0px_0px_#000] p-12 text-center rotate-1"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.2 }}
                                className={`w-32 h-32 mx-auto mb-8 border-4 border-black flex items-center justify-center ${isCorrect ? 'bg-neo-secondary' : 'bg-neo-muted'
                                    } shadow-[8px_8px_0px_0px_#000] rotate-[-5deg]`}
                            >
                                {isCorrect ? (
                                    <Trophy className="w-16 h-16 text-black" />
                                ) : (
                                    <Target className="w-16 h-16 text-black" />
                                )}
                            </motion.div>

                            <h2 className="text-5xl font-black uppercase italic mb-4 tracking-tighter">
                                {isCorrect ? 'NAILED THE LINK!' : 'CONNECTION_STABLE'}
                            </h2>
                            <p className="text-black/60 font-bold mb-10 text-xl uppercase tracking-widest">
                                {isCorrect
                                    ? "NEURAL mastery increasing. Logic gaps plugged."
                                    : "Every question is a data point. Analyzing results..."}
                            </p>

                            <div className="flex justify-center gap-6 mb-12">
                                <div className="bg-neo-accent text-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] rotate-[-2deg]">
                                    <Zap className="w-10 h-10 mx-auto mb-3" />
                                    <div className="text-4xl font-black">+{checkinResult.xpEarned}</div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">XP_EARNED</div>
                                </div>

                                <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000] rotate-[2deg]">
                                    <Flame className="w-10 h-10 mx-auto mb-3 text-orange-500 fill-orange-500" />
                                    <div className="text-4xl font-black">{checkinResult.streak}</div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">DAY_STREAK</div>
                                </div>
                            </div>

                            {checkinResult.streakBonus > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-neo-secondary border-4 border-black p-4 mb-10 inline-block shadow-[4px_4px_0px_0px_#000]"
                                >
                                    <p className="font-black uppercase italic">
                                        🔥 NEURAL_STREAK_BONUS: +{checkinResult.streakBonus} XP
                                    </p>
                                </motion.div>
                            )}

                            {checkinResult.levelUp && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.7, type: 'spring' }}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-4 border-black p-8 mb-10 shadow-[12px_12px_0px_0px_#000]"
                                >
                                    <Sparkles className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                                    <h3 className="text-3xl font-black uppercase italic tracking-tighter">LEVEL_UNLOCKED!</h3>
                                    <p className="text-xl font-bold uppercase tracking-widest">You reached Level {checkinResult.newLevel}!</p>
                                </motion.div>
                            )}

                            <button
                                onClick={handleContinue}
                                className="bg-black text-white border-4 border-black px-12 py-5 font-black uppercase tracking-[0.2em] text-xl shadow-[10px_10px_0px_0px_#666] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[14px_14px_0px_0px_#666] active:shadow-none transition-all flex items-center gap-4 mx-auto"
                            >
                                MISSION_CONTROL <ArrowRight className="w-8 h-8" />
                            </button>
                        </motion.div>
                    )}

                    {state === 'mission' && (
                        <motion.div
                            key="mission"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-12"
                        >
                            <div className="grid lg:grid-cols-3 gap-12">
                                <div className="lg:col-span-2 space-y-8">
                                    {todayMission && (
                                        <div className="bg-white border-8 border-black shadow-[16px_16px_0px_0px_#000] relative group overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-neo-accent text-white px-8 py-3 border-l-4 border-b-4 border-black font-black italic tracking-tighter uppercase whitespace-nowrap">
                                                DAY {todayMission.dayNumber} PROTOCOL
                                            </div>
                                            <div className="p-10">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="w-16 h-16 bg-neo-secondary border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
                                                        <Target className="w-10 h-10" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-1">CURRENT_TARGET</h2>
                                                        <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{todayMission.plan.subject}</h3>
                                                    </div>
                                                </div>

                                                <div className="bg-neo-bg border-4 border-black p-8 mb-10 relative">
                                                    <div className="absolute top-[-2px] left-[-2px] bg-black text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">UNIT_FOCUS</div>
                                                    <h4 className="text-2xl font-black mb-2 italic uppercase">{todayMission.task?.topic || 'General Practice'}</h4>
                                                    <p className="font-bold text-black/60 leading-tight uppercase text-sm tracking-wide">{todayMission.task?.description}</p>
                                                </div>

                                                <div className="grid sm:grid-cols-2 gap-6">
                                                    <Link
                                                        to="/atlas"
                                                        className="bg-black text-white border-4 border-black p-6 font-black uppercase italic text-xl text-center shadow-[8px_8px_0px_0px_#666] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#666] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-4"
                                                    >
                                                        <Brain className="w-8 h-8 text-neo-secondary" /> LAUNCH_ATLAS
                                                    </Link>
                                                    <Link
                                                        to="/sat-simulator"
                                                        className="bg-white border-4 border-black p-6 font-black uppercase italic text-xl text-center shadow-[8px_8px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex items-center justify-center gap-4"
                                                    >
                                                        <Activity className="w-8 h-8 text-neo-accent" /> START_SIMULATOR
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-neo-muted border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000]">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="bg-white p-2 border-2 border-black">
                                                <Zap className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-2xl font-black uppercase tracking-tighter italic">NEURAL_INGESTION_MODULE</h3>
                                        </div>
                                        <p className="font-bold uppercase text-xs tracking-widest text-black/40 mb-8 border-b-2 border-black/10 pb-4">DRAG_AND_DROP_TO_BIFURCATE_ANY_SOURCE</p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <button onClick={() => handleMagicIngest('pdf')} className="bg-white border-2 border-black p-6 flex flex-col items-center gap-3 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_#000] group">
                                                <FileUp className="w-10 h-10 group-hover:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">PDF</span>
                                            </button>
                                            <button onClick={() => handleMagicIngest('link')} className="bg-white border-2 border-black p-6 flex flex-col items-center gap-3 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_#000] group">
                                                <Globe className="w-10 h-10 group-hover:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">LINK</span>
                                            </button>
                                            <button onClick={() => handleMagicIngest('youtube')} className="bg-white border-2 border-black p-6 flex flex-col items-center gap-3 hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_#000] group">
                                                <Youtube className="w-10 h-10 text-red-600 group-hover:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">YOUTUBE</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000]">
                                        <div className="flex items-center gap-3 mb-6">
                                            <Activity className="w-5 h-5 text-neo-accent" />
                                            <h4 className="font-black uppercase tracking-tighter italic">NEURAL_ACTIVITY_MAP</h4>
                                        </div>
                                        <div className="scale-[0.85] origin-top-left">
                                            <MasteryHeatmap />
                                        </div>
                                    </div>

                                    <div className="bg-black text-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                                        <div className="flex items-center gap-3 mb-6">
                                            <AlertCircle className="w-6 h-6 text-neo-secondary" />
                                            <h4 className="text-xl font-black uppercase italic tracking-tighter">CRITICAL_LOGIC_GAPS</h4>
                                        </div>
                                        <div className="space-y-4">
                                            {logicGaps.length > 0 ? logicGaps.map((gap, i) => (
                                                <div key={i} className="bg-white/10 border-2 border-white/20 p-4 group hover:border-neo-secondary transition-all cursor-pointer" onClick={() => handlePlugGap(gap)}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="overflow-hidden">
                                                            <div className="text-[10px] font-black tracking-widest text-neo-secondary uppercase">{gap.domain}</div>
                                                            <h5 className="font-black uppercase text-sm truncate">{gap.subdomain}</h5>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xl font-black text-neo-secondary">{gap.mastery_score}%</div>
                                                            <div className="text-[8px] font-black opacity-40">MASTERY</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-neo-accent group-hover:translate-x-2 transition-transform uppercase">
                                                        PLUG_GAP_WITH_ATLAS <ChevronRight className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-white/40 font-black uppercase text-center py-8 border-2 border-dashed border-white/20">
                                                    NO_GAPS_DETECTED_YET
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pt-12 border-t-8 border-black">
                                {[
                                    { label: 'CURRICULUM', icon: List, href: '/curriculum' },
                                    { label: 'VIDEO_VAULT', icon: Youtube, href: '/videos' },
                                    { label: 'FEYNMAN_BOARD', icon: Sparkles, href: '/feynman' },
                                    { label: 'MY_ROADMAPS', icon: Activity, href: '/roadmaps' },
                                    { label: 'SOCIAL_DECK', icon: LayoutDashboard, href: '/social' },
                                    { label: 'SYOW_ARCHIVE', icon: Monitor, href: '/syow' },
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.href}
                                        className="bg-white border-4 border-black p-6 text-center shadow-[6px_6px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all flex flex-col items-center justify-center group"
                                    >
                                        <action.icon className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform" />
                                        <span className="font-black uppercase text-[10px] tracking-widest">{action.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <footer className="mt-40 text-center pb-20 border-t-4 border-black/10 pt-20">
                <div className="flex items-center justify-center gap-8 mb-8 opacity-20">
                    <Brain className="w-8 h-8" />
                    <Activity className="w-8 h-8" />
                    <Sparkles className="w-8 h-8" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20 italic">
                    NEURAL_OS_STUDYBUD_GEN_2026 // ALL_SYSTEMS_OPERATIONAL
                </p>
            </footer>
        </div>
    );
}

export default DailyCheckin;
