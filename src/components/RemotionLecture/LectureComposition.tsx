import React, { useEffect, useState } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, spring, AbsoluteFill, Sequence, Audio } from 'remotion';
import { GraduationCap, Sparkles, TrendingUp, Layout, Brain, Circle, Square, FunctionSquare } from 'lucide-react';
import { TTSService } from '../../lib/ttsService';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { GraphRenderer } from './GraphRenderer';
import { ChemStructure } from './ChemStructure';
import { PhysicsDiagram } from './PhysicsDiagram';
import { BioDiagram } from './BioDiagram';

export interface LectureSegment {
    title: string;
    content: string[];
    duration: number; // in seconds
    tts?: string; // Text to be spoken by ElevenLabs
    media?: {
        type: 'graph' | 'shape' | 'equation' | 'chemistry' | 'diagram' | 'biology';
        data: any;
    };
}

export interface LectureConfig {
    topic: string;
    subject: string;
    segments: LectureSegment[];
    voiceId?: string;
}

const colors = {
    math: '#3B82F6', // Blue-500
    physics: '#8B5CF6', // Violet-500
    chemistry: '#10B981', // Emerald-500
    biology: '#F59E0B', // Amber-500
    general: '#64748B' // Slate-500
};

export const LectureComposition: React.FC<LectureConfig> = ({ topic, subject, segments, voiceId }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});

    useEffect(() => {
        const loadAudio = async () => {
            const tts = TTSService.getInstance();
            const urls: Record<number, string> = {};
            for (let i = 0; i < segments.length; i++) {
                if (segments[i].tts) {
                    const url = await tts.getAudioUrl(segments[i].tts!, voiceId);
                    if (url) urls[i] = url;
                }
            }
            setAudioUrls(urls);
        };
        loadAudio();
    }, [segments, voiceId]);

    const totalDurationFrames = segments.reduce((acc, seg) => acc + seg.duration * fps, 0);
    const primaryColor = colors[subject?.toLowerCase() as keyof typeof colors] || colors.general;
    let currentStartFrameOffset = 0;

    return (
        <AbsoluteFill className="bg-slate-800 font-sans overflow-hidden" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
            {/* Minimalist Background with Subtle Mesh */}
            <AbsoluteFill className="bg-slate-900/50">
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `radial-gradient(${primaryColor} 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }}
                />
            </AbsoluteFill>

            {/* Content Segments */}
            {segments.map((segment, index) => {
                const segmentDurationFrames = segment.duration * fps;
                const startFrame = currentStartFrameOffset;
                currentStartFrameOffset += segmentDurationFrames;

                const relativeFrame = frame - startFrame;
                if (frame < startFrame || frame >= startFrame + segmentDurationFrames) return null;

                return (
                    <Sequence from={startFrame} durationInFrames={segmentDurationFrames} key={index}>
                        <AbsoluteFill className="p-16 flex flex-col justify-center">

                            {/* "Card" Container - High Elevation "Fab" Look */}
                            <div
                                className="relative w-full max-w-[1600px] mx-auto bg-slate-800 rounded-[2.5rem] shadow-neo border border-slate-100 overflow-hidden flex"
                                style={{
                                    height: '800px',
                                    opacity: interpolate(relativeFrame, [0, 15], [0, 1]),
                                    transform: `translateY(${interpolate(relativeFrame, [0, 15], [40, 0], { extrapolateRight: 'clamp' })}px)`
                                }}
                            >
                                {/* Left Side: Content (60%) */}
                                <div className="w-[60%] p-20 flex flex-col justify-center relative z-10">
                                    {/* Header */}
                                    <div className="mb-12">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div style={{ backgroundColor: primaryColor }} className="w-2 h-2 rounded-full" />
                                            <span className="text-sm font-bold uppercase tracking-wider text-slate-400">
                                                Part {String(index + 1).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <h2
                                            className="text-6xl font-black text-slate-900 leading-tight tracking-tight"
                                            style={{
                                                opacity: interpolate(relativeFrame, [10, 25], [0, 1]),
                                                transform: `translateX(${interpolate(relativeFrame, [10, 25], [-20, 0], { extrapolateRight: 'clamp' })}px)`
                                            }}
                                        >
                                            {segment.title}
                                        </h2>
                                    </div>

                                    {/* Clean List Items */}
                                    <div className="space-y-6">
                                        {segment.content.map((point, pIdx) => {
                                            const pointStart = 30 + (pIdx * 10);
                                            const progress = spring({
                                                frame: relativeFrame - pointStart,
                                                fps,
                                                config: { damping: 15 }
                                            });

                                            return (
                                                <div
                                                    key={pIdx}
                                                    className="flex items-start gap-4"
                                                    style={{
                                                        opacity: progress,
                                                        transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`
                                                    }}
                                                >
                                                    <div className="mt-2 min-w-[6px] h-[6px] rounded-full bg-slate-300" />
                                                    <p className="text-2xl font-medium text-slate-600 leading-relaxed">
                                                        {point}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right Side: Visual Engine (40%) - Tinted Background */}
                                <div className="w-[40%] bg-slate-900/50 border-l border-slate-100 flex items-center justify-center relative overflow-hidden">
                                    {/* Background Decor */}
                                    <div
                                        className="absolute -right-20 -bottom-20 opacity-10"
                                        style={{ color: primaryColor }}
                                    >
                                        <Layout className="w-96 h-96" />
                                    </div>

                                    {/* Main Visual */}
                                    <div
                                        className="relative z-10 w-full max-w-[400px]"
                                        style={{
                                            opacity: interpolate(relativeFrame, [20, 40], [0, 1]),
                                            transform: `scale(${interpolate(relativeFrame, [20, 40], [0.9, 1], { extrapolateRight: 'clamp' })})`
                                        }}
                                    >
                                        {segment.media?.type === 'graph' && (
                                            <GraphRenderer media={segment.media as any} />
                                        )}

                                        {segment.media?.type === 'shape' && (
                                            <div className="flex items-center justify-center">
                                                {segment.media.data?.type === 'circle' ? (
                                                    <div
                                                        className="w-64 h-64 rounded-full border bg-slate-800 shadow-2xl"
                                                        style={{ borderColor: primaryColor }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-64 h-64 rounded-3xl border bg-slate-800 shadow-2xl"
                                                        style={{ borderColor: primaryColor }}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {segment.media?.type === 'equation' && (
                                            <div className="bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
                                                <div className="text-4xl text-slate-800 font-serif">
                                                    <BlockMath math={segment.media.data} />
                                                </div>
                                            </div>
                                        )}

                                        {segment.media?.type === 'chemistry' && (
                                            <ChemStructure media={segment.media as any} />
                                        )}

                                        {segment.media?.type === 'diagram' && (
                                            <PhysicsDiagram media={segment.media as any} />
                                        )}

                                        {segment.media?.type === 'biology' && (
                                            <BioDiagram media={segment.media as any} />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Audio Segment */}
                            {audioUrls[index] && <Audio src={audioUrls[index]} />}
                        </AbsoluteFill>
                    </Sequence>
                );
            })}

            {/* Bottom Floating Bar (Like iOS "Home" bar but functional) */}
            <AbsoluteFill className="pointer-events-none">
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[400px] h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-sm">
                    <div
                        className="h-full rounded-full transition-all duration-300 ease-linear"
                        style={{
                            width: `${(frame / totalDurationFrames) * 100}%`,
                            backgroundColor: primaryColor
                        }}
                    />
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
