import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface SuggestedQuestionsProps {
    questions: string[];
    onSelect: (question: string) => void;
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({ questions, onSelect }) => {
    if (!questions || questions.length === 0) return null;
    return (
        <div className="p-4 border-t border-white/10 glass-card">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-yellow-400" /> Suggested Questions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {questions.map((q, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(q)}
                        className="group text-left text-xs text-gray-300 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl p-3 transition-all duration-200 flex items-center justify-between"
                    >
                        <span className="line-clamp-2">{q}</span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200 text-neon-blue" />
                    </button>
                ))}
            </div>
        </div>
    );
};
