import { useState } from 'react';
import { Brain, FileText, Zap, Target, Timer } from 'lucide-react';

import { FlashcardGenerator } from '../components/FlashcardGenerator';
import { PracticeTestEngine } from '../components/PracticeTestEngine';
import { QuestionGenerator } from '../components/QuestionGenerator';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { TodoTracker } from '../components/TodoTracker';

export function StudyTools() {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tests' | 'ai-questions' | 'focus'>('flashcards');

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
      color: 'from-orange-500 to-rose-600',
      iconColor: 'text-orange-500'
    }
  ];

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      {/* Header */}
      <div className="text-center mb-16 relative">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 bg-neo-accent border-4 border-black flex items-center justify-center shadow-[6px_6px_0px_0px_#000] -rotate-12">
            <Zap className="w-12 h-12 text-white stroke-[4px]" />
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-black tracking-tighter uppercase italic leading-none">
            <span className="bg-white px-8 py-4 border-8 border-black shadow-[12px_12px_0px_0px_#000] inline-block rotate-2">STUDY TOOLS</span>
          </h1>
        </div>
        <div className="mt-12 bg-neo-muted border-4 border-black p-6 inline-block -rotate-1 shadow-[4px_4px_0px_0px_#000] max-w-2xl">
          <p className="text-lg font-black text-black uppercase tracking-widest leading-snug">
            SUPERCHARGE YOUR ARCHIVE WITH AI-POWERED FLASHCARDS, PRACTICE TESTS, AND QUESTION GENERATORS.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-12">
        <div className="flex flex-wrap justify-center gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-4 px-8 py-5 border-4 border-black transition-all duration-200 
                  shadow-[6px_6px_0px_0px_#000] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
                  ${isActive
                    ? 'bg-neo-accent text-white rotate-2 -translate-y-2 shadow-[8px_8px_0px_0px_#000]'
                    : 'bg-white text-black hover:bg-neo-secondary'
                  }
                `}
              >
                <div className={`p-2 border-2 border-black ${isActive ? 'bg-black text-white' : 'bg-neo-bg'}`}>
                  <Icon className="w-6 h-6 stroke-[3px]" />
                </div>
                <div className="text-left">
                  <div className="font-black uppercase tracking-tighter text-lg leading-none">{tab.label}</div>
                  <div className={`text-[10px] font-black uppercase tracking-widest opacity-60 mt-1`}>{tab.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white border-8 border-black shadow-[20px_20px_0px_0px_#000] overflow-hidden min-h-[600px] relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-black opacity-5"></div>
          {activeTab === 'flashcards' && <FlashcardGenerator />}
          {activeTab === 'tests' && <PracticeTestEngine />}
          {activeTab === 'ai-questions' && <QuestionGenerator />}
          {activeTab === 'focus' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x-8 divide-black">
              <PomodoroTimer />
              <div className="border-t-8 lg:border-t-0 border-black">
                <TodoTracker />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}