import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flame, Trophy, Zap, Check, X, ArrowRight,
    Brain, Target, Sparkles, LayoutDashboard
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

    // Load initial state
    useEffect(() => {
        if (user?.id) {
            loadCheckinState();
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
        setIsCorrect(index === question.correctIndex);

        try {
            // Record the check-in
            const result = await recordDailyCheckin(
                user.id,
                question.domain,
                index === question.correctIndex
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

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'GOOD MORNING';
        if (hour < 18) return 'GOOD AFTERNOON';
        return 'GOOD EVENING';
    };

    const levelInfo = calculateLevel(checkinState.totalXp);

    return (
        <div className="min-h-screen bg-neo-bg p-4 md:p-8">
            <div className="max-w-4xl mx-auto">

                {/* Header with XP and Streak */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <span className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                            {getGreeting()}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Streak */}
                        <div className="flex items-center gap-2 bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000]">
                            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                            <span className="font-black text-xl">{checkinState.streak}</span>
                            <span className="text-[8px] font-black uppercase text-black/40">DAYS</span>
                        </div>

                        {/* Level */}
                        <div className="flex items-center gap-2 bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_#000]">
                            <span className="text-xl">{levelInfo.badge}</span>
                            <div>
                                <div className="text-[8px] font-black uppercase text-black/40">LEVEL {levelInfo.level}</div>
                                <div className="font-black text-sm">{levelInfo.name}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* LOADING STATE */}
                    {state === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-20"
                        >
                            <div className="w-16 h-16 border-8 border-black border-t-neo-accent animate-spin mb-6" />
                            <p className="font-black uppercase tracking-widest text-black/60">LOADING TODAY'S CHECK-IN...</p>
                        </motion.div>
                    )}

                    {/* QUESTION STATE */}
                    {state === 'question' && question && (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000] overflow-hidden"
                        >
                            {/* Question Header */}
                            <div className="bg-black text-white p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-neo-accent p-2 border-2 border-white">
                                        <Brain className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-black uppercase tracking-tight">DAILY POWER QUESTION</h2>
                                        <p className="text-[10px] text-white/60 uppercase tracking-widest">{question.domain} → {question.subdomain}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-neo-secondary font-black">+{isCorrect === null ? '50-60' : isCorrect ? '60' : '40'} XP</div>
                                </div>
                            </div>

                            {/* Question Body */}
                            <div className="p-8">
                                <p className="text-xl font-bold leading-relaxed mb-8">{question.question}</p>

                                {/* Options */}
                                <div className="space-y-4">
                                    {question.options.map((option, index) => {
                                        let bgClass = 'bg-neo-bg hover:bg-neo-secondary hover:-translate-y-1';
                                        let borderClass = 'border-black';

                                        if (selectedAnswer !== null) {
                                            if (index === question.correctIndex) {
                                                bgClass = 'bg-green-400';
                                                borderClass = 'border-green-600';
                                            } else if (index === selectedAnswer && !isCorrect) {
                                                bgClass = 'bg-red-400';
                                                borderClass = 'border-red-600';
                                            } else {
                                                bgClass = 'bg-gray-100 opacity-50';
                                            }
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(index)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full p-4 border-4 ${borderClass} ${bgClass} text-left font-bold transition-all shadow-[4px_4px_0px_0px_#000] disabled:cursor-not-allowed flex items-center justify-between`}
                                            >
                                                <span>{option}</span>
                                                {selectedAnswer !== null && index === question.correctIndex && (
                                                    <Check className="w-6 h-6 text-green-800" />
                                                )}
                                                {selectedAnswer === index && !isCorrect && (
                                                    <X className="w-6 h-6 text-red-800" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Explanation (shown after answer) */}
                                {selectedAnswer !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-6 p-4 bg-neo-muted border-4 border-black"
                                    >
                                        <p className="text-[10px] font-black uppercase text-black/60 mb-2">EXPLANATION</p>
                                        <p className="font-bold">{question.explanation}</p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* RESULT STATE */}
                    {state === 'result' && checkinResult && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000] p-8 text-center"
                        >
                            {/* Result Icon */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.2 }}
                                className={`w-24 h-24 mx-auto mb-6 border-4 border-black flex items-center justify-center ${isCorrect ? 'bg-neo-secondary' : 'bg-neo-muted'
                                    } shadow-[6px_6px_0px_0px_#000]`}
                            >
                                {isCorrect ? (
                                    <Trophy className="w-12 h-12 text-black" />
                                ) : (
                                    <Target className="w-12 h-12 text-black" />
                                )}
                            </motion.div>

                            <h2 className="text-4xl font-black uppercase italic mb-2">
                                {isCorrect ? 'NAILED IT!' : 'KEEP PUSHING!'}
                            </h2>
                            <p className="text-black/60 font-bold mb-8">
                                {isCorrect
                                    ? "You're on fire! Your hard work is paying off."
                                    : "Every question makes you stronger. Let's keep going!"}
                            </p>

                            {/* XP Earned */}
                            <div className="flex justify-center gap-4 mb-8">
                                <div className="bg-neo-accent text-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
                                    <Zap className="w-8 h-8 mx-auto mb-2" />
                                    <div className="text-3xl font-black">+{checkinResult.xpEarned}</div>
                                    <div className="text-[10px] uppercase tracking-widest">XP EARNED</div>
                                </div>

                                <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
                                    <Flame className="w-8 h-8 mx-auto mb-2 text-orange-500 fill-orange-500" />
                                    <div className="text-3xl font-black">{checkinResult.streak}</div>
                                    <div className="text-[10px] uppercase tracking-widest">DAY STREAK</div>
                                </div>
                            </div>

                            {/* Streak Bonus */}
                            {checkinResult.streakBonus > 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="bg-neo-secondary border-4 border-black p-4 mb-8 inline-block shadow-[4px_4px_0px_0px_#000]"
                                >
                                    <p className="font-black uppercase">
                                        🔥 STREAK BONUS: +{checkinResult.streakBonus} XP
                                    </p>
                                </motion.div>
                            )}

                            {/* Level Up */}
                            {checkinResult.levelUp && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.7, type: 'spring' }}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-4 border-black p-6 mb-8 shadow-[8px_8px_0px_0px_#000]"
                                >
                                    <Sparkles className="w-10 h-10 mx-auto mb-2 animate-pulse" />
                                    <h3 className="text-2xl font-black uppercase">LEVEL UP!</h3>
                                    <p className="text-lg font-bold">You reached Level {checkinResult.newLevel}!</p>
                                </motion.div>
                            )}

                            {/* Continue Button */}
                            <button
                                onClick={handleContinue}
                                className="bg-black text-white border-4 border-black px-8 py-4 font-black uppercase tracking-widest text-lg shadow-[6px_6px_0px_0px_#666] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#666] transition-all flex items-center gap-3 mx-auto"
                            >
                                VIEW TODAY'S MISSION <ArrowRight className="w-6 h-6" />
                            </button>
                        </motion.div>
                    )}

                    {/* MISSION STATE */}
                    {state === 'mission' && (
                        <motion.div
                            key="mission"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            {/* Welcome Back Card (if already checked in) */}
                            {checkinState.hasCheckedIn && (
                                <div className="bg-neo-secondary border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000]">
                                    <div className="flex items-center gap-4">
                                        <Check className="w-8 h-8 text-green-700" />
                                        <div>
                                            <h3 className="font-black uppercase text-xl">CHECK-IN COMPLETE</h3>
                                            <p className="font-bold text-black/60">You've already powered up today. Keep the momentum!</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Today's Mission */}
                            {todayMission && (
                                <div className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000]">
                                    <div className="bg-black text-white p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-neo-accent p-2 border-2 border-white">
                                                <Target className="w-5 h-5" />
                                            </div>
                                            <h2 className="font-black uppercase tracking-tight">TODAY'S MISSION</h2>
                                        </div>
                                        <div className="bg-white text-black px-3 py-1 font-black text-sm">
                                            DAY {todayMission.dayNumber}
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        <div className="mb-6">
                                            <p className="text-[10px] font-black uppercase text-black/40 mb-2">CURRENT SUBJECT</p>
                                            <h3 className="text-3xl font-black uppercase italic">{todayMission.plan.subject}</h3>
                                        </div>

                                        <div className="bg-neo-bg border-4 border-black p-6 mb-6">
                                            <p className="text-[10px] font-black uppercase text-black/40 mb-2">TODAY'S FOCUS</p>
                                            <h4 className="text-xl font-black mb-2">{todayMission.task?.topic || 'General Practice'}</h4>
                                            <p className="font-bold text-black/60">{todayMission.task?.description}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-4">
                                            <Link
                                                to="/sat-simulator"
                                                className="flex-1 min-w-[200px] bg-neo-accent text-white border-4 border-black p-4 font-black uppercase text-center shadow-[4px_4px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] transition-all flex items-center justify-center gap-2"
                                            >
                                                <Brain className="w-5 h-5" /> PRACTICE SAT
                                            </Link>
                                            <Link
                                                to="/feynman"
                                                className="flex-1 min-w-[200px] bg-neo-secondary border-4 border-black p-4 font-black uppercase text-center shadow-[4px_4px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] transition-all flex items-center justify-center gap-2"
                                            >
                                                <Sparkles className="w-5 h-5" /> FEYNMAN MODE
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { label: 'ATLAS', icon: LayoutDashboard, href: '/atlas', color: 'bg-neo-secondary' },
                                    { label: 'SAT SIM', icon: Brain, href: '/sat-simulator', color: 'bg-neo-accent text-white' },
                                    { label: 'VIDEOS', icon: Zap, href: '/videos', color: 'bg-neo-muted' },
                                    { label: 'FLASHCARDS', icon: Target, href: '/tools', color: 'bg-white' },
                                    { label: 'PROGRESS', icon: Trophy, href: '/progress', color: 'bg-neo-secondary' },
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.href}
                                        className={`${action.color} border-4 border-black p-4 text-center shadow-[4px_4px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000] transition-all flex flex-col items-center justify-center`}
                                    >
                                        <action.icon className="w-8 h-8 mb-2" />
                                        <span className="font-black uppercase text-[10px] sm:text-xs">{action.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default DailyCheckin;
