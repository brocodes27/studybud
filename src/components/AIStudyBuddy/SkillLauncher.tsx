import React from 'react';
import {
    BookOpen, Target, Zap,
    Flame, Calendar, Sparkles
} from 'lucide-react';

interface Skill {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
}

interface SkillLauncherProps {
    onStartSkill: (id: string) => void;
    activeSkillId: string | null;
}

const SKILLS: Skill[] = [
    {
        id: 'dailyStudy',
        label: 'Daily Mission',
        description: 'Start today\'s focus session',
        icon: Zap,
        color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    },
    {
        id: 'curriculumPlanner',
        label: 'Plan Syllabus',
        description: 'Structure your learning path',
        icon: BookOpen,
        color: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    },
    {
        id: 'examApplier',
        label: 'Exam Roadmap',
        description: 'Target specific exam dates',
        icon: Target,
        color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    },
    {
        id: 'remediate',
        label: 'Weak Spots',
        description: 'Master difficult topics',
        icon: Flame,
        color: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    },
    {
        id: 'rescheduler',
        label: 'Shift Plan',
        description: 'Handle missed study days',
        icon: Calendar,
        color: 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    }
];

export const SkillLauncher: React.FC<SkillLauncherProps> = ({ onStartSkill, activeSkillId }) => {
    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Neural Skills Palette
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {SKILLS.map((skill) => (
                    <button
                        key={skill.id}
                        onClick={() => onStartSkill(skill.id)}
                        disabled={activeSkillId === skill.id}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all group relative overflow-hidden ${activeSkillId === skill.id
                                ? 'bg-blue-600/20 border-blue-500/50 cursor-default'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        <div className={`p-3 rounded-xl border ${skill.color}`}>
                            <skill.icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 text-left">
                            <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                {skill.label}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                                {skill.description}
                            </p>
                        </div>

                        {activeSkillId === skill.id && (
                            <div className="absolute top-0 right-0 p-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
