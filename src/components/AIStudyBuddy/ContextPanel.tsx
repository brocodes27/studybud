import React from 'react';
import { BookOpen, ChevronDown, FileText, Calendar } from 'lucide-react';

interface StudyPlan {
    id: string;
    subject: string;
    class: string;
    chapters: string;
    created_at?: string;
    exam_date?: string;
    plan: { daily_schedule: Array<{ day: number; topic: string; description: string }> };
}

interface ContextPanelProps {
    notes: string;
    setNotes: (v: string) => void;
    saveNotes: (v: string) => void;
    homework: string;
    setHomework: (v: string) => void;
    selectedPlan: string;
    setSelectedPlan: (v: string) => void;
    studyPlans: StudyPlan[];
    showContext: boolean;
    setShowContext: (v: boolean) => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
    notes,
    setNotes,
    saveNotes,
    homework,
    setHomework,
    selectedPlan,
    setSelectedPlan,
    studyPlans,
    showContext,
    setShowContext,
}) => {
    return (
        <div className="border-b border-white/10 glass-card">
            <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-neon-blue" />
                    <span>Study Context</span>
                    <span className="text-xs text-gray-500 font-normal ml-2 hidden sm:inline-block">
                        (Notes & Plan Selection)
                    </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${showContext ? 'rotate-180' : ''}`} />
            </button>

            {showContext && (
                <div className="p-4 pt-0 space-y-4 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-3 w-3" /> Personal Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => { setNotes(e.target.value); saveNotes(e.target.value); }}
                            placeholder="Add school updates, syllabus focus, weak topics..."
                            className="input-field w-full h-20 text-sm resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-3 w-3" /> Today's Homework
                        </label>
                        <textarea
                            value={homework}
                            onChange={(e) => setHomework(e.target.value)}
                            placeholder="Paste questions or describe assigned homework..."
                            className="input-field w-full h-16 text-sm resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Active Study Plan
                        </label>
                        <div className="relative">
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                className="input-field w-full appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-gray-900 text-gray-400">Select a study plan...</option>
                                {studyPlans.map((plan) => (
                                    <option key={plan.id} value={plan.id} className="bg-gray-900 text-white">
                                        {plan.subject} - Class {plan.class}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
