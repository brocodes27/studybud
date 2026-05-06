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
        color: 'bg-[#00D1FF]/10',
        icon: <Calculator className="w-7 h-7 text-[#00D1FF] stroke-[2.5px]" />
    },
    physics: {
        color: 'bg-[#F472B6]/10',
        icon: <Atom className="w-7 h-7 text-[#F472B6] stroke-[2.5px]" />
    },
    chemistry: {
        color: 'bg-amber-50',
        icon: <FlaskConical className="w-7 h-7 text-amber-500 stroke-[2.5px]" />
    },
    biology: {
        color: 'bg-[#34D399]/10',
        icon: <Sparkles className="w-7 h-7 text-[#34D399] stroke-[2.5px]" />
    },
    geography: {
        color: 'bg-[#00D1FF]/10',
        icon: <Globe2 className="w-7 h-7 text-[#00D1FF] stroke-[2.5px]" />
    },
    social_science: {
        color: 'bg-[#8B5CF6]/10',
        icon: <Globe2 className="w-7 h-7 text-[#8B5CF6] stroke-[2.5px]" />
    },
    general: {
        color: 'bg-slate-100',
        icon: <Sparkles className="w-7 h-7 text-[#64748B] stroke-[2.5px]" />
    }
};

const getSubjectVisual = (subject: string): SubjectVisual => {
    const key = subject?.toLowerCase() || '';
    if (key.includes('math') || key.includes('algebra') || key.includes('calculus')) return subjectVisuals.math;
    if (key.includes('phys')) return subjectVisuals.physics;
    if (key.includes('chem')) return subjectVisuals.chemistry;
    if (key.includes('bio')) return subjectVisuals.biology;
    if (key.includes('geo') || key.includes('earth')) return subjectVisuals.geography;
    if (key.includes('social') || key.includes('sst') || key.includes('civic') || key.includes('history') || key.includes('political') || key.includes('economic')) return subjectVisuals.social_science;
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
    const [renderMode, setRenderMode] = useState<'classic' | 'premium' | 'remotion' | 'youtube' | null>(null);
    const [remotionConfig, setRemotionConfig] = useState<LectureConfig | null>(null);
    const [generations, setGenerations] = useState<Record<string, any>>({});
    
    // YouTube state
    const [youtubeRecommendations, setYoutubeRecommendations] = useState<any[]>([]);
    const [isFetchingYoutube, setIsFetchingYoutube] = useState(false);

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
        <span className="text-[10px] font-bold uppercase tracking-widest border border-[#0A192F]/10 px-2 py-0.5 rounded-full bg-[#F8FAFF] text-[#64748B]">
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

    const handlePlayYoutube = async (lesson: Lesson) => {
        setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });
        setRenderMode('youtube');
        setIsFetchingYoutube(true);
        setYoutubeRecommendations([]);
        setGenerationError(null);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-videos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData?.session?.access_token}`
                },
                body: JSON.stringify({
                    query_text: `${lesson.subject} ${lesson.topic} ${lesson.description}`,
                    limit: 3
                })
            });
            const data = await response.json();
            if (data.recommendations) {
                setYoutubeRecommendations(data.recommendations);
            } else {
                setGenerationError("No YouTube videos found matching this topic.");
            }
        } catch(e) {
            setGenerationError("Failed to fetch YouTube recommendations.");
        } finally {
            setIsFetchingYoutube(false);
        }
    };

    return (
        <div className="space-y-10 animate-fade-in relative pb-20">
            {showLectureLock && !isPremium && (
                <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl p-8 text-center">
                    <div className="neo-card max-w-md w-full">
                        <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-3">Premium Feature</h3>
                        <p className="text-[#64748B] font-medium mb-6">HD video lectures are available for Premium subscribers. Upgrade to unlock unlimited lectures.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLectureLock(false)} className="flex-1 px-6 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold hover:border-[#0A192F]/20 transition-all">Cancel</button>
                            <button onClick={() => window.location.href = '/subscription'} className="flex-1 neo-button py-3">Upgrade</button>
                        </div>
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
                        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl">
                            <div className="relative mb-10">
                                <div className="w-20 h-20 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] animate-spin rounded-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="text-[#00D1FF] w-8 h-8 stroke-[2px] animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-extrabold text-[#0A192F] tracking-tight mb-2">Generating Lecture</h3>
                            <p className="text-[#64748B] font-medium">Preparing your personalized video lesson...</p>
                        </div>
                    ) : remotionConfig ? (
                        <RemotionPlayer
                            config={remotionConfig}
                            onClose={() => { setPlayingLesson(null); setRenderMode(null); setRemotionConfig(null); }}
                        />
                    ) : generationError && (
                        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl p-8 text-center">
                            <div className="neo-card max-w-md w-full">
                                <h3 className="text-xl font-extrabold text-red-500 tracking-tight mb-3">Generation Failed</h3>
                                <p className="text-[#64748B] font-medium mb-6">{generationError}</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (playingLesson) {
                                                const lesson = lessons.find(l => l.topic === playingLesson.topic && l.subject === playingLesson.subject);
                                                if (lesson) return handlePlayPremium(lesson);
                                            }
                                            setGenerationError(null);
                                        }}
                                        className="flex-1 neo-button py-3"
                                    >
                                        Try Again
                                    </button>
                                    <button onClick={() => { setPlayingLesson(null); setRenderMode(null); setGenerationError(null); }} className="flex-1 px-6 py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold hover:border-[#0A192F]/20 transition-all">Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {playingLesson && renderMode === 'youtube' && (
                <div className="fixed inset-0 z-[110] flex flex-col pt-10 px-8 pb-8 bg-[#0A192F]/95 backdrop-blur-xl overflow-y-auto">
                    <div className="max-w-4xl w-full mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-extrabold text-white">YouTube Integration</h3>
                                <p className="text-white/60">Semantic search for: <span className="text-[#00D1FF] font-bold">{playingLesson.topic}</span></p>
                            </div>
                            <button onClick={() => { setPlayingLesson(null); setRenderMode(null); }} className="px-5 py-2.5 border-2 border-white/20 text-white font-bold rounded-[14px] hover:bg-white/10 transition-colors">Close</button>
                        </div>

                        {generationError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-[14px] text-red-200 font-medium mb-6">
                                {generationError}
                            </div>
                        )}

                        {isFetchingYoutube ? (
                            <div className="flex flex-col items-center justify-center p-20 bg-white/5 rounded-[20px] border border-white/10">
                                <Loader2 className="w-10 h-10 animate-spin text-[#00D1FF] mb-4" />
                                <p className="text-white/80 font-bold text-lg">Searching Semantic Vector Graph...</p>
                                <p className="text-white/50 font-medium text-sm mt-1">Retrieving the most mathematically relevant videos for this concept.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {youtubeRecommendations.map((vid: any) => (
                                    <a key={vid.id} href={`https://youtube.com/watch?v=${vid.video_id}`} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row items-start gap-5 p-4 rounded-[16px] bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all group">
                                        <div className="aspect-video w-full sm:w-56 shrink-0 bg-black rounded-[12px] overflow-hidden relative shadow-lg">
                                            {vid.thumbnail_url ? <img src={vid.thumbnail_url} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 w-8 h-8"/>}
                                        </div>
                                        <div className="flex-grow py-1">
                                            <h4 className="text-lg font-extrabold text-white mb-2 line-clamp-2 leading-tight">{vid.title}</h4>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34D399]/10 border border-[#34D399]/20 rounded-[6px] text-xs font-bold text-[#34D399] mb-4">
                                                <Sparkles className="w-3 h-3" />
                                                Semantic Match: {(vid.similarity * 100).toFixed(1)}%
                                            </div>
                                            <div>
                                                <button className="px-4 py-2 bg-[#0A192F] text-white border-2 border-white/10 rounded-[10px] text-xs font-bold hover:bg-white/10 transition-colors shadow-float">
                                                    Watch on YouTube
                                                </button>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[20px] flex items-center justify-center shadow-float-pink">
                    <Video className="h-7 w-7 text-[#F472B6] stroke-[2.5px]" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">
                        {viewMode === 'plans' ? 'Video Lessons' : viewMode === 'chapters' ? selectedPlan?.name : selectedChapter}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        {viewMode !== 'plans' && (
                            <button
                                onClick={() => {
                                    if (viewMode === 'lessons') { setViewMode('chapters'); setSelectedChapter(null); }
                                    else { setViewMode('plans'); setSelectedPlan(null); }
                                }}
                                className="flex items-center gap-1 text-sm font-bold text-[#00D1FF] hover:underline"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                        )}
                        <p className="text-[#64748B] font-medium text-sm">
                            {viewMode === 'plans' ? 'Your study plans' : viewMode === 'chapters' ? `${selectedPlan?.subject}` : `${selectedPlan?.name}`}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-10 h-10 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] animate-spin rounded-full" />
                    <p className="text-sm font-bold text-[#64748B]">Loading lessons...</p>
                </div>
            ) : (
                <div>
                    {/* PLANS VIEW */}
                    {viewMode === 'plans' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.length === 0 ? (
                                <div className="col-span-full neo-card text-center py-16">
                                    <div className="w-16 h-16 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[18px] flex items-center justify-center mx-auto mb-5 shadow-float-cyan">
                                        <AlertCircle className="w-8 h-8 text-[#00D1FF] stroke-[2px]" />
                                    </div>
                                    <h3 className="text-xl font-extrabold text-[#0A192F] tracking-tight mb-2">No study plans yet</h3>
                                    <p className="text-[#64748B] font-medium">Create a study plan first to generate video lessons.</p>
                                </div>
                            ) : plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    onClick={() => {
                                        setSelectedPlan(plan);
                                        const planChapters = Array.from(new Set(lessons.filter(l => l.plan_id === plan.id).map(l => l.chapter!)));
                                        if (planChapters.length === 1) { setSelectedChapter(planChapters[0]); setViewMode('lessons'); }
                                        else { setViewMode('chapters'); }
                                    }}
                                    className="neo-card hover:-translate-y-1 hover:shadow-float-cyan cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 border border-[#00D1FF]/20 bg-[#00D1FF]/10 rounded-[14px] flex items-center justify-center shadow-float-cyan group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-6 h-6 text-[#00D1FF] stroke-[2.5px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight leading-none">{plan.name}</h3>
                                            <span className="text-xs font-medium text-[#64748B] mt-0.5 block">{plan.subject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm pt-4 border-t border-[#0A192F]/5">
                                        <span className="px-2.5 py-1 rounded-full bg-[#F8FAFF] border border-[#0A192F]/5 text-[#64748B] font-bold text-xs">{plan.lessonCount} lessons</span>
                                        <span className="text-[#00D1FF] font-bold group-hover:translate-x-1 transition-transform text-sm">Open →</span>
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
                                    onClick={() => { setSelectedChapter(chapter.name); setViewMode('lessons'); }}
                                    className="neo-card hover:-translate-y-1 hover:shadow-float-cyan cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-4 mb-5">
                                        <div className="w-12 h-12 border border-[#F472B6]/20 bg-[#F472B6]/10 rounded-[14px] flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Video className="w-6 h-6 text-[#F472B6] stroke-[2.5px]" />
                                        </div>
                                        <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight line-clamp-2 leading-tight">{chapter.name}</h3>
                                    </div>
                                    <div className="flex items-center justify-between text-sm pt-4 border-t border-[#0A192F]/5">
                                        <span className="px-2.5 py-1 rounded-full bg-[#F8FAFF] border border-[#0A192F]/5 text-[#64748B] font-bold text-xs">{chapter.lessonCount} topics</span>
                                        <span className="text-[#00D1FF] font-bold group-hover:translate-x-1 transition-transform text-sm">Open →</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LESSONS VIEW */}
                    {viewMode === 'lessons' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentLessons.map((lesson, idx) => {
                                const visual = getSubjectVisual(lesson.subject);
                                const cleanTopic = getCleanTopic(lesson.topic).toLowerCase();
                                const isGenerating = generations[cleanTopic]?.status === 'processing' || generations[cleanTopic]?.status === 'pending';

                                return (
                                    <div key={`${lesson.plan_id}-${idx}`} className="neo-card flex flex-col h-full group hover:-translate-y-1 transition-all">
                                        {/* Card Illustration */}
                                        <div className={`relative mb-5 h-32 ${visual.color} rounded-[16px] overflow-hidden flex items-center justify-center border border-[#0A192F]/5`}>
                                            <div className="w-14 h-14 bg-white/80 rounded-[14px] flex items-center justify-center shadow-sm">
                                                {visual.icon}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-[#64748B]">{format(new Date(lesson.date), 'MMM dd')}</span>
                                                <span className="text-xs font-bold text-[#00D1FF]">{lesson.subject}</span>
                                            </div>
                                            {getQuestionTypeBadge(lesson.question_type)}
                                        </div>

                                        <h3 className="text-base font-extrabold text-[#0A192F] mb-2 tracking-tight leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-[#00D1FF] transition-colors">
                                            {lesson.topic}
                                        </h3>

                                        <p className="text-xs font-medium text-[#64748B] line-clamp-3 mb-6 flex-grow leading-relaxed">
                                            {lesson.description}
                                        </p>

                                        <div className="flex flex-col gap-3 mt-auto">
                                            <button
                                                onClick={() => {
                                                    setPlayingLesson({ topic: lesson.topic, subject: lesson.subject });
                                                    setRenderMode('classic');
                                                }}
                                                className="w-full py-3 rounded-[14px] border-2 border-[#0A192F]/10 text-[#0A192F] font-bold text-sm hover:border-[#00D1FF]/30 hover:text-[#00D1FF] transition-all flex items-center justify-center gap-2"
                                            >
                                                <BookOpen className="w-4 h-4 stroke-[2.5px]" />
                                                Classic View
                                            </button>
                                            <button
                                                onClick={() => handlePlayPremium(lesson)}
                                                className={`w-full py-3 rounded-[14px] font-bold text-sm transition-all flex items-center justify-center gap-2 ${isGenerating
                                                    ? 'bg-[#00D1FF]/10 text-[#00D1FF] border-2 border-[#00D1FF]/20 animate-pulse'
                                                    : 'neo-button'
                                                    }`}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Generating {generations[cleanTopic]?.progress || 0}%</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4 stroke-[2.5px]" />
                                                        <span>Premium Lecture</span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handlePlayYoutube(lesson)}
                                                className="w-full py-3 rounded-[14px] border-2 border-[#F472B6]/10 bg-[#F472B6]/5 text-[#F472B6] font-bold text-sm hover:border-[#F472B6]/30 hover:bg-[#F472B6]/10 transition-all flex items-center justify-center gap-2 mt-1"
                                            >
                                                <Video className="w-4 h-4 stroke-[2.5px]" />
                                                YouTube Resources
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
