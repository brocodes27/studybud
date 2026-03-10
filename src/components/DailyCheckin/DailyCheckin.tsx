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
        <div className="pb-20 animate-fade-in">
            <div className="max-w-6xl mx-auto">
                {/* Header with XP and Streak */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse" />
                            <span className="text-xs font-bold text-[#00D1FF]">
                                {getGreeting()}
                            </span>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-[#0A192F] leading-none">
                            Daily <span className="text-[#00D1FF]">Intel</span>
                        </h1>
                        <p className="text-[#64748B] font-medium">Your personalized daily practice question</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="neo-card flex items-center gap-4 px-6 py-4 shadow-float-pink">
                            <Flame className="w-7 h-7 text-[#F472B6]" />
                            <div>
                                <div className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Streak</div>
                                <div className="font-extrabold text-2xl text-[#0A192F] tabular-nums leading-none">
                                    {checkinState.streak} <span className="text-sm text-[#64748B] font-medium">days</span>
                                </div>
                            </div>
                        </div>

                        <div className="neo-card flex items-center gap-4 px-6 py-4 shadow-float-cyan">
                            <div className="text-3xl">{levelInfo.badge}</div>
                            <div>
                                <div className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Level {levelInfo.level}</div>
                                <div className="font-extrabold text-lg text-[#0A192F] tracking-tight leading-none">{levelInfo.name}</div>
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
                            className="flex flex-col items-center justify-center py-32 bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[32px]"
                        >
                            <div className="w-12 h-12 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin mb-6" />
                            <p className="font-bold text-[#64748B] text-sm">Loading your daily question...</p>
                        </motion.div>
                    )}

                    {state === 'question' && question && (
                        <motion.div
                            key="question"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="neo-card overflow-hidden shadow-float-cyan"
                        >
                            <div className="bg-[#F8FAFF] px-8 py-6 border-b border-[#0A192F]/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[14px] flex items-center justify-center text-[#00D1FF]">
                                        <Brain className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight leading-none mb-1">Daily Power Up</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-[#00D1FF]/10 text-[#00D1FF] text-xs font-bold rounded-full border border-[#00D1FF]/20">{question.domain}</span>
                                            <span className="text-xs text-[#64748B] font-medium">{question.subdomain}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[#00D1FF] font-extrabold text-2xl tabular-nums">+{isCorrect === null ? '60' : isCorrect ? '60' : '40'} <span className="text-sm text-[#64748B] font-medium">XP</span></div>
                                </div>
                            </div>

                            <div className="p-8 md:p-12">
                                <div className="relative mb-10 pl-5 border-l-4 border-[#00D1FF]">
                                    <p className="text-2xl font-semibold text-[#0A192F] leading-relaxed">{question.question}</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {question.options.map((option, index) => {
                                        let classes = 'bg-[#F8FAFF] border-2 border-[#0A192F]/5 hover:border-[#00D1FF]/30 hover:scale-[1.01] text-[#0A192F]';

                                        if (selectedAnswer !== null) {
                                            if (index === question.correctIndex) {
                                                classes = 'bg-[#34D399]/10 border-2 border-[#34D399]/40 text-[#34D399]';
                                            } else if (index === selectedAnswer && !isCorrect) {
                                                classes = 'bg-red-50 border-2 border-red-300 text-red-500';
                                            } else {
                                                classes = 'bg-[#F8FAFF] border-2 border-[#0A192F]/5 opacity-40 text-[#64748B]';
                                            }
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(index)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full p-5 rounded-[16px] ${classes} text-left font-medium text-base transition-all disabled:cursor-not-allowed flex items-center justify-between`}
                                            >
                                                <span className="leading-snug">{option}</span>
                                                {selectedAnswer !== null && index === question.correctIndex && (
                                                    <Check className="w-6 h-6 shrink-0 text-[#34D399] stroke-[3px]" />
                                                )}
                                                {selectedAnswer === index && !isCorrect && (
                                                    <X className="w-6 h-6 shrink-0 text-red-500 stroke-[3px]" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {selectedAnswer !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-8 p-6 bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[20px]"
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-1.5 bg-[#00D1FF]/10 rounded-lg">
                                                <Sparkles className="w-4 h-4 text-[#00D1FF]" />
                                            </div>
                                            <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Atlas Insight</p>
                                        </div>
                                        <p className="text-base font-medium leading-relaxed text-[#0A192F]">{question.explanation}</p>
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
                            className="neo-card text-center py-16 shadow-float-cyan"
                        >
                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                                className={`w-24 h-24 mx-auto mb-8 rounded-[24px] flex items-center justify-center ${isCorrect ? 'bg-[#34D399]/10 text-[#34D399]' : 'bg-[#00D1FF]/10 text-[#00D1FF]'} shadow-float-cyan`}
                            >
                                {isCorrect ? (
                                    <Trophy size={48} strokeWidth={1.5} />
                                ) : (
                                    <Target size={48} strokeWidth={1.5} />
                                )}
                            </motion.div>

                            <h2 className="text-4xl font-extrabold text-[#0A192F] tracking-tight mb-3">
                                {isCorrect ? 'Nailed it!' : 'Good try!'}
                            </h2>
                            <p className="text-[#64748B] font-medium mb-10 text-lg leading-relaxed max-w-md mx-auto">
                                {isCorrect
                                    ? "Great work! Keep building that streak."
                                    : "Every mistake is a learning opportunity. Keep going!"}
                            </p>

                            <div className="flex flex-col md:flex-row justify-center gap-5 mb-10 max-w-sm mx-auto">
                                <div className="neo-card flex-1 text-center py-5 shadow-float-cyan">
                                    <Zap className="w-7 h-7 mx-auto mb-2 text-[#00D1FF]" />
                                    <div className="text-3xl font-extrabold text-[#0A192F] tabular-nums">+{checkinResult.xpEarned}</div>
                                    <div className="text-xs font-bold text-[#64748B] mt-1">XP Earned</div>
                                </div>

                                <div className="neo-card flex-1 text-center py-5 shadow-float-pink">
                                    <Flame className="w-7 h-7 mx-auto mb-2 text-[#F472B6]" />
                                    <div className="text-3xl font-extrabold text-[#0A192F] tabular-nums">{checkinResult.streak}</div>
                                    <div className="text-xs font-bold text-[#64748B] mt-1">Day Streak</div>
                                </div>
                            </div>

                            <button
                                onClick={handleContinue}
                                className="neo-button px-10 py-4 text-base mx-auto flex items-center gap-3"
                            >
                                Continue <ArrowRight size={20} strokeWidth={2.5} />
                            </button>
                        </motion.div>
                    )}

                    {state === 'mission' && (
                        <motion.div
                            key="mission"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-10"
                        >
                            <div className="grid lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    {todayMission && (
                                        <div className="neo-card shadow-float-cyan">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[14px] flex items-center justify-center text-[#00D1FF]">
                                                        <Target className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-0.5">Today's Focus</p>
                                                        <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">{todayMission.plan.subject}</h3>
                                                    </div>
                                                </div>
                                                <span className="px-3 py-1 rounded-full bg-[#00D1FF]/10 border border-[#00D1FF]/20 text-[#00D1FF] text-xs font-bold">Day {todayMission.dayNumber}</span>
                                            </div>

                                            <div className="bg-[#F8FAFF] border-2 border-[#0A192F]/5 p-6 rounded-[16px] mb-6">
                                                <h4 className="text-lg font-extrabold text-[#0A192F] tracking-tight mb-1">{todayMission.task?.topic || 'General Practice'}</h4>
                                                <p className="font-medium text-[#64748B] text-sm leading-relaxed">{todayMission.task?.description}</p>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <Link
                                                    to="/atlas"
                                                    className="neo-button py-4 text-base flex items-center justify-center gap-3"
                                                >
                                                    <Brain className="w-5 h-5" /> Launch Atlas
                                                </Link>
                                                <Link
                                                    to="/sat-simulator"
                                                    className="py-4 rounded-[16px] border-2 border-[#0A192F]/10 text-[#0A192F] font-bold text-base text-center hover:border-[#00D1FF]/30 hover:text-[#00D1FF] transition-all flex items-center justify-center gap-3"
                                                >
                                                    <Activity className="w-5 h-5" /> Simulator
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    <div className="neo-card">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[12px] flex items-center justify-center text-[#00D1FF]">
                                                <Zap className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">Study Your Own Way</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { type: 'pdf', icon: FileUp, label: 'PDF' },
                                                { type: 'link', icon: Globe, label: 'Web Link' },
                                                { type: 'youtube', icon: Youtube, label: 'YouTube', color: 'text-red-500' },
                                            ].map((item) => (
                                                <button
                                                    key={item.type}
                                                    onClick={() => handleMagicIngest(item.type)}
                                                    className="bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[16px] p-5 flex flex-col items-center gap-3 hover:border-[#00D1FF]/30 hover:bg-[#00D1FF]/5 transition-all group"
                                                >
                                                    <item.icon className={`w-8 h-8 ${item.color || 'text-[#64748B]'} group-hover:scale-110 transition-transform`} />
                                                    <span className="text-xs font-bold text-[#64748B] group-hover:text-[#0A192F] transition-colors">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="neo-card">
                                        <div className="flex items-center gap-3 mb-5">
                                            <Activity className="w-5 h-5 text-[#00D1FF]" />
                                            <h4 className="text-base font-extrabold text-[#0A192F] tracking-tight">Activity Map</h4>
                                        </div>
                                        <div className="bg-[#F8FAFF] rounded-[16px] border-2 border-[#0A192F]/5 p-3">
                                            <MasteryHeatmap />
                                        </div>
                                    </div>

                                    <div className="neo-card border-l-4 border-amber-400">
                                        <div className="flex items-center gap-3 mb-5">
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                            <h4 className="text-base font-extrabold text-[#0A192F] tracking-tight">Knowledge Gaps</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {logicGaps.length > 0 ? logicGaps.map((gap, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-[#F8FAFF] border-2 border-[#0A192F]/5 p-4 rounded-[14px] group hover:border-amber-200 transition-all cursor-pointer"
                                                    onClick={() => handlePlugGap(gap)}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-[#00D1FF] uppercase tracking-widest mb-0.5">{gap.domain}</div>
                                                            <h5 className="font-extrabold text-sm text-[#0A192F] truncate">{gap.subdomain}</h5>
                                                        </div>
                                                        <div className="text-right pl-3">
                                                            <div className="text-xl font-extrabold text-amber-500 leading-none">{gap.mastery_score}%</div>
                                                            <div className="text-[10px] font-bold text-[#64748B]">Mastery</div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2 border-t border-[#0A192F]/5 flex items-center gap-2 text-xs font-bold text-[#00D1FF] group-hover:translate-x-1 transition-transform">
                                                        Plug with Atlas <ChevronRight size={12} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-[#64748B] font-medium text-sm border-2 border-dashed border-[#0A192F]/5 rounded-[14px]">
                                                    No gaps detected yet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 pt-8 border-t border-[#0A192F]/5">
                                {[
                                    { label: 'Curriculum', icon: List, href: '/curriculum' },
                                    { label: 'Videos', icon: Youtube, href: '/videos' },
                                    { label: 'Feynman', icon: Sparkles, href: '/feynman' },
                                    { label: 'Roadmaps', icon: Activity, href: '/roadmaps' },
                                    { label: 'Social', icon: LayoutDashboard, href: '/social' },
                                    { label: 'SYOW', icon: Monitor, href: '/syow' },
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.href}
                                        className="bg-[#F8FAFF] border-2 border-[#0A192F]/5 p-5 rounded-[16px] text-center hover:border-[#00D1FF]/30 hover:bg-[#00D1FF]/5 transition-all hover:-translate-y-1 group"
                                    >
                                        <action.icon className="w-7 h-7 mb-2 mx-auto text-[#64748B] group-hover:text-[#00D1FF] transition-colors" />
                                        <span className="text-xs font-bold text-[#64748B] group-hover:text-[#0A192F] transition-colors">{action.label}</span>
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
