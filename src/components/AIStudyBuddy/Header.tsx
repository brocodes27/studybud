import React from 'react';
import { Brain, Sparkles, Trash2, Mic, MicOff } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    onClear?: () => void;
    variant?: 'default' | 'mentor';
    isVoiceActive?: boolean;
    onToggleVoice?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title = 'ATLAS AI',
    subtitle = 'Your personal learning assistant',
    onClear,
    variant = 'default',
    isVoiceActive = false,
    onToggleVoice,
}) => {
    const isMentor = variant === 'mentor';

    return (
        <div className={`flex items-center gap-3 border-b-2 border-black bg-black text-white relative z-30 transition-all ${isMentor ? 'p-2' : 'p-4'}`}>
            <div className="flex-shrink-0">
                <div className={`${isMentor ? 'p-1.5' : 'p-2'} bg-neo-accent border-2 border-white -rotate-2 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]`}>
                    <Brain className={`${isMentor ? 'h-4 w-4' : 'h-6 w-6'} text-white stroke-[2.5px]`} />
                </div>
            </div>

            <div className="flex-1">
                <h2 className={`${isMentor ? 'text-base' : 'text-lg'} font-black uppercase tracking-tight italic flex items-center gap-1.5`}>
                    {title.toUpperCase()}
                    {!isMentor && <Sparkles className="h-4 w-4 text-neo-secondary" />}
                </h2>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
                {onToggleVoice && (
                    <button
                        type="button"
                        onClick={onToggleVoice}
                        className={`p-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#FFF] transition-all hover:translate-x-[-0.5px] hover:translate-y-[-0.5px] ${isVoiceActive ? 'bg-neo-secondary text-black' : 'bg-white/10 text-white/60'}`}
                        title={isVoiceActive ? "Disable Hands-free Voice" : "Enable Hands-free Voice"}
                    >
                        {isVoiceActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </button>
                )}

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-1.5 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:bg-neo-accent hover:text-white active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                        title="Clear Chat"
                    >
                        <Trash2 className="h-4 w-4 stroke-[2.5px]" />
                    </button>
                )}
            </div>
        </div>
    );
};

