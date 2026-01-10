import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface SuggestedQuestionsProps {
    questions: string[];
    onSelect: (question: string) => void;
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({ questions, onSelect }) => {
    if (!questions || questions.length === 0) return null;
    return (
        <div className="p-6 border-t-4 border-black bg-neo-bg relative z-30">
            <h3 className="text-[10px] font-black text-black mb-4 flex items-center gap-2 uppercase tracking-[0.2em]">
                <div className="bg-neo-accent p-1 border-2 border-black -rotate-12 shadow-[2px_2px_0px_0px_#000]">
                    <Sparkles className="h-3 w-3 text-white stroke-[2.5px]" />
                </div>
                SUGGESTED QUERIES
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {questions.map((q, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(q)}
                        className={`
                            group text-left text-[10px] font-black text-black bg-white 
                            border-4 border-black p-4 transition-all duration-200 
                            flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_#000]
                            hover:bg-neo-secondary hover:shadow-[6px_6px_0px_0px_#000] 
                            active:shadow-none active:translate-x-[2px] active:translate-y-[2px]
                            ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'}
                        `}
                    >
                        <span className="uppercase tracking-tight leading-tight">{q}</span>
                        <div className="flex-shrink-0 bg-black p-1 border-2 border-black -rotate-6 group-hover:rotate-0 transition-transform">
                            <ArrowRight className="h-4 w-4 text-white stroke-[3px]" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
