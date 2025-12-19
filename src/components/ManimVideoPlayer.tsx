import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X, Volume2, Maximize, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ManimVideoPlayerProps {
    videoUrl?: string; // Optional now, can come from DB
    topic: string;
    generationId?: string; // If provided, we track live progress
    onClose: () => void;
}

export const ManimVideoPlayer: React.FC<ManimVideoPlayerProps> = ({ videoUrl, topic, generationId, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Generation State
    const [isGenerating, setIsGenerating] = useState(!!generationId);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [logs, setLogs] = useState<{ time: string, msg: string }[]>([]);
    const [actualSrc, setActualSrc] = useState<string | null>(videoUrl || null);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Real-Time Generation Tracking
    useEffect(() => {
        if (!generationId) {
            // Fallback to simulation or instant play if URL exists
            if (videoUrl && !actualSrc) setActualSrc(videoUrl);
            if (videoUrl) setIsGenerating(false);
            return;
        }

        setIsGenerating(true);

        // Initial fetch
        supabase.from('video_generations').select('*').eq('id', generationId).single().then(({ data }) => {
            if (data) {
                if (data.status === 'completed') {
                    setActualSrc(data.video_url);
                    setIsGenerating(false);
                } else if (data.status === 'failed') {
                    setError("Generation Failed: " + (data.logs?.[data.logs.length - 1]?.msg || "Internal engine error"));
                    setIsGenerating(false);
                }
                if (data.progress) setCurrentProgress(data.progress);
                if (data.logs) setLogs(data.logs);
                else if (data.current_step) setLogs([{ time: new Date().toLocaleTimeString(), msg: data.current_step }]);
            }
        });

        const channel = supabase
            .channel(`generation-${generationId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'video_generations', filter: `id=eq.${generationId}` },
                (payload) => {
                    const newItem = payload.new as any;

                    // Update Logs & Progress
                    if (newItem.progress !== undefined) {
                        setCurrentProgress(newItem.progress);
                    }

                    if (newItem.current_step) {
                        setLogs(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.msg === newItem.current_step) return prev;
                            return [...prev, { time: new Date().toLocaleTimeString().split(' ')[0], msg: newItem.current_step }];
                        });
                    }

                    // Complete
                    if (newItem.status === 'completed' && newItem.video_url) {
                        setActualSrc(newItem.video_url);
                        setIsGenerating(false);
                        setCurrentProgress(100);
                    }

                    // Fail
                    if (newItem.status === 'failed') {
                        setError("Generation Failed: " + (newItem.logs?.[newItem.logs.length - 1]?.msg || "Unknown error"));
                        setIsGenerating(false);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [generationId]);

    // Cleanup simulations (removed for brevity/conflict avoidance) or keep if manual mode needed.
    // ...

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else {
                videoRef.current.play().catch(err => {
                    console.error("Playback failed:", err);
                    setError("Video file not found or playback error.");
                });
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(p);
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
        if (!isGenerating) {
            setError("Playback failed. This usually means the MP4 file hasn't been rendered yet. Run 'npm run generate-video' in your terminal.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
            <div
                ref={containerRef}
                className={`relative w-full ${isFullscreen ? 'h-full' : 'max-w-5xl aspect-video'} rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] class-glass`}
            >

                {/* Generation Loading State */}
                {isGenerating && !error && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl px-8">
                        <div className="relative mb-8">
                            <div className="w-32 h-32 rounded-full border-4 border-white/5 border-t-neon-green animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="text-neon-green w-10 h-10 animate-pulse" />
                            </div>
                        </div>

                        <div className="text-center space-y-2 max-w-md">
                            <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">
                                Rendering <span className="text-neon-green">Masterpiece</span>
                            </h3>
                            <p className="text-gray-400 font-medium">Topic: {topic}</p>
                        </div>

                        <div className="mt-12 w-full max-w-sm">
                            <div className="flex justify-between text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2 px-1">
                                <span>Engine Progress</span>
                                <span className="text-neon-green">{currentProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-600 to-neon-green transition-all duration-700 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                                    style={{ width: `${currentProgress}%` }}
                                />
                            </div>
                        </div>

                        {/* Live Log Terminal */}
                        <div className="mt-12 w-full max-w-2xl bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
                                </div>
                                <span className="text-[10px] font-mono text-gray-500 ml-2">manim-engine --verbose</span>
                            </div>
                            <div
                                ref={logContainerRef}
                                className="p-4 h-32 font-mono text-xs text-emerald-400 overflow-y-auto space-y-1"
                            >
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-3 opacity-80 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <span className="text-gray-600">[{log.time}]</span>
                                        <span className="text-emerald-500">▶</span>
                                        <span className="flex-1">{log.msg}</span>
                                    </div>
                                ))}
                                {logs.length === 0 && <div className="text-gray-600 animate-pulse">Waiting for engine response...</div>}
                            </div>
                        </div>

                        <div className="mt-12 flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="px-8 py-3 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm font-bold border border-white/5"
                            >
                                Finish in Background
                            </button>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl px-12 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-8">
                            <AlertCircle className="text-red-500 w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-black text-white italic tracking-tight mb-4 uppercase">Generation <span className="text-red-500">Failed</span></h3>
                        <p className="text-gray-400 text-lg max-w-xl mb-12 leading-relaxed">
                            {error}
                        </p>

                        <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl mb-12 max-w-lg">
                            <p className="text-xs text-red-400/80 italic font-mono">
                                Potential cause: Temporary LaTeX rendering error or server timeout. Try generating the video again or contact support.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                className="px-10 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-xl shadow-white/5"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                {!isGenerating && !error && (
                    <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(74,222,128,0.5)]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">{topic}</h2>
                                <p className="text-xs text-emerald-400/80 font-medium tracking-widest uppercase">Premium Manim Lesson</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
                            <X size={24} />
                        </button>
                    </div>
                )}

                {/* Video Surface */}
                {!isGenerating && actualSrc && (
                    <video
                        key={actualSrc}
                        ref={videoRef}
                        src={actualSrc}
                        className="w-full h-full object-cover"
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                        onError={handleError}
                        crossOrigin="anonymous"
                    >
                        {/* Subtitles Track */}
                        <track
                            kind="captions"
                            src={actualSrc.replace('.mp4', '.vtt')}
                            srcLang="en"
                            label="English"
                            default
                            onLoad={() => console.log(`Subtitles loaded: ${actualSrc.replace('.mp4', '.vtt')}`)}
                            onError={(e) => console.error(`Subtitles failed to load: ${actualSrc.replace('.mp4', '.vtt')}`, e)}
                        />
                    </video>
                )}

                {/* Controls Overlay */}
                {!isGenerating && !error && (
                    <div className="absolute inset-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                        <div className="p-8 pb-10 space-y-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">

                            {/* Progress Bar */}
                            <div className="group relative h-1.5 w-full bg-white/10 rounded-full cursor-pointer hover:h-2.5 transition-all">
                                <input
                                    type="range"
                                    className="absolute inset-0 w-full opacity-0 z-20 cursor-pointer"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={progress}
                                    onChange={handleSeek}
                                />
                                <div
                                    className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all z-10"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <button onClick={togglePlay} className="p-4 rounded-2xl bg-white text-black hover:scale-105 active:scale-95 transition-all">
                                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                                    </button>
                                    <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} className="text-white/60 hover:text-white transition-all">
                                        <RotateCcw size={22} />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setIsMuted(!isMuted)} className="text-white/60 hover:text-white transition-all">
                                            <Volume2 size={22} />
                                        </button>
                                        <div className="w-20 h-1 bg-white/10 rounded-full">
                                            <div className="w-1/2 h-full bg-emerald-500/60 rounded-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                                        1080P HD
                                    </div>
                                    <button
                                        onClick={toggleFullscreen}
                                        className="text-white/60 hover:text-white transition-all hover:scale-110 active:scale-90"
                                    >
                                        <Maximize size={22} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};



