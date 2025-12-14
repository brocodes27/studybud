import React from 'react';
import { Brain, Sparkles, Trash2 } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    onClear?: () => void;
    variant?: 'default' | 'mentor';
}

export const Header: React.FC<HeaderProps> = ({
    title = 'AI Study Buddy',
    subtitle = 'Your personal learning assistant',
    onClear,
    variant = 'default',
}) => {
    const isMentor = variant === 'mentor';
    return (
        <>{!isMentor && (
            <div className="flex items-center gap-4 p-5 border-b border-white/10 glass-card backdrop-blur-md rounded-t-2xl">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl opacity-75 group-hover:opacity-100 blur transition duration-200"></div>
                    <div className="relative bg-black p-2.5 rounded-xl border border-white/10">
                        <Brain className="h-6 w-6 text-neon-blue" />
                    </div>
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        {title}
                        <Sparkles className="h-4 w-4 text-neon-yellow animate-pulse-slow" />
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">{subtitle}</p>
                </div>
                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all duration-200 group"
                        title="Clear Chat"
                    >
                        <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    </button>
                )}
            </div>
        )}</>
    );
};
