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
import { RemotionPlayer } from '../components/RemotionLecture/RemotionPlayer';
import { LectureService } from '../lib/lectureService';
import { LectureConfig } from '../components/RemotionLecture/LectureComposition';

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
        color: 'bg-slate-800',
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
        color: 'bg-slate-800',
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
    const { user, isPremium } = useAuth() as any;
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentGenerationId, setCurrentGenerationId] = useState<string | undefined>();
    const [playingLesson, setPlayingLesson] = useState<{ topic: string, subject: string } | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [showLectureLock, setShowLectureLock] = useState(false);

    // Navigation State
    const [viewMode, setViewMode] = useState<'plans' | 'chapters' | 'lessons'>('plans');
    const [selectedPlan, setSelectedPlan] = useState<PlanFolder | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [renderMode, setRenderMode] = useState<'classic' | 'premium' | 'remotion' | null>(null);
    const [remotionConfig, setRemotionConfig] = useState<LectureConfig | null>(null);
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
        <span className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-2 py-0.5 bg-slate-800 shadow-neo">
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
        if (!isPremium) {
            setShowLectureLock(true);
            return;
        }

        const cleanTopic = getCleanTopic(lesson.topic);
        const topicKey = cleanTopic.toLowerCase();
        const existingGen = generations[topicKey];
        const lectureService = LectureService.getInstance();

        setCurrentGenerationId(undefined);
        setRemotionConfig(null);
        setIsPreparing(true);
        setGenerationError(null);

        setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });

        // If we already have a Remotion version, play it instantly
        if (existingGen && existingGen.video_url === 'remotion:live') {
            try {
                const config = JSON.parse(existingGen.script);
                setRemotionConfig(config);
                setRenderMode('remotion');
                setIsPreparing(false);
                return;
            } catch (e) {
                console.error("Failed to parse existing remotion config", e);
            }
        }

        // Always use Remotion for new premium lessons now (No server needed)
        setRenderMode('remotion');

        try {
            // 1. Generate the lecture script using AI (Client side)
            const config = await lectureService.generateLectureConfig(
                lesson.topic,
                lesson.subject,
                lesson.description || ""
            );

            // 2. Save it to Supabase so it's "stored"
            await lectureService.saveLecture(user.id, lesson.topic, config);

            // 3. Play it
            setRemotionConfig(config);
        } catch (e: any) {
            console.error("Error starting Remotion generation:", e);
            setGenerationError(`Generation failed: ${e.message || "Unknown Error"}`);
        } finally {
            setIsPreparing(false);
        }
    };

    return (
        <div className="space-y-12 animate-fade-in relative min-h-screen pb-20">
            {showLectureLock && !isPremium && (
                <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl p-8 text-center">
                    <h3 className="text-4xl font-black text-neo-accent uppercase tracking-tighter italic mb-4">PRO_ONLY</h3>
                    <p className="text-white/60 mb-8 max-w-md">Neural video lectures are Pro-only. Upgrade to unlock unlimited HD lectures.</p>
                    <div className="flex gap-4">
                        <button onClick={() => setShowLectureLock(false)} className="px-8 py-3 bg-slate-800 text-slate-100 font-black uppercase italic tracking-widest">OK</button>
                        <button onClick={() => window.location.href = '/subscription'} className="px-8 py-3 bg-neo-accent text-slate-100 font-black uppercase italic tracking-widest">UPGRADE</button>
                    </div>
                </div>
            )}

            {playingLesson && renderMode === 'classic' && (
                <BlackboardPlayer
                    topic={playingLesson.topic}
                    subject={playingLesson.subject}
                    onClose={() => { setPlayingLesson(null); setRenderMode(null); }}
                />
            )}

            {playingLesson && renderMode === 'premium' && (
                <ManimVideoPlayer
                    videoUrl={`${import.meta.env.VITE_VIDEO_SERVER_URL || 'https://vidgen.kaminariclothing.shop'}/videos/${playingLesson.topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}.mp4`}
                    topic={playingLesson.topic}
                    generationId={currentGenerationId}
                    isPreparing={isPreparing}
                    error={generationError}
                    onClose={() => { setPlayingLesson(null); setRenderMode(null); setCurrentGenerationId(undefined); setIsPreparing(false); setGenerationError(null); }}
                />
            )}

            {playingLesson && renderMode === 'remotion' && (
                <>
                    {isPreparing ? (
                        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl">
                            <div className="relative mb-12">
                                <div className="w-40 h-40 border border-white/5 border-t-[#4D96FF] animate-spin rounded-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="text-white w-12 h-12 stroke-[2px] animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic mb-4">ENGINEERING_LECTURE</h3>
                            <p className="text-white/40 font-black uppercase tracking-widest text-sm mb-12 italic">CORE: REMOTION_REACT_V4</p>
                        </div>
                    ) : remotionConfig ? (
                        <RemotionPlayer
                            config={remotionConfig}
                            onClose={() => { setPlayingLesson(null); setRenderMode(null); setRemotionConfig(null); }}
                        />
                    ) : generationError && (
                        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl p-8 text-center">
                            <h3 className="text-4xl font-black text-red-500 uppercase tracking-tighter italic mb-4">GENERATION_FAILED</h3>
                            <p className="text-white/60 mb-8 max-w-md">{generationError}</p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        if (playingLesson) {
                                            const lesson = lessons.find(l => l.topic === playingLesson.topic && l.subject === playingLesson.subject);
                                            if (lesson) return handlePlayPremium(lesson);
                                        }
                                        setGenerationError(null);
                                    }}
                                    className="px-8 py-3 bg-neo-accent text-slate-100 font-black uppercase italic tracking-widest"
                                >
                                    REGENERATE
                                </button>
                                <button onClick={() => { setPlayingLesson(null); setRenderMode(null); setGenerationError(null); }} className="px-8 py-3 bg-slate-800 text-slate-100 font-black uppercase italic tracking-widest">Abort Process</button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b-8 border-white/10 pb-10">
                <div className="flex items-center gap-6">
                    <div className="bg-neo-accent border border-white/10 p-5 shadow-neo rotate-3">
                        <Video className="h-10 w-10 text-white stroke-[3px]" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">
                            {viewMode === 'plans' ? 'VIDEO_ARCHIVE' :
                                viewMode === 'chapters' ? 'CHAPTER_INDEX' : 'TOPIC_NODES'}
                        </h1>
                        <p className="text-slate-100/40 font-black uppercase tracking-widest text-sm mt-3 flex items-center gap-3">
                            {viewMode !== 'plans' && (
                                <button
                                    onClick={() => {
                                        if (viewMode === 'lessons') { setViewMode('chapters'); setSelectedChapter(null); }
                                        else { setViewMode('plans'); setSelectedPlan(null); }
                                    }}
                                    className="flex items-center gap-2 hover:text-slate-100 transition-colors"
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
                    <div className="w-24 h-24 border border-white/10 border-t-neo-accent animate-spin" />
                    <h3 className="text-3xl font-black text-slate-100 uppercase tracking-tighter italic">LOADING_ARCHIVES...</h3>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* PLANS VIEW */}
                    {viewMode === 'plans' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {plans.length === 0 ? (
                                <div className="col-span-full bg-slate-800 border border-white/10 p-20 shadow-neo text-center rotate-1">
                                    <div className="w-24 h-24 bg-neo-muted border border-white/10 flex items-center justify-center mx-auto mb-10 shadow-neo">
                                        <AlertCircle className="w-12 h-12 text-slate-100 stroke-[3px]" />
                                    </div>
                                    <h3 className="text-4xl font-black text-slate-100 uppercase tracking-tighter mb-4">NO_PLANS_DETECTED</h3>
                                    <p className="text-slate-100/60 font-bold uppercase tracking-widest text-sm">INITIALIZE A STUDY SEQUENCE TO GENERATE VISUAL ASSETS.</p>
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
                                    className={`bg-slate-800 border-6 border-white/10 p-8 shadow-neo hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-neo cursor-pointer transition-all group ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}
                                >
                                    <div className="flex items-center gap-6 mb-8">
                                        <div className="w-16 h-16 border border-white/10 bg-neo-secondary flex items-center justify-center shadow-neo group-hover:rotate-12 transition-transform">
                                            <BookOpen className="w-8 h-8 text-slate-100 stroke-[3px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">{plan.name}</h3>
                                            <span className="text-[10px] font-black text-slate-100/40 uppercase tracking-widest mt-2 block">{plan.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between font-black uppercase tracking-widest text-xs pt-6 border-t-4 border-white/10/10">
                                        <span className="bg-slate-900 text-white px-3 py-1 -rotate-2">{plan.lessonCount} NODES</span>
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
                                    className={`bg-slate-800 border-6 border-white/10 p-8 shadow-neo hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-neo cursor-pointer transition-all group ${idx % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                                >
                                    <div className="flex items-center gap-6 mb-8">
                                        <div className="w-16 h-16 border border-white/10 bg-slate-900 flex items-center justify-center shadow-neo group-hover:-rotate-12 transition-transform">
                                            <Video className="w-8 h-8 text-slate-100 stroke-[3px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic leading-none line-clamp-1">{chapter.name}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between font-black uppercase tracking-widest text-xs pt-6 border-t-4 border-white/10/10">
                                        <span className="bg-slate-900 text-white px-3 py-1 rotate-1">{chapter.lessonCount} TOPICS</span>
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
                                    <div key={`${lesson.plan_id}-${idx}`} className={`bg-slate-800 border-6 border-white/10 p-8 shadow-neo transition-all flex flex-col h-full group ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}>
                                        {/* Card Header Illustration */}
                                        <div className="relative mb-8 h-40 border border-white/10 bg-slate-900 overflow-hidden shadow-neo">
                                            <div className={`absolute inset-0 opacity-20 ${visual.color}`} />
                                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
                                            <div className="relative flex h-full items-center justify-center p-6 text-center flex-col gap-4">
                                                <div className={`w-16 h-16 border border-white/10 ${visual.color} flex items-center justify-center shadow-neo rotate-12 group-hover:rotate-0 transition-transform`}>
                                                    {visual.icon}
                                                </div>
                                                <p className="text-white font-black uppercase tracking-widest text-[10px] italic">NODE_{idx.toString().padStart(3, '0')}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[10px] font-black text-slate-100/40 uppercase italic">{format(new Date(lesson.date), 'MMM dd')}</span>
                                                <span className="text-xs font-black text-neo-accent uppercase tracking-tighter italic">{lesson.subject}</span>
                                            </div>
                                            {getQuestionTypeBadge(lesson.question_type)}
                                        </div>

                                        <h3 className="text-2xl font-black text-slate-100 mb-4 uppercase tracking-tighter italic leading-none line-clamp-2 min-h-[3rem] group-hover:text-neo-accent transition-colors">
                                            {lesson.topic}
                                        </h3>

                                        <p className="text-sm font-bold text-slate-100/60 uppercase tracking-widest line-clamp-3 mb-10 flex-grow leading-tight italic">
                                            {lesson.description}
                                        </p>

                                        <div className="flex flex-col gap-4 mt-auto">
                                            <button
                                                onClick={() => {
                                                    setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });
                                                    setRenderMode('classic');
                                                }}
                                                className="w-full py-4 border border-white/10 bg-slate-800 font-black uppercase italic tracking-tighter text-xl hover:bg-slate-900 transition-all shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-3"
                                            >
                                                <BookOpen className="w-5 h-5 stroke-[3px]" />
                                                CLASSIC_VIEW
                                            </button>
                                            <button
                                                onClick={() => handlePlayPremium(lesson)}
                                                className={`w-full py-5 border border-white/10 font-black uppercase italic tracking-tighter text-2xl transition-all shadow-neo active:shadow-none active:translate-x-[4px] active:translate-y-[4px] flex items-center justify-center gap-4 ${isGenerating
                                                    ? 'bg-slate-900 text-slate-100 animate-pulse'
                                                    : 'bg-slate-900 text-white hover:bg-neo-accent hover:text-slate-100'
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
