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
        <div className="border-b-2 border-black bg-white relative z-20">
            <button
                type="button"
                onClick={() => setShowContext(!showContext)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-black uppercase tracking-widest text-black hover:bg-neo-bg transition-colors"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-neo-accent stroke-[3px]" />
                    <span>STUDY CONTEXT</span>
                    <span className="text-[9px] text-black/40 font-black ml-2 hidden sm:inline-block">
                        (NOTES & PLAN SELECTION)
                    </span>
                </div>
                <div className={`p-1 border-2 border-black transition-transform duration-300 ${showContext ? 'rotate-180' : ''}`}>
                    <ChevronDown className="h-3.5 w-3.5 stroke-[3px]" />
                </div>
            </button>

            {showContext && (
                <div className="p-4 pt-0 space-y-4 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 stroke-[2.5px]" /> PERSONAL NOTES
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => { setNotes(e.target.value); saveNotes(e.target.value); }}
                            placeholder="Add school updates, syllabus focus, weak topics..."
                            className="w-full h-20 bg-neo-bg border-2 border-black p-3 text-xs font-bold placeholder-black/20 focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-[-1px] focus:translate-y-[-1px] transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 stroke-[2.5px]" /> TODAY'S HOMEWORK
                        </label>
                        <textarea
                            value={homework}
                            onChange={(e) => setHomework(e.target.value)}
                            placeholder="Paste questions or describe assigned homework..."
                            className="w-full h-16 bg-neo-bg border-2 border-black p-3 text-xs font-bold placeholder-black/20 focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-[-1px] focus:translate-y-[-1px] transition-all"
                        />
                    </div>

                    <div className="space-y-2 pb-2">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 stroke-[2.5px]" /> ACTIVE STUDY PLAN
                        </label>
                        <div className="relative">
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                className="w-full bg-neo-bg border-2 border-black p-3 text-xs font-black uppercase tracking-tight focus:outline-none focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-[-1px] focus:translate-y-[-1px] transition-all cursor-pointer appearance-none"
                            >
                                <option value="" className="text-black/30">SELECT A STUDY PLAN...</option>
                                {studyPlans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.subject} - CLASS {plan.class}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown className="h-4 w-4 stroke-[3px]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

