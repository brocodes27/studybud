import React, { useEffect, useState } from 'react';
import { Mic, X, Zap } from 'lucide-react';

interface VoiceVisualizerProps {
    isActive: boolean;
    onClose: () => void;
    volume: number; // 0 to 1
    status: 'listening' | 'speaking' | 'idle' | 'connecting';
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isActive, onClose, volume, status }) => {
    const [bars, setBars] = useState<number[]>(new Array(12).fill(10));

    useEffect(() => {
        if (!isActive) return;

        // Animate bars based on volume
        const animationFrame = requestAnimationFrame(() => {
            setBars(prev => prev.map(() => Math.max(10, Math.random() * (volume * 100 + 20))));
        });

        return () => cancelAnimationFrame(animationFrame);
    }, [volume, isActive]);

    if (!isActive) return null;

    return (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 animate-fade-in-down">
            <div className="bg-slate-900/90 text-white border border-white/20 backdrop-blur-xl rounded-full px-6 py-3 flex items-center gap-6 shadow-neo">

                {/* Status Icon */}
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${status === 'listening' ? 'bg-neo-accent' : 'bg-neo-secondary'}`}>
                    {status === 'connecting' && <Zap className="w-5 h-5 animate-pulse text-white" />}
                    {status === 'listening' && <Mic className="w-5 h-5 text-white" />}
                    {status === 'speaking' && <div className="w-4 h-4 bg-slate-800 rounded-full animate-ping" />}
                    {status === 'idle' && <div className="w-3 h-3 bg-slate-800/50 rounded-full" />}

                    {/* Ring Animation */}
                    <div className={`absolute inset-0 rounded-full border border-white/30 ${status === 'listening' ? 'animate-ping' : ''}`} />
                </div>

                {/* Visualizer Bars */}
                <div className="flex items-center gap-1 h-8">
                    {bars.map((height, i) => (
                        <div
                            key={i}
                            className="w-1 bg-gradient-to-t from-white/20 to-white rounded-full transition-all duration-75"
                            style={{ height: `${height}%`, opacity: Math.max(0.3, volume * 2) }}
                        />
                    ))}
                </div>

                {/* Text Status */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">ATLAS VOICE</span>
                    <span className="text-xs font-bold text-neo-accent animate-pulse">
                        {status === 'connecting' && 'CONNECTING...'}
                        {status === 'listening' && 'LISTENING...'}
                        {status === 'speaking' && 'SPEAKING...'}
                        {status === 'idle' && 'READY'}
                    </span>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/10 hover:bg-red-500 hover:text-white transition-colors border border-white/10"
                >
                    <X className="w-4 h-4" />
                </button>

            </div>
        </div>
    );
};
