import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Maximize, Sparkles, AlertCircle, Monitor as TerminalIcon, Brain, CheckCircle, Zap, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface InteractionPoint {
    timestamp: number; // percentage 0-100
    question: string;
    options: { id: string; text: string; isCorrect: boolean }[];
}

interface ManimVideoPlayerProps {
    videoUrl?: string;
    topic: string;
    generationId?: string;
    isPreparing?: boolean;
    error?: string | null;
    interactionPoints?: InteractionPoint[];
    onClose: () => void;
}

export function ManimVideoPlayer({ videoUrl, topic, generationId, isPreparing, error: externalError, interactionPoints, onClose }: ManimVideoPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [isGenerating, setIsGenerating] = useState(!!generationId || !!isPreparing);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [logs, setLogs] = useState<{ time: string, msg: string }[]>([]);
    const [actualSrc, setActualSrc] = useState<string | null>(videoUrl || null);

    const [activeInteraction, setActiveInteraction] = useState<InteractionPoint | null>(null);
    const [interactionCompleted, setInteractionCompleted] = useState<string[]>([]); // IDs of completed timestamps (stringified)
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    // Default interactions if none provided (Fallback/Demo Mode)
    const finalInteractionPoints = interactionPoints || [
        {
            timestamp: 50,
            question: "Predict the next step in the visualization:",
            options: [
                { id: "a", text: "The curve will approach infinity", isCorrect: true },
                { id: "b", text: "The slope becomes zero", isCorrect: false }
            ]
        }
    ];

    useEffect(() => {
        setIsGenerating(!!generationId || !!isPreparing);
        setError(externalError || null);
        setActualSrc(videoUrl || null);
        setLogs([]);
        setInteractionCompleted([]);
        setActiveInteraction(null);
    }, [topic, videoUrl, externalError, generationId, isPreparing]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Fullscreen request failed: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        if (!generationId) {
            if (videoUrl && !actualSrc) setActualSrc(videoUrl);
            if (videoUrl && !isPreparing) setIsGenerating(false);
            return;
        }

        setIsGenerating(true);

        supabase.from('video_generations').select('*').eq('id', generationId).single().then(({ data }) => {
            if (data) {
                if (data.status === 'completed') {
                    setActualSrc(data.video_url);
                    setIsGenerating(false);
                } else if (data.status === 'failed') {
                    setError("ENGINE_CRASH: " + (data.logs?.[data.logs.length - 1]?.msg || "INTERNAL_CIRCUIT_FAILURE"));
                    setIsGenerating(false);
                }
                if (data.progress) setCurrentProgress(data.progress);
                if (data.logs) setLogs(data.logs);
            }
        });

        const channel = supabase
            .channel(`generation-${generationId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'video_generations', filter: `id=eq.${generationId}` },
                (payload) => {
                    const newItem = payload.new as any;
                    if (newItem.progress !== undefined) setCurrentProgress(newItem.progress);
                    if (newItem.current_step) {
                        setLogs(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.msg === newItem.current_step) return prev;
                            return [...prev, { time: new Date().toLocaleTimeString().split(' ')[0], msg: newItem.current_step }];
                        });
                    }
                    if (newItem.status === 'completed' && newItem.video_url) {
                        setActualSrc(newItem.video_url);
                        setIsGenerating(false);
                        setCurrentProgress(100);
                    }
                    if (newItem.status === 'failed') {
                        setError("SYNC_FAILURE: " + (newItem.logs?.[newItem.logs.length - 1]?.msg || "UNKNOWN_ERROR"));
                        setIsGenerating(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [generationId]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else {
                videoRef.current.play().catch(() => setError("BUFFER_READ_ERROR: SOURCE_NOT_FOUND"));
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(p);

            // Check for interactions
            const hit = finalInteractionPoints.find(pt => Math.abs(pt.timestamp - p) < 1);
            const hitId = hit ? hit.timestamp.toString() : null;

            if (hit && hitId && !interactionCompleted.includes(hitId)) {
                videoRef.current.pause();
                setIsPlaying(false);
                setActiveInteraction(hit);
                setSelectedOption(null);
                setShowFeedback(false);
            }
        }
    };

    const handleOptionSelect = (optionId: string) => {
        setSelectedOption(optionId);
        setShowFeedback(true);
    };

    const resumePlayback = () => {
        if (activeInteraction) {
            setInteractionCompleted(prev => [...prev, activeInteraction.timestamp.toString()]);
            setActiveInteraction(null);
            if (videoRef.current) {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
            videoRef.current.currentTime = time;
            setProgress(parseFloat(e.target.value));
        }
    };

    const handleError = () => {
        if (!isGenerating && !generationId && !isPreparing && !error) {
            setError("IO_LOAD_FAILURE: RECOVERY_IN_PROGRESS");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
            <div
                ref={containerRef}
                className="relative w-full max-w-6xl bg-slate-800 border border-white/10 shadow-neo overflow-hidden flex flex-col"
            >
                {/* Close Button Header */}
                <div className="p-4 border-b-8 border-white/10 bg-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 text-white px-4 py-1 font-black uppercase text-xs italic -rotate-1">
                            MODULE_ID: MANIM_V1
                        </div>
                        <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tighter italic truncate max-w-md">{topic}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 border border-white/10 bg-slate-800 hover:bg-neo-accent transition-all shadow-neo active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                        <X className="h-8 w-8 stroke-[4px]" />
                    </button>
                </div>

                {/* Main View Area */}
                <div className="relative aspect-video bg-slate-900/10 flex-grow">
                    {isGenerating && !error && (
                        <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                            <div className="relative mb-12">
                                <div className="w-40 h-40 border border-white/10 border-t-neo-accent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="text-slate-100 w-12 h-12 stroke-[4px] animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-6xl font-black text-slate-100 uppercase tracking-tighter italic mb-4">ENGINE_RENDER</h3>
                            <p className="text-slate-100/40 font-black uppercase tracking-widest text-sm mb-12 italic">PROTOCOL: NEURAL_VISUALIZATION_V2</p>

                            <div className="w-full max-w-xl space-y-4">
                                <div className="flex justify-between font-black uppercase italic text-xl">
                                    <span>CONSTRUCTION_SYNC</span>
                                    <span className="text-neo-accent">{currentProgress}%</span>
                                </div>
                                <div className="h-12 w-full bg-slate-900 border border-white/10 relative">
                                    <div
                                        className="h-full bg-neo-accent transition-all duration-700"
                                        style={{ width: `${currentProgress}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center mix-blend-difference">
                                        <span className="text-white font-black uppercase tracking-[0.5em] text-xs">BUFFERING_MATRICES</span>
                                    </div>
                                </div>
                            </div>

                            {/* Logs Terminal */}
                            <div className="mt-12 w-full max-w-3xl bg-slate-900 border border-white/10 shadow-neo rotate-1">
                                <div className="px-4 py-2 bg-slate-900 border-b-2 border-white/20 flex items-center gap-2">
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 bg-neo-accent" />
                                        <div className="w-2 h-2 bg-neo-secondary" />
                                        <div className="w-2 h-2 bg-slate-900" />
                                    </div>
                                    <span className="text-[10px] font-mono text-white/40 ml-2 uppercase tracking-widest flex items-center gap-2">
                                        <TerminalIcon className="h-3 w-3" />
                                        elevenfolks-manim-engine --verbose
                                    </span>
                                </div>
                                <div
                                    ref={logContainerRef}
                                    className="p-6 h-40 font-mono text-sm text-neo-secondary overflow-y-auto custom-scrollbar"
                                >
                                    {logs.map((log, i) => (
                                        <div key={i} className="flex gap-4 mb-1">
                                            <span className="text-white/20 whitespace-nowrap">[{log.time}]</span>
                                            <span className="text-neo-accent font-black">»</span>
                                            <span className="flex-1 uppercase font-bold text-xs tracking-tight">{log.msg}</span>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-white/20 animate-pulse italic uppercase text-xs">INITIALIZING_ENGINE_CORES...</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neo-accent px-12 text-center">
                            <div className="bg-slate-800 border border-white/10 p-8 shadow-neo -rotate-2 mb-10">
                                <AlertCircle className="text-slate-100 w-20 h-20 stroke-[4px]" />
                            </div>
                            <h3 className="text-6xl font-black text-slate-100 uppercase tracking-tighter italic mb-6">SYNC_CRITICAL_FAILURE</h3>
                            <p className="text-slate-100 font-black text-2xl max-w-2xl mb-12 uppercase italic leading-tight">
                                {error}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-16 py-6 bg-slate-900 text-white border border-white/10 font-black uppercase italic tracking-tighter text-3xl hover:bg-slate-800 hover:text-slate-100 transition-all shadow-neo active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                            >
                                ABORT_AND_EXIT
                            </button>
                        </div>
                    )}

                    {!isGenerating && actualSrc && (
                        <video
                            key={actualSrc}
                            ref={videoRef}
                            src={actualSrc}
                            className="w-full h-full bg-slate-900 object-contain"
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setIsPlaying(false)}
                            onError={handleError}
                            crossOrigin="anonymous"
                        />
                    )}

                    {activeInteraction && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-8 animate-in fade-in zoom-in duration-300">
                            <div className="bg-slate-800 border border-white/10 p-8 shadow-neo max-w-2xl w-full rotate-1 relative">
                                <div className="absolute -top-6 -right-6 bg-neo-accent border border-white/10 p-2 rotate-12 shadow-neo">
                                    <Sparkles className="w-8 h-8 text-white stroke-[3px]" />
                                </div>
                                <div className="flex items-center gap-4 mb-8 border-b-4 border-white/10 pb-4">
                                    <div className="bg-slate-900 p-3 border border-white/10">
                                        <Brain className="w-8 h-8 text-white stroke-[3px]" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-widest text-slate-100/40">INTERACTIVE CHECKPOINT</div>
                                        <h3 className="text-3xl font-black uppercase italic leading-none">PREDICT THE NEXT STEP</h3>
                                    </div>
                                </div>

                                <p className="text-xl font-bold text-slate-100 mb-8 leading-relaxed">
                                    {activeInteraction.question}
                                </p>

                                <div className="space-y-4">
                                    {activeInteraction.options.map((opt) => {
                                        const isSelected = selectedOption === opt.id;
                                        const isCorrect = opt.isCorrect;
                                        let statusColor = "bg-slate-900 hover:bg-neo-secondary border-white/10"; // Default
                                        let Icon = Zap;

                                        if (showFeedback) {
                                            if (isCorrect) {
                                                statusColor = "bg-green-500 text-white border-white/10";
                                                Icon = CheckCircle;
                                            } else if (isSelected && !isCorrect) {
                                                statusColor = "bg-red-500 text-white border-white/10";
                                                Icon = XCircle;
                                            } else {
                                                statusColor = "bg-slate-900/50 text-gray-400 border-gray-300";
                                            }
                                        }

                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => !showFeedback && handleOptionSelect(opt.id)}
                                                disabled={showFeedback}
                                                className={`w-full text-left p-6 border ${statusColor} hover:shadow-neo hover:-translate-y-1 transition-all font-black text-lg group flex items-center justify-between uppercase italic ${showFeedback ? 'cursor-default' : ''}`}
                                            >
                                                <span>{opt.text}</span>
                                                <Icon className={`w-8 h-8 stroke-[3px] ${!showFeedback ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} transition-opacity`} />
                                            </button>
                                        );
                                    })}
                                </div>

                                {showFeedback && (
                                    <div className="mt-8 text-center animate-fade-in">
                                        <button
                                            onClick={resumePlayback}
                                            className="px-8 py-3 bg-slate-900 text-white font-black uppercase tracking-widest border border-white/10 hover:bg-neo-accent hover:text-slate-100 transition-all shadow-neo active:shadow-none"
                                        >
                                            CONTINUE SIMULATION »
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    {!isGenerating && !error && (
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8 bg-gradient-to-t from-black/60 to-transparent">
                            <div className="bg-slate-800 border border-white/10 p-6 shadow-neo space-y-6">
                                {/* Progress Seeker */}
                                <div className="relative h-6 bg-slate-900 border border-white/10 group cursor-pointer">
                                    <div
                                        className="h-full bg-neo-accent transition-all duration-100"
                                        style={{ width: `${progress}%` }}
                                    />
                                    <input
                                        type="range"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        min="0" max="100" step="0.1"
                                        value={progress}
                                        onChange={handleSeek}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <button onClick={togglePlay} className="p-4 border border-white/10 bg-slate-900 text-white hover:bg-neo-accent hover:text-slate-100 transition-all active:translate-y-1">
                                            {isPlaying ? <Pause className="h-8 w-8 stroke-[4px]" /> : <Play className="h-8 w-8 stroke-[4px]" />}
                                        </button>
                                        <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} className="p-4 border border-white/10 bg-slate-800 hover:bg-neo-secondary transition-all active:translate-y-1">
                                            <RotateCcw className="h-6 w-6 stroke-[3px]" />
                                        </button>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-900 text-white px-4 py-2 font-black uppercase text-xs italic">
                                                VOL_TRACKER
                                            </div>
                                            <div className="w-32 h-4 bg-slate-900/10 border border-white/10 p-0.5">
                                                <div className="w-1/2 h-full bg-neo-secondary" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="bg-neo-secondary border border-white/10 px-4 py-1 font-black text-xs uppercase italic rotate-1">
                                            1080P_HD_READY
                                        </div>
                                        <button onClick={toggleFullscreen} className="p-4 border border-white/10 bg-slate-800 hover:bg-neo-accent transition-all">
                                            <Maximize className="h-6 w-6 stroke-[3px]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
