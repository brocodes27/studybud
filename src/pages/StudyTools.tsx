import { useState } from 'react';
import { Brain, FileText, Zap, Target } from 'lucide-react';

import { FlashcardGenerator } from '../components/FlashcardGenerator';
import { PracticeTestEngine } from '../components/PracticeTestEngine';
import { QuestionGenerator } from '../components/QuestionGenerator';

export function StudyTools() {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tests' | 'ai-questions'>('flashcards');

  const tabs = [
    {
      id: 'flashcards' as const,
      label: 'AI Flashcards',
      icon: Brain,
      description: 'Smart spaced repetition learning',
      color: 'from-primary-500 to-primary-600'
    },
    {
      id: 'tests' as const,
      label: 'Practice Tests',
      icon: FileText,
      description: 'AI-generated practice exams',
      color: 'from-success-500 to-success-600'
    },
    {
      id: 'ai-questions' as const,
      label: 'AI Question Generator',
      icon: Target,
      description: 'AI-generated questions',
      color: 'from-accent-500 to-accent-600'
    }
  ];



  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center glow-blue">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            AI <span className="gradient-text">Study Tools</span>
          </h1>
        </div>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Supercharge your learning with AI-powered flashcards, practice tests, and question generators designed to maximize your academic success.
        </p>
      </div>



      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
        <div className="card-elevated p-2">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.color} text-white font-semibold shadow-lg`
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">{tab.label}</div>
                    <div className="text-xs opacity-80">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto">
        <div className="card-elevated">
          {activeTab === 'flashcards' && <FlashcardGenerator />}
          {activeTab === 'tests' && <PracticeTestEngine />}
          {activeTab === 'ai-questions' && <QuestionGenerator />}
        </div>
      </div>
    </div>
  );
}