import React from 'react';
import { Player } from '@remotion/player';
import { LectureComposition, LectureConfig } from './LectureComposition';
import { X } from 'lucide-react';

interface RemotionPlayerProps {
    config: LectureConfig;
    onClose: () => void;
}

export const RemotionPlayer: React.FC<RemotionPlayerProps> = ({ config, onClose }) => {
    // Calculate total duration
    const totalDurationSeconds = config.segments.reduce((acc, seg) => acc + seg.duration, 0);
    const durationInFrames = Math.max(1, Math.floor(totalDurationSeconds * 30)); // 30 FPS

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="relative w-full max-w-6xl aspect-video bg-slate-800 shadow-2xl rounded-[2rem] overflow-hidden flex flex-col">

                {/* Close Button Only - Header is now in composition */}
                <div className="absolute top-8 right-8 z-[110]">
                    <button
                        onClick={onClose}
                        className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all active:scale-95 group"
                    >
                        <X className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Remotion Player */}
                <Player
                    component={LectureComposition as any}
                    inputProps={config as any}
                    durationInFrames={durationInFrames}
                    fps={30}
                    compositionWidth={2560}
                    compositionHeight={1440}
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    controls
                    autoPlay
                />

                {/* Subtle Pipeline Indicator */}
                <div className="absolute bottom-16 right-8 flex items-center gap-6 z-10 pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-300 tracking-widest">AI • ONE SHOT</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
