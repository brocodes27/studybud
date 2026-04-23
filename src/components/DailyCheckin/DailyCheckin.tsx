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

    useEffect(() => {
        if (user?.id) {
            loadCheckinState();
            loadLogicGaps();
        }
    }, [user?.id]);

    const loadCheckinState = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: existingCheckin } = await supabase
                .from('daily_checkins')
                .select('*')
                .eq('user_id', user.id)
                .eq('checkin_date', today)
                .maybeSingle();

            const gamification = await getUserGamification(user.id);

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
            const { data: goalsList } = await supabase
                .from('user_study_goals')
                .select('*')
                .eq('user_id', user.id)
                .limit(1);

            const goals = goalsList?.[0];

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

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const questionData = JSON.parse(jsonMatch[0]);
                setQuestion({ id: crypto.randomUUID(), ...questionData });
            } else {
                throw new Error('Failed to parse question');
            }
        } catch (error) {
            console.error('Error generating question:', error);
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
            const result = await recordDailyCheckin(user.id, question.domain, correct);
            setCheckinResult(result);
            setTimeout(() => setState('result'), 1500);
        } catch (error) {
            console.error('Error recording checkin:', error);
            setState('result');
        }
    };

    const handleContinue = () => setState('mission');

    const handleMagicIngest = (type: string) => {
        localStorage.setItem('syow_preselect_type', type);
        navigate('/syow');
    };

    const handlePlugGap = (gap: any) => {
        const message = `ATLAS, I have a logic gap in **"${gap.domain} : ${gap.subdomain}"**. My current mastery is only ${gap.mastery_score}%. \n\nLet's start a Feynman Session to plug this gap immediately.`;
        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { detail: { message, voice: true } }));
        navigate('/atlas', { state: { initialMessage: message } });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const levelInfo = calculateLevel(checkinState.totalXp);

    return (
        <div className="pb-20 animate-fade-in">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-[#0A192F]/[0.06] rounded-full shadow-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                                {getGreeting()}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0A192F] leading-none font-display">
                            Daily <span className="text-gradient">Intel</span>
                        </h1>
                        <p className="text-[#64748B] font-medium text-sm">Your personalized daily practice question</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#0A192F]/[0.06] shadow-xs">
                            <Flame className="w-5 h-5 text-[#F472B6]" />
                            <div>
                                <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Streak</div>
                                <div className="font-extrabold text-lg text-[#0A192F] tabular-nums leading-none">
                                    {checkinState.streak} <span className="text-xs text-[#94A3B8] font-medium">days</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-[#0A192F]/[0.06] shadow-xs">
                            <span className="text-xl">{levelInfo.badge}</span>
                            <div>
                                <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Level {levelInfo.level}</div>
                                <div className="font-bold text-sm text-[#0A192F] tracking-tight leading-none">{levelInfo.name}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* LOADING */}
                    {state === 'loading' && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-32 bg-white/60 backdrop-blur-sm border border-[#0A192F]/[0.06] rounded-[24px]">
                            <div className="w-10 h-10 border-2 border-[#6366F1]/20 border-t-[#6366F1] rounded-full animate-spin mb-5" />
                            <p className="font-semibold text-[#64748B] text-sm">Loading your daily question...</p>
                        </motion.div>
                    )}

                    {/* QUESTION */}
                    {state === 'question' && question && (
                        <motion.div key="question" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-neo-lg overflow-hidden">
                            {/* Header bar */}
                            <div className="bg-[#FAFBFF] px-6 md:px-8 py-5 border-b border-[#0A192F]/[0.04] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                        style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                                        <Brain className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-extrabold text-[#0A192F] tracking-tight leading-none mb-1 font-display">Daily Power Up</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-[#6366F1]/[0.08] text-[#6366F1] text-[11px] font-bold rounded-md">{question.domain}</span>
                                            <span className="text-[11px] text-[#94A3B8] font-medium">{question.subdomain}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-gradient font-extrabold text-xl tabular-nums">+{isCorrect === null ? '60' : isCorrect ? '60' : '40'}</div>
                                    <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">XP</div>
                                </div>
                            </div>

                            <div className="p-6 md:p-10">
                                {/* Question text */}
                                <div className="relative mb-8 pl-5 border-l-[3px] rounded-sm" style={{ borderColor: '#6366F1' }}>
                                    <p className="text-xl md:text-2xl font-semibold text-[#0A192F] leading-relaxed">{question.question}</p>
                                </div>

                                {/* Options */}
                                <div className="grid md:grid-cols-2 gap-3">
                                    {question.options.map((option, index) => {
                                        let classes = 'bg-[#FAFBFF] border-[1.5px] border-[#0A192F]/[0.06] hover:border-[#6366F1]/30 hover:bg-[#6366F1]/[0.03] text-[#0A192F]';

                                        if (selectedAnswer !== null) {
                                            if (index === question.correctIndex) {
                                                classes = 'bg-[#34D399]/[0.08] border-[1.5px] border-[#34D399]/30 text-[#0A192F]';
                                            } else if (index === selectedAnswer && !isCorrect) {
                                                classes = 'bg-red-50 border-[1.5px] border-red-200 text-red-600';
                                            } else {
                                                classes = 'bg-[#FAFBFF] border-[1.5px] border-[#0A192F]/[0.04] opacity-40 text-[#94A3B8]';
                                            }
                                        }

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(index)}
                                                disabled={selectedAnswer !== null}
                                                className={`w-full p-4 rounded-xl ${classes} text-left font-medium text-[15px] transition-all disabled:cursor-not-allowed flex items-center justify-between`}
                                            >
                                                <span className="leading-snug">{option}</span>
                                                {selectedAnswer !== null && index === question.correctIndex && (
                                                    <Check className="w-5 h-5 shrink-0 text-[#34D399]" />
                                                )}
                                                {selectedAnswer === index && !isCorrect && (
                                                    <X className="w-5 h-5 shrink-0 text-red-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Explanation */}
                                {selectedAnswer !== null && (
                                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                        className="mt-6 p-5 bg-gradient-to-r from-[#6366F1]/[0.04] to-[#00D1FF]/[0.04] border border-[#6366F1]/10 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-4 h-4 text-[#6366F1]" />
                                            <p className="text-[11px] font-bold text-[#6366F1] uppercase tracking-wider">Atlas Insight</p>
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed text-[#0A192F]">{question.explanation}</p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* RESULT */}
                    {state === 'result' && checkinResult && (
                        <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-neo-lg text-center py-14 px-6">
                            <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                                className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-neo-lg ${
                                    isCorrect ? 'bg-gradient-to-br from-[#34D399] to-[#00D1FF]' : 'bg-gradient-to-br from-[#6366F1] to-[#00D1FF]'
                                }`}
                            >
                                {isCorrect ? (
                                    <Trophy size={36} className="text-white" />
                                ) : (
                                    <Target size={36} className="text-white" />
                                )}
                            </motion.div>

                            <h2 className="text-3xl font-extrabold text-[#0A192F] tracking-tight mb-2 font-display">
                                {isCorrect ? 'Nailed it!' : 'Good try!'}
                            </h2>
                            <p className="text-[#64748B] font-medium mb-8 text-base leading-relaxed max-w-md mx-auto">
                                {isCorrect ? "Great work! Keep building that streak." : "Every mistake is a learning opportunity. Keep going!"}
                            </p>

                            <div className="flex justify-center gap-4 mb-8 max-w-xs mx-auto">
                                <div className="flex-1 bg-gradient-to-br from-[#00D1FF]/[0.08] to-[#6366F1]/[0.08] rounded-2xl p-4 border border-[#00D1FF]/10">
                                    <Zap className="w-5 h-5 mx-auto mb-1.5 text-[#6366F1]" />
                                    <div className="text-2xl font-extrabold text-[#0A192F] tabular-nums">+{checkinResult.xpEarned}</div>
                                    <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">XP</div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-[#F472B6]/[0.08] to-[#F59E0B]/[0.08] rounded-2xl p-4 border border-[#F472B6]/10">
                                    <Flame className="w-5 h-5 mx-auto mb-1.5 text-[#F472B6]" />
                                    <div className="text-2xl font-extrabold text-[#0A192F] tabular-nums">{checkinResult.streak}</div>
                                    <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Streak</div>
                                </div>
                            </div>

                            <button onClick={handleContinue} className="neo-button px-8 py-3.5 text-sm mx-auto group">
                                Continue <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    )}

                    {/* MISSION */}
                    {state === 'mission' && (
                        <motion.div key="mission" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                            <div className="grid lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    {/* Today's Focus */}
                                    {todayMission && (
                                        <div className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-neo p-6">
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                                        style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                                                        <Target className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-0.5">Today's Focus</p>
                                                        <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight font-display">{todayMission.plan.subject}</h3>
                                                    </div>
                                                </div>
                                                <span className="px-2.5 py-1 rounded-lg bg-[#6366F1]/[0.08] border border-[#6366F1]/10 text-[#6366F1] text-[11px] font-bold">
                                                    Day {todayMission.dayNumber}
                                                </span>
                                            </div>

                                            <div className="bg-[#FAFBFF] border border-[#0A192F]/[0.04] p-5 rounded-xl mb-5">
                                                <h4 className="text-base font-bold text-[#0A192F] tracking-tight mb-1">{todayMission.task?.topic || 'General Practice'}</h4>
                                                <p className="font-medium text-[#64748B] text-sm leading-relaxed">{todayMission.task?.description}</p>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <Link to="/atlas" className="neo-button py-3.5 text-sm">
                                                    <Brain className="w-4 h-4" /> Launch Atlas
                                                </Link>
                                                <Link to="/sat-simulator"
                                                    className="py-3.5 rounded-xl border-[1.5px] border-[#0A192F]/[0.08] text-[#0A192F] font-semibold text-sm text-center hover:border-[#6366F1]/20 hover:bg-[#6366F1]/[0.03] transition-all flex items-center justify-center gap-2">
                                                    <Activity className="w-4 h-4" /> Simulator
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {/* SYOW */}
                                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-xs p-6">
                                        <div className="flex items-center gap-2.5 mb-5">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D1FF, #6366F1)' }}>
                                                <Zap className="w-4 h-4 text-white" />
                                            </div>
                                            <h3 className="text-base font-bold text-[#0A192F] tracking-tight font-display">Study Your Own Way</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { type: 'pdf', icon: FileUp, label: 'PDF', gradient: 'from-[#F472B6] to-[#F59E0B]' },
                                                { type: 'link', icon: Globe, label: 'Web Link', gradient: 'from-[#00D1FF] to-[#6366F1]' },
                                                { type: 'youtube', icon: Youtube, label: 'YouTube', gradient: 'from-[#FB7185] to-[#F472B6]' },
                                            ].map((item) => (
                                                <button
                                                    key={item.type}
                                                    onClick={() => handleMagicIngest(item.type)}
                                                    className="bg-[#FAFBFF] border border-[#0A192F]/[0.04] rounded-xl p-4 flex flex-col items-center gap-2.5 hover:border-[#6366F1]/20 hover:bg-[#6366F1]/[0.03] transition-all group"
                                                >
                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                                                        <item.icon className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#0A192F] transition-colors">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right sidebar */}
                                <div className="space-y-6">
                                    {/* Activity Map */}
                                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-xs p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity className="w-4 h-4 text-[#6366F1]" />
                                            <h4 className="text-sm font-bold text-[#0A192F] tracking-tight">Activity Map</h4>
                                        </div>
                                        <div className="bg-[#FAFBFF] rounded-xl border border-[#0A192F]/[0.04] p-2.5">
                                            <MasteryHeatmap />
                                        </div>
                                    </div>

                                    {/* Knowledge Gaps */}
                                    <div className="bg-white/80 backdrop-blur-xl rounded-[24px] border border-[#0A192F]/[0.06] shadow-xs p-5 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#F59E0B] to-[#FB7185] rounded-r" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                                            <h4 className="text-sm font-bold text-[#0A192F] tracking-tight">Knowledge Gaps</h4>
                                        </div>
                                        <div className="space-y-2.5">
                                            {logicGaps.length > 0 ? logicGaps.map((gap, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-[#FAFBFF] border border-[#0A192F]/[0.04] p-3.5 rounded-xl group hover:border-[#F59E0B]/20 transition-all cursor-pointer"
                                                    onClick={() => handlePlugGap(gap)}
                                                >
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider mb-0.5">{gap.domain}</div>
                                                            <h5 className="font-bold text-sm text-[#0A192F] truncate">{gap.subdomain}</h5>
                                                        </div>
                                                        <div className="text-right pl-3">
                                                            <div className="text-lg font-extrabold text-[#F59E0B] leading-none">{gap.mastery_score}%</div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2 border-t border-[#0A192F]/[0.04] flex items-center gap-1.5 text-[11px] font-bold text-[#6366F1] group-hover:translate-x-1 transition-transform">
                                                        Plug with Atlas <ChevronRight size={11} />
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-6 text-[#94A3B8] font-medium text-sm border border-dashed border-[#0A192F]/[0.06] rounded-xl">
                                                    No gaps detected yet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-6 border-t border-[#0A192F]/[0.04]">
                                {[
                                    { label: 'Curriculum', icon: List, href: '/curriculum', gradient: 'from-[#00D1FF] to-[#6366F1]' },
                                    { label: 'Videos', icon: Youtube, href: '/videos', gradient: 'from-[#FB7185] to-[#F472B6]' },
                                    { label: 'Feynman', icon: Sparkles, href: '/feynman', gradient: 'from-[#6366F1] to-[#F472B6]' },
                                    { label: 'Roadmaps', icon: Activity, href: '/roadmaps', gradient: 'from-[#34D399] to-[#00D1FF]' },
                                    { label: 'Social', icon: LayoutDashboard, href: '/social', gradient: 'from-[#F59E0B] to-[#FB7185]' },
                                    { label: 'SYOW', icon: Monitor, href: '/syow', gradient: 'from-[#00D1FF] to-[#34D399]' },
                                ].map((action) => (
                                    <Link
                                        key={action.label}
                                        to={action.href}
                                        className="bg-white/60 backdrop-blur-sm border border-[#0A192F]/[0.04] p-4 rounded-xl text-center hover:border-[#6366F1]/15 hover:shadow-neo-sm transition-all hover:-translate-y-0.5 group"
                                    >
                                        <div className={`w-9 h-9 mb-2 mx-auto rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                                            <action.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-[#64748B] group-hover:text-[#0A192F] transition-colors">{action.label}</span>
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
