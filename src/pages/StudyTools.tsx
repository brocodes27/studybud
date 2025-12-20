import { useState } from 'react';
import { Brain, FileText, Zap, Target, Timer, ListTodo } from 'lucide-react';

import { FlashcardGenerator } from '../components/FlashcardGenerator';
import { PracticeTestEngine } from '../components/PracticeTestEngine';
import { QuestionGenerator } from '../components/QuestionGenerator';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { TodoTracker } from '../components/TodoTracker';

export function StudyTools() {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tests' | 'ai-questions' | 'pomodoro' | 'todo'>('flashcards');

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
      id: 'pomodoro' as const,
      label: 'Focus Timer',
      icon: Timer,
      description: 'Deep work sessions',
      color: 'from-orange-500 to-red-600',
      iconColor: 'text-orange-500'
    },
    {
      id: 'todo' as const,
      label: 'Study Tasks',
      icon: ListTodo,
      description: 'Organize your goals',
      color: 'from-pink-500 to-rose-600',
      iconColor: 'text-pink-500'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-blue/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-neon-purple rounded-2xl flex items-center justify-center shadow-lg shadow-neon-blue/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Study Tools</span>
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Supercharge your learning with AI-powered flashcards, practice tests, and question generators designed to maximize your academic success.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
        <div className="glass-panel p-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 relative overflow-hidden group ${isActive
                    ? 'bg-white/10 text-white shadow-lg border border-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-10`}></div>
                  )}
                  <div className={`p-2 rounded-lg ${isActive ? `bg-gradient-to-br ${tab.color}` : 'bg-white/5 group-hover:bg-white/10'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : tab.iconColor}`} />
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>{tab.label}</div>
                    <div className="text-xs opacity-70">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto">
        <div className="glass-card border border-white/10 p-1 rounded-3xl overflow-hidden min-h-[500px]">
          {activeTab === 'flashcards' && <FlashcardGenerator />}
          {activeTab === 'tests' && <PracticeTestEngine />}
          {activeTab === 'ai-questions' && <QuestionGenerator />}
          {activeTab === 'pomodoro' && <PomodoroTimer />}
          {activeTab === 'todo' && <TodoTracker />}
        </div>
      </div>
    </div>
  );
}