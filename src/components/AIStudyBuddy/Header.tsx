import React from 'react';
import { Brain, Trash2, Mic, MicOff } from 'lucide-react';

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
    onClear,
    onToggleVoice,
    isVoiceActive = false,
}) => {

    return (
        <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-transparent text-white relative z-30 transition-all">
            <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Brain className="h-6 w-6 text-white" />
                </div>
            </div>

            <div className="flex-1">
                <h2 className="text-xl font-bold text-white tracking-tight">
                    {title}
                </h2>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400">AI Study Buddy</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[10px] font-medium text-blue-400">Active</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {onToggleVoice && (
                    <button
                        type="button"
                        onClick={onToggleVoice}
                        className={`p-1.5 border border-white/10 shadow-neo transition-all hover:translate-x-[-0.5px] hover:translate-y-[-0.5px] ${isVoiceActive ? 'bg-neo-secondary text-slate-100' : 'bg-slate-800/10 text-white/60'}`}
                        title={isVoiceActive ? "Disable Hands-free Voice" : "Enable Hands-free Voice"}
                    >
                        {isVoiceActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </button>
                )}

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-1.5 bg-slate-800 text-slate-100 border border-white/10 shadow-neo hover:bg-neo-accent hover:text-white active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                        title="Clear Chat"
                    >
                        <Trash2 className="h-4 w-4 stroke-[2.5px]" />
                    </button>
                )}
            </div>
        </div>
    );
};

