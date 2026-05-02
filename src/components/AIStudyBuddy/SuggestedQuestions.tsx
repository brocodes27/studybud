import React from 'react';
import { Zap } from 'lucide-react';

interface SuggestedQuestionsProps {
    questions: string[];
    onSelect: (question: string) => void;
    mechanism?: 'irt_adaptive' | 'random_fallback';
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({ questions, onSelect, mechanism }) => {
    if (!questions || questions.length === 0) return null;

    return (
        <div className="px-6 py-4 bg-transparent relative z-30">
            {/* Adaptive indicator */}
            {mechanism === 'irt_adaptive' && (
                <div className="flex items-center gap-1.5 mb-3">
                    <Zap className="w-3.5 h-3.5 text-[#00D1FF]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#00D1FF]">IRT-Adaptive Selection</span>
                    <span className="text-[10px] text-slate-400">· Questions at your optimal difficulty</span>
                </div>
            )}
            {mechanism === 'random_fallback' && (
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[10px] text-slate-400">Question pool building</span>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {questions.map((q, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(q)}
                        className="px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-full border border-slate-200 hover:bg-slate-50 hover:border-blue-500/30 transition-all shadow-sm active:scale-95 relative"
                    >
                        {mechanism === 'irt_adaptive' && (
                            <Zap className="w-3 h-3 text-[#34D399] absolute -top-1.5 -right-1.5" />
                        )}
                        {q}
                    </button>
                ))}
            </div>
        </div>
    );
};
