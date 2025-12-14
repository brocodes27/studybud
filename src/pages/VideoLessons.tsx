import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Play, Video, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { BlackboardPlayer } from '../components/BlackboardPlayer';
import { format } from 'date-fns';

interface Lesson {
    day: number;
    date: string;
    topic: string;
    description: string;
    subject: string;
    plan_id: string;
    plan_name?: string;
    chapter?: string;
    question_type: string;
}

interface PlanFolder {
    id: string;
    name: string;
    subject: string;
    lessonCount: number;
}

interface ChapterFolder {
    name: string;
    lessonCount: number;
}

export const VideoLessons = () => {
    const { user } = useAuth() as any;
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingLesson, setPlayingLesson] = useState<{ topic: string, subject: string } | null>(null);

    // Navigation State
    const [viewMode, setViewMode] = useState<'plans' | 'chapters' | 'lessons'>('plans');
    const [selectedPlan, setSelectedPlan] = useState<PlanFolder | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

    useEffect(() => {
        fetchLessons();
    }, [user]);

    const fetchLessons = async () => {
        try {
            const { data: plans, error } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const allLessons: Lesson[] = [];

            plans?.forEach((plan: any) => {
                if (plan.plan?.daily_schedule) {
                    plan.plan.daily_schedule.forEach((day: any) => {
                        // Smart Chapter Extraction:
                        // 1. Use explicit 'chapter' if available
                        // 2. If 'topic' has the format "ChapterName: TopicName", separate them
                        // 3. Fallback to 'Uncategorized'
                        let finalChapter = day.chapter;
                        let finalTopic = day.topic;

                        if (!finalChapter && day.topic.includes(':')) {
                            const parts = day.topic.split(':');
                            if (parts.length > 1) {
                                finalChapter = parts[0].trim();
                                finalTopic = parts.slice(1).join(':').trim();
                            }
                        }

                        allLessons.push({
                            day: day.day,
                            date: day.date,
                            topic: finalTopic, // Use clean topic if split
                            description: day.description,
                            subject: plan.subject,
                            plan_id: plan.id,
                            plan_name: plan.plan_name || `${plan.subject} Plan`,
                            chapter: finalChapter || 'General Checkpoint', // Better default than 'Uncategorized'
                            question_type: day.question_type
                        });
                    });
                }
            });

            // Sort by date descending (newest first)
            setLessons(allLessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const getQuestionTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            'MCQ': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            'Short Answer': 'bg-green-500/20 text-green-300 border-green-500/30',
            'Numerical': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            'Long Answer': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            'Case Study': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            'Practice Test': 'bg-red-500/20 text-red-300 border-red-500/30',
            'Revision': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        };

        for (const key in colors) {
            if (type.toLowerCase().includes(key.toLowerCase())) return colors[key];
        }
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    };

    // Derived Data for Folders
    const plans: PlanFolder[] = Array.from(new Set(lessons.map(l => l.plan_id))).map(id => {
        const planLessons = lessons.filter(l => l.plan_id === id);
        return {
            id,
            name: planLessons[0]?.plan_name || 'Unknown Plan',
            subject: planLessons[0]?.subject || 'Unknown',
            lessonCount: planLessons.length
        };
    });

    const chapters: ChapterFolder[] = selectedPlan
        ? Array.from(new Set(lessons.filter(l => l.plan_id === selectedPlan.id).map(l => l.chapter!))).map(name => ({
            name,
            lessonCount: lessons.filter(l => l.plan_id === selectedPlan.id && l.chapter === name).length
        }))
        : [];

    const currentLessons = selectedPlan && selectedChapter
        ? lessons.filter(l => l.plan_id === selectedPlan.id && l.chapter === selectedChapter)
        : [];

    return (
        <div className="space-y-8 animate-fade-in relative min-h-screen">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-neon-green/10 rounded-full blur-3xl -z-10"></div>

            {playingLesson && (
                <BlackboardPlayer
                    topic={playingLesson.topic}
                    subject={playingLesson.subject}
                    onClose={() => setPlayingLesson(null)}
                />
            )}

            <div className="flex items-center gap-4 mb-8">
                {viewMode !== 'plans' && (
                    <button
                        onClick={() => {
                            if (viewMode === 'lessons') {
                                setViewMode('chapters');
                                setSelectedChapter(null);
                            } else {
                                setViewMode('plans');
                                setSelectedPlan(null);
                            }
                        }}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <Clock className="w-6 h-6 rotate-180 transform" /> {/* Using Clock as simple back icon fallback if ArrowLeft unavailable, or just recycle icons */}
                    </button>
                )}
                <div className="bg-gradient-to-br from-neon-green to-emerald-600 p-4 rounded-2xl shadow-lg shadow-neon-green/20">
                    <Video className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">
                        {viewMode === 'plans' ? 'Video Library' :
                            <span className="flex items-center gap-2">
                                <span onClick={() => { setViewMode('plans'); setSelectedPlan(null); }} className="cursor-pointer hover:text-neon-green transition-colors">Library</span>
                                <span className="text-gray-600">/</span>
                                {viewMode === 'chapters' ? selectedPlan?.name :
                                    <span className="flex items-center gap-2">
                                        <span onClick={() => { setViewMode('chapters'); setSelectedChapter(null); }} className="cursor-pointer hover:text-neon-green transition-colors">{selectedPlan?.name}</span>
                                        <span className="text-gray-600">/</span>
                                        {selectedChapter}
                                    </span>}
                            </span>}
                    </h1>
                    <p className="text-gray-400">
                        {viewMode === 'plans' ? 'Select a study plan to view lessons' :
                            viewMode === 'chapters' ? 'Select a chapter to browse topics' :
                                `${currentLessons.length} lessons available`}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-green"></div>
                </div>
            ) : (
                <>
                    {/* PLANS VIEW */}
                    {viewMode === 'plans' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.length === 0 ? (
                                <div className="col-span-full glass-panel p-12 rounded-3xl border border-white/10 text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
                                        <AlertCircle className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">No Study Plans Found</h3>
                                    <p className="text-gray-400 max-w-md mx-auto">
                                        Create a study plan to generate your personalized video lessons.
                                    </p>
                                </div>
                            ) : plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => {
                                        setSelectedPlan(plan);
                                        // Calculate chapters for this plan immediately to check count
                                        const planChapters = Array.from(new Set(lessons.filter(l => l.plan_id === plan.id).map(l => l.chapter!)));

                                        if (planChapters.length === 1) {
                                            // Auto-skip to lessons if only 1 chapter
                                            setSelectedChapter(planChapters[0]);
                                            setViewMode('lessons');
                                        } else {
                                            setViewMode('chapters');
                                        }
                                    }}
                                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-neon-green/40 cursor-pointer transition-all hover:bg-white/5 group"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-neon-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-6 h-6 text-neon-blue" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-neon-blue transition-colors">{plan.name}</h3>
                                            <span className="text-sm text-gray-400">{plan.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-500 mt-4 pt-4 border-t border-white/5">
                                        <span>{plan.lessonCount} Lessons</span>
                                        <span className="group-hover:translate-x-1 transition-transform">View →</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CHAPTERS VIEW */}
                    {viewMode === 'chapters' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {chapters.map((chapter) => (
                                <div
                                    key={chapter.name}
                                    onClick={() => {
                                        setSelectedChapter(chapter.name);
                                        setViewMode('lessons');
                                    }}
                                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-purple-500/40 cursor-pointer transition-all hover:bg-white/5 group"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Video className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">{chapter.name}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-500 mt-4 pt-4 border-t border-white/5">
                                        <span>{chapter.lessonCount} Topics</span>
                                        <span className="group-hover:translate-x-1 transition-transform">View →</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LESSONS VIEW */}
                    {viewMode === 'lessons' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {currentLessons.map((lesson, index) => (
                                <div key={`${lesson.plan_id}-${index}`} className="glass-card p-6 rounded-2xl border border-white/10 hover:border-neon-green/40 transition-all flex flex-col h-full group bg-black/20 hover:bg-black/40">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-1 rounded-md">{format(new Date(lesson.date), 'MMM d')}</span>
                                            <span className="text-xs font-bold text-neon-blue bg-neon-blue/10 px-2 py-1 rounded-md border border-neon-blue/20">{lesson.subject}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getQuestionTypeColor(lesson.question_type)}`}>
                                            {lesson.question_type}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 min-h-[3.5rem] group-hover:text-neon-green transition-colors">
                                        {lesson.topic}
                                    </h3>

                                    <p className="text-sm text-gray-400 line-clamp-3 mb-6 flex-grow">
                                        {lesson.description}
                                    </p>

                                    <button
                                        onClick={() => setPlayingLesson({ topic: lesson.topic, subject: lesson.subject })}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-neon-green/20 to-emerald-500/20 text-neon-green font-bold border border-neon-green/30 hover:bg-neon-green/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all group-hover:scale-[1.02]"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        Watch Lesson
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
