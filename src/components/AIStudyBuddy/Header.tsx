import React from 'react';
import { Brain, Sparkles, Trash2 } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    onClear?: () => void;
    variant?: 'default' | 'mentor';
}

export const Header: React.FC<HeaderProps> = ({
    title = 'ELEVENFOLKS AI',
    subtitle = 'Your personal learning assistant',
    onClear,
    variant = 'default',
}) => {
    const isMentor = variant === 'mentor';
    return (
        <>{!isMentor && (
            <div className="flex items-center gap-5 p-6 border-b-4 border-black bg-black text-white relative z-30">
                <div className="flex-shrink-0">
                    <div className="bg-neo-accent p-3 border-2 border-white -rotate-3 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                        <Brain className="h-7 w-7 text-white stroke-[2.5px]" />
                    </div>
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                        {title.toUpperCase()}
                        <Sparkles className="h-5 w-5 text-neo-secondary" />
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{subtitle}</p>
                </div>
                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-3 bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:bg-neo-accent hover:text-white active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all group"
                        title="Clear Chat"
                    >
                        <Trash2 className="h-5 w-5 stroke-[2.5px] group-hover:scale-110 transition-transform" />
                    </button>
                )}
            </div>
        )}</>
    );
};

