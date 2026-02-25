import React from 'react';


interface SuggestedQuestionsProps {
    questions: string[];
    onSelect: (question: string) => void;
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({ questions, onSelect }) => {
    if (!questions || questions.length === 0) return null;
    return (
        <div className="px-6 py-4 bg-transparent relative z-30">
            <div className="flex flex-wrap gap-2">
                {questions.map((q, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(q)}
                        className="px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-full border border-slate-200 hover:bg-slate-50 hover:border-blue-500/30 transition-all shadow-sm active:scale-95"
                    >
                        {q}
                    </button>
                ))}
            </div>
        </div>
    );
};
