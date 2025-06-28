import React from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { Brain, Sparkles } from 'lucide-react';

export function AIStudyBuddyPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Study Buddy
              </h1>
              <Sparkles className="h-8 w-8 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Your personal AI learning assistant. Ask questions, get explanations, and receive study guidance tailored to your subjects and study plans.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden h-[600px]">
          <AIStudyBuddy />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            What can your AI Study Buddy do?
          </h2>
          <p className="text-gray-400 text-lg">
            Get personalized help with your studies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-blue-500/20 p-3 rounded-lg w-fit mb-4">
              <Brain className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Subject Help</h3>
            <p className="text-gray-400">
              Ask questions about any subject - Physics, Math, Chemistry, Biology, and more. Get clear explanations tailored to your class level.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-green-500/20 p-3 rounded-lg w-fit mb-4">
              <Sparkles className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Study Plan Integration</h3>
            <p className="text-gray-400">
              Connect with your study plans for contextual help. Get guidance on today's topics and practice questions.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-purple-500/20 p-3 rounded-lg w-fit mb-4">
              <Brain className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Step-by-Step Solutions</h3>
            <p className="text-gray-400">
              Get detailed explanations for complex problems. Learn the process, not just the answer.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-yellow-500/20 p-3 rounded-lg w-fit mb-4">
              <Sparkles className="h-6 w-6 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Practice Questions</h3>
            <p className="text-gray-400">
              Request additional practice problems on any topic. Get questions with explanations to test your understanding.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-red-500/20 p-3 rounded-lg w-fit mb-4">
              <Brain className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Concept Clarification</h3>
            <p className="text-gray-400">
              Confused about a concept? Get it explained in simple terms with analogies and examples.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50">
            <div className="bg-indigo-500/20 p-3 rounded-lg w-fit mb-4">
              <Sparkles className="h-6 w-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Voice Input</h3>
            <p className="text-gray-400">
              Use voice commands to ask questions hands-free. Perfect for when you're studying with books open.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 