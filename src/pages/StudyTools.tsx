import React, { useState } from 'react';
import { Brain, FileText, Zap, Target } from 'lucide-react';
import { FlashcardGenerator } from '../components/FlashcardGenerator';
import { PracticeTestEngine } from '../components/PracticeTestEngine';

export function StudyTools() {
  const [activeTab, setActiveTab] = useState<'flashcards' | 'tests'>('flashcards');

  const tabs = [
    {
      id: 'flashcards' as const,
      label: 'AI Flashcards',
      icon: Brain,
      description: 'Smart spaced repetition learning'
    },
    {
      id: 'tests' as const,
      label: 'Practice Tests',
      icon: FileText,
      description: 'AI-generated practice exams'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-4 rounded-2xl shadow-lg glow-purple">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold gradient-text">
            AI Study Tools
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Supercharge your learning with AI-powered flashcards and practice tests
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="glass rounded-2xl p-2 border border-gray-700/50">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 font-semibold glow-blue'
                      : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <div className="text-left">
                    <div>{tab.label}</div>
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
        {activeTab === 'flashcards' && <FlashcardGenerator />}
        {activeTab === 'tests' && <PracticeTestEngine />}
      </div>
    </div>
  );
}