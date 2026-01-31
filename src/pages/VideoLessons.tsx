import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    Video,
    BookOpen,
    AlertCircle,
    Atom,
    Calculator,
    FlaskConical,
    Globe2,
    Sparkles,
    Loader2,
    ChevronLeft
} from 'lucide-react';

import { format } from 'date-fns';
import { BlackboardPlayer } from '../components/BlackboardPlayer';
import { ManimVideoPlayer } from '../components/ManimVideoPlayer';

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

type SubjectVisual = {
    color: string;
    icon: JSX.Element;
};

const subjectVisuals: Record<string, SubjectVisual> = {
    math: {
        color: 'bg-neo-secondary',
        icon: <Calculator className="w-8 h-8 stroke-[3px]" />
    },
    physics: {
        color: 'bg-neo-accent',
        icon: <Atom className="w-8 h-8 stroke-[3px]" />
    },
    chemistry: {
        color: 'bg-neo-bg',
        icon: <FlaskConical className="w-8 h-8 stroke-[3px]" />
    },
    biology: {
        color: 'bg-neo-muted',
        icon: <Sparkles className="w-8 h-8 stroke-[3px]" />
    },
    geography: {
        color: 'bg-neo-secondary',
        icon: <Globe2 className="w-8 h-8 stroke-[3px]" />
    },
    general: {
        color: 'bg-white',
        icon: <Sparkles className="w-8 h-8 stroke-[3px]" />
    }
};

const getSubjectVisual = (subject: string): SubjectVisual => {
    const key = subject?.toLowerCase() || '';
    if (key.includes('math') || key.includes('algebra') || key.includes('calculus')) return subjectVisuals.math;
    if (key.includes('phys')) return subjectVisuals.physics;
    if (key.includes('chem')) return subjectVisuals.chemistry;
    if (key.includes('bio')) return subjectVisuals.biology;
    if (key.includes('geo') || key.includes('earth')) return subjectVisuals.geography;
    return subjectVisuals.general;
};

const getCleanTopic = (topic: string) => {
    return topic
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .substring(0, 50)
        .trim();
};

export const VideoLessons = () => {
    const { user } = useAuth() as any;
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentGenerationId, setCurrentGenerationId] = useState<string | undefined>();
    const [playingLesson, setPlayingLesson] = useState<{ topic: string, subject: string } | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    // Navigation State
    const [viewMode, setViewMode] = useState<'plans' | 'chapters' | 'lessons'>('plans');
    const [selectedPlan, setSelectedPlan] = useState<PlanFolder | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [renderMode, setRenderMode] = useState<'classic' | 'premium' | null>(null);
    const [generations, setGenerations] = useState<Record<string, any>>({});

    useEffect(() => {
        if (!user) return;

        const fetchGens = async () => {
            const { data } = await supabase
                .from('video_generations')
                .select('*')
                .eq('user_id', user.id);

            if (data) {
                const genMap: Record<string, any> = {};
                data.forEach(g => {
                    const cleaned = getCleanTopic(g.topic).toLowerCase();
                    genMap[cleaned] = g;
                });
                setGenerations(genMap);
            }
        };
        fetchGens();

        const channel = supabase
            .channel('video-lessons-status')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'video_generations', filter: `user_id=eq.${user.id}` },
                (payload) => {
                    const newItem = payload.new as any;
                    const cleaned = getCleanTopic(newItem.topic).toLowerCase();
                    setGenerations(prev => ({
                        ...prev,
                        [cleaned]: newItem
                    }));
                }
            ).subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

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
                            topic: finalTopic,
                            description: day.description,
                            subject: plan.subject,
                            plan_id: plan.id,
                            plan_name: plan.plan_name || `${plan.subject} Plan`,
                            chapter: finalChapter || 'General Checkpoint',
                            question_type: day.question_type
                        });
                    });
                }
            });

            setLessons(allLessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const getQuestionTypeBadge = (type: string) => (
        <span className="text-[10px] font-black uppercase tracking-widest border-2 border-black px-2 py-0.5 bg-white shadow-[2px_2px_0px_0px_#000]">
            {type}
        </span>
    );

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

    const handlePlayPremium = async (lesson: Lesson) => {
        const cleanTopic = getCleanTopic(lesson.topic);
        const topicKey = cleanTopic.toLowerCase();
        const existingGen = generations[topicKey];

        setCurrentGenerationId(undefined);
        setIsPreparing(true);
        setGenerationError(null);

        setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });
        setRenderMode('premium');

        if (existingGen) {
            if (existingGen.status !== 'failed') {
                setCurrentGenerationId(existingGen.id);
                setIsPreparing(false);
                return;
            }
        }

        try {
            const API_URL = import.meta.env.VITE_VIDEO_GEN_URL || 'http://13.211.215.182:3001/api/generate';

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    topic: cleanTopic,
                    userId: user?.id,
                    script: lesson.description || ""
                })
            });

            if (response.ok) {
                const resData = await response.json();
                if (resData.generationId) {
                    setCurrentGenerationId(resData.generationId);
                } else if (resData.error) {
                    setGenerationError(`Engine Error: ${resData.error}`);
                }
            } else {
                const errText = await response.text();
                setGenerationError(`Server error (${response.status}): ${errText.substring(0, 100)}`);
            }
        } catch (e: any) {
            console.error("Error starting generation:", e);
            setGenerationError(`Network error: ${e.message || "Failed to reach generation server"}`);
        } finally {
            setIsPreparing(false);
        }
    };

    return (
        <div className="space-y-12 animate-fade-in relative min-h-screen pb-20">
            {playingLesson && renderMode === 'classic' && (
                <BlackboardPlayer
                    topic={playingLesson.topic}
                    subject={playingLesson.subject}
                    onClose={() => { setPlayingLesson(null); setRenderMode(null); }}
                />
            )}

            {playingLesson && renderMode === 'premium' && (
                <ManimVideoPlayer
                    videoUrl={`${import.meta.env.VITE_VIDEO_SERVER_URL || 'http://13.211.215.182:3001'}/videos/${playingLesson.topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}.mp4`}
                    topic={playingLesson.topic}
                    generationId={currentGenerationId}
                    isPreparing={isPreparing}
                    error={generationError}
                    onClose={() => { setPlayingLesson(null); setRenderMode(null); setCurrentGenerationId(undefined); setIsPreparing(false); setGenerationError(null); }}
                />
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b-8 border-black pb-10">
                <div className="flex items-center gap-6">
                    <div className="bg-neo-accent border-4 border-black p-5 shadow-[8px_8px_0px_0px_#000] rotate-3">
                        <Video className="h-10 w-10 text-white stroke-[3px]" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-black uppercase tracking-tighter italic leading-none">
                            {viewMode === 'plans' ? 'VIDEO_ARCHIVE' :
                                viewMode === 'chapters' ? 'CHAPTER_INDEX' : 'TOPIC_NODES'}
                        </h1>
                        <p className="text-black/40 font-black uppercase tracking-widest text-sm mt-3 flex items-center gap-3">
                            {viewMode !== 'plans' && (
                                <button
                                    onClick={() => {
                                        if (viewMode === 'lessons') { setViewMode('chapters'); setSelectedChapter(null); }
                                        else { setViewMode('plans'); setSelectedPlan(null); }
                                    }}
                                    className="flex items-center gap-2 hover:text-black transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 stroke-[3px]" /> REVERT
                                </button>
                            )}
                            {viewMode === 'plans' ? 'PROTOCOL: KNOWLEDGE_RETRIEVAL_V1' :
                                viewMode === 'chapters' ? `PLAN: ${selectedPlan?.name.toUpperCase()}` :
                                    `SECTION: ${selectedChapter?.toUpperCase()}`}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-96 space-y-8">
                    <div className="w-24 h-24 border-8 border-black border-t-neo-accent animate-spin" />
                    <h3 className="text-3xl font-black text-black uppercase tracking-tighter italic">LOADING_ARCHIVES...</h3>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* PLANS VIEW */}
                    {viewMode === 'plans' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {plans.length === 0 ? (
                                <div className="col-span-full bg-white border-8 border-black p-20 shadow-[16px_16px_0px_0px_#000] text-center rotate-1">
                                    <div className="w-24 h-24 bg-neo-muted border-4 border-black flex items-center justify-center mx-auto mb-10 shadow-[8px_8px_0px_0px_#000]">
                                        <AlertCircle className="w-12 h-12 text-black stroke-[3px]" />
                                    </div>
                                    <h3 className="text-4xl font-black text-black uppercase tracking-tighter mb-4">NO_PLANS_DETECTED</h3>
                                    <p className="text-black/60 font-bold uppercase tracking-widest text-sm">INITIALIZE A STUDY SEQUENCE TO GENERATE VISUAL ASSETS.</p>
                                </div>
                            ) : plans.map((plan, idx) => (
                                <div
                                    key={plan.id}
                                    onClick={() => {
                                        setSelectedPlan(plan);
                                        const planChapters = Array.from(new Set(lessons.filter(l => l.plan_id === plan.id).map(l => l.chapter!)));
                                        if (planChapters.length === 1) { setSelectedChapter(planChapters[0]); setViewMode('lessons'); }
                                        else { setViewMode('chapters'); }
                                    }}
                                    className={`bg-white border-6 border-black p-8 shadow-[12px_12px_0px_0px_#000] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[18px_18px_0px_0px_#000] cursor-pointer transition-all group ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}
                                >
                                    <div className="flex items-center gap-6 mb-8">
                                        <div className="w-16 h-16 border-4 border-black bg-neo-secondary flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:rotate-12 transition-transform">
                                            <BookOpen className="w-8 h-8 text-black stroke-[3px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">{plan.name}</h3>
                                            <span className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2 block">{plan.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between font-black uppercase tracking-widest text-xs pt-6 border-t-4 border-black/10">
                                        <span className="bg-black text-white px-3 py-1 -rotate-2">{plan.lessonCount} NODES</span>
                                        <span className="text-neo-accent group-hover:translate-x-2 transition-transform italic">ACCESS_DIR »</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CHAPTERS VIEW */}
                    {viewMode === 'chapters' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {chapters.map((chapter, idx) => (
                                <div
                                    key={chapter.name}
                                    onClick={() => { setSelectedChapter(chapter.name); setViewMode('lessons'); }}
                                    className={`bg-white border-6 border-black p-8 shadow-[12px_12px_0px_0px_#000] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[18px_18px_0px_0px_#4D96FF] cursor-pointer transition-all group ${idx % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                                >
                                    <div className="flex items-center gap-6 mb-8">
                                        <div className="w-16 h-16 border-4 border-black bg-neo-bg flex items-center justify-center shadow-[4px_4px_0px_0px_#000] group-hover:-rotate-12 transition-transform">
                                            <Video className="w-8 h-8 text-black stroke-[3px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none line-clamp-1">{chapter.name}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between font-black uppercase tracking-widest text-xs pt-6 border-t-4 border-black/10">
                                        <span className="bg-black text-white px-3 py-1 rotate-1">{chapter.lessonCount} TOPICS</span>
                                        <span className="text-neo-bg group-hover:translate-x-2 transition-transform italic">SCAN_FLOW »</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LESSONS VIEW */}
                    {viewMode === 'lessons' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {currentLessons.map((lesson, idx) => {
                                const visual = getSubjectVisual(lesson.subject);
                                const cleanTopic = getCleanTopic(lesson.topic).toLowerCase();
                                const isGenerating = generations[cleanTopic]?.status === 'processing' || generations[cleanTopic]?.status === 'pending';

                                return (
                                    <div key={`${lesson.plan_id}-${idx}`} className={`bg-white border-6 border-black p-8 shadow-[12px_12px_0px_0px_#000] transition-all flex flex-col h-full group ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}>
                                        {/* Card Header Illustration */}
                                        <div className="relative mb-8 h-40 border-4 border-black bg-black overflow-hidden shadow-[4px_4px_0px_0px_#000]">
                                            <div className={`absolute inset-0 opacity-20 ${visual.color}`} />
                                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
                                            <div className="relative flex h-full items-center justify-center p-6 text-center flex-col gap-4">
                                                <div className={`w-16 h-16 border-4 border-black ${visual.color} flex items-center justify-center shadow-[4px_4px_0px_0px_#000] rotate-12 group-hover:rotate-0 transition-transform`}>
                                                    {visual.icon}
                                                </div>
                                                <p className="text-white font-black uppercase tracking-widest text-[10px] italic">NODE_{idx.toString().padStart(3, '0')}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[10px] font-black text-black/40 uppercase italic">{format(new Date(lesson.date), 'MMM dd')}</span>
                                                <span className="text-xs font-black text-neo-accent uppercase tracking-tighter italic">{lesson.subject}</span>
                                            </div>
                                            {getQuestionTypeBadge(lesson.question_type)}
                                        </div>

                                        <h3 className="text-2xl font-black text-black mb-4 uppercase tracking-tighter italic leading-none line-clamp-2 min-h-[3rem] group-hover:text-neo-accent transition-colors">
                                            {lesson.topic}
                                        </h3>

                                        <p className="text-sm font-bold text-black/60 uppercase tracking-widest line-clamp-3 mb-10 flex-grow leading-tight italic">
                                            {lesson.description}
                                        </p>

                                        <div className="flex flex-col gap-4 mt-auto">
                                            <button
                                                onClick={() => {
                                                    setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });
                                                    setRenderMode('classic');
                                                }}
                                                className="w-full py-4 border-4 border-black bg-white font-black uppercase italic tracking-tighter text-xl hover:bg-neo-bg transition-all shadow-[6px_6px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-3"
                                            >
                                                <BookOpen className="w-5 h-5 stroke-[3px]" />
                                                CLASSIC_VIEW
                                            </button>
                                            <button
                                                onClick={() => handlePlayPremium(lesson)}
                                                className={`w-full py-5 border-4 border-black font-black uppercase italic tracking-tighter text-2xl transition-all shadow-[8px_8px_0px_0px_#000] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] flex items-center justify-center gap-4 ${isGenerating
                                                    ? 'bg-neo-bg text-black animate-pulse'
                                                    : 'bg-black text-white hover:bg-neo-accent hover:text-black'
                                                    }`}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="w-6 h-6 animate-spin stroke-[4px]" />
                                                        <span>SYNCING_{generations[cleanTopic]?.progress || 0}%</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-6 h-6 stroke-[3px]" />
                                                        <span>PREMIUM_SYNC</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
