import React from 'react';
import { Sparkles, Trash2, Mic, MicOff } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    onClear?: () => void;
    variant?: 'default' | 'mentor';
    isVoiceActive?: boolean;
    onToggleVoice?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title = 'ATLAS',
    onClear,
    onToggleVoice,
    isVoiceActive = false,
}) => {

    return (
        <div className="flex items-center justify-between px-6 py-3 bg-[#F8FAF9] border-b border-slate-100 transition-all">
            {/* Left: Brand Mark */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-800 tracking-tight">{title}</span>
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Pro</span>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
                {onToggleVoice && (
                    <button
                        type="button"
                        onClick={onToggleVoice}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isVoiceActive ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                        title={isVoiceActive ? "Disable Hands-free Voice" : "Enable Hands-free Voice"}
                    >
                        {isVoiceActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </button>
                )}

                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Clear Chat"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
};
