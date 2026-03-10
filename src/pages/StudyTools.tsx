import { useState } from 'react';
import { Brain, FileText, Zap, Target, Timer, Layers } from 'lucide-react';

import { FlashcardGenerator } from '../components/FlashcardGenerator';
import { PracticeTestEngine } from '../components/PracticeTestEngine';
import { QuestionGenerator } from '../components/QuestionGenerator';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { TodoTracker } from '../components/TodoTracker';
import { Progresser } from '../components/Progresser';

export function StudyTools() {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tests' | 'ai-questions' | 'focus' | 'progresser'>('flashcards');

  const tabs = [
    {
      id: 'flashcards' as const,
      label: 'AI Flashcards',
      icon: Brain,
      description: 'Smart spaced repetition learning',
      color: 'from-neon-blue to-blue-600',
      iconColor: 'text-neon-blue'
    },
    {
      id: 'tests' as const,
      label: 'Practice Tests',
      icon: FileText,
      description: 'AI-generated practice exams',
      color: 'from-neon-green to-green-600',
      iconColor: 'text-neon-green'
    },
    {
      id: 'ai-questions' as const,
      label: 'AI Question Generator',
      icon: Target,
      description: 'AI-generated questions',
      color: 'from-neon-purple to-purple-600',
      iconColor: 'text-neon-purple'
    },
    {
      id: 'focus' as const,
      label: 'Focus Mode',
      icon: Timer,
      description: 'Timer + Task List',
      color: 'from-blue-500 to-cyan-500',
      iconColor: 'text-neo-accent'
    },
    {
      id: 'progresser' as const,
      label: 'Progresser',
      icon: Layers,
      description: 'Adaptive Level Training',
      color: 'from-pink-500 to-rose-600',
      iconColor: 'text-pink-500'
    }
  ];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center shadow-float-cyan">
          <Zap className="h-7 w-7 text-[#00D1FF] stroke-[2.5px]" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Study Tools</h1>
          <p className="text-[#64748B] font-medium">AI-powered flashcards, practice tests, and focus tools</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-5 py-3 rounded-[16px] border-2 transition-all font-bold text-sm ${
                isActive
                  ? 'bg-[#00D1FF] border-[#00D1FF] text-[#0A192F] shadow-float-cyan'
                  : 'bg-white border-[#0A192F]/10 text-[#64748B] hover:border-[#00D1FF]/30 hover:text-[#0A192F]'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[2.5px]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="neo-card overflow-hidden min-h-[600px]">
        {activeTab === 'flashcards' && <FlashcardGenerator />}
        {activeTab === 'tests' && <PracticeTestEngine />}
        {activeTab === 'ai-questions' && <QuestionGenerator />}
        {activeTab === 'progresser' && <Progresser />}
        {activeTab === 'focus' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[#0A192F]/5">
            <PomodoroTimer />
            <TodoTracker />
          </div>
        )}
      </div>
    </div>
  );
}