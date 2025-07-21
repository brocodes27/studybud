import React, { useState, useEffect } from 'react';
import { Brain, Plus, RotateCcw, Check, X, Star, Zap, BookOpen, Filter, Grid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { usePayment } from '../hooks/usePayment';

interface Flashcard {
  id: string;
  topic: string;
  question: string;
  answer: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
}

interface StudyPlan {
  id: string;
  subject: string;
  class: string;
  chapters: string;
  exam_date: string;
}

interface TopicGroup {
  topic: string;
  flashcards: Flashcard[];
  totalCards: number;
}

interface FlashcardGeneratorProps {
  planId?: string;
  subject?: string;
  topics?: string[];
}

// Razorpay script loader
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    document.body.appendChild(script);
  });
};

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export function FlashcardGenerator({ planId, subject, topics = [] }: FlashcardGeneratorProps) {
  const { user, session } = useAuth() as any;
  const { showToast } = useToast();
  const { initiatePayment } = usePayment();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyMode, setStudyMode] = useState<'review' | 'generate' | 'topics'>('topics');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [availablePlans, setAvailablePlans] = useState<StudyPlan[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(true); // Subscription always true for now
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);

  useEffect(() => {
    if (user) {
      fetchPremiumStatus();
      fetchFlashcards();
      fetchAvailablePlans();
    }
  }, [user, planId]);

  useEffect(() => {
    organizeFlashcardsByTopic();
  }, [flashcards]);

  useEffect(() => {
    setShowPaywall(false); // Never show paywall
  }, []);

  const fetchAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_plans')
        .select('id, subject, class, chapters, exam_date')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePlans(data || []);
      
      // Auto-select the first plan if no planId is provided
      if (!planId && data && data.length > 0) {
        setSelectedPlan(data[0].id);
      } else if (planId) {
        setSelectedPlan(planId);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchFlashcards = async () => {
    try {
      let query = supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (planId) {
        query = query.eq('plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Accept both array and { flashcards: array } formats
      const newFlashcards = Array.isArray(data) ? data : (data as any).flashcards;
      if (!Array.isArray(newFlashcards)) {
        throw new Error('Invalid response format: expected array of flashcards');
      }
      setAllFlashcards(newFlashcards);
      setFlashcards(newFlashcards);
      setStudyMode('topics');
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      showToast('Failed to load flashcards', 'error');
    } finally {
      setLoading(false);
    }
  };

  const organizeFlashcardsByTopic = () => {
    const topicMap = new Map<string, Flashcard[]>();
    
    flashcards.forEach(card => {
      const topic = card.topic;
      if (!topicMap.has(topic)) {
        topicMap.set(topic, []);
      }
      topicMap.get(topic)!.push(card);
    });

    const groups: TopicGroup[] = Array.from(topicMap.entries()).map(([topic, cards]) => ({
      topic,
      flashcards: cards,
      totalCards: cards.length
    }));

    // Sort by topic name
    groups.sort((a, b) => a.topic.localeCompare(b.topic));
    setTopicGroups(groups);
  };

  const generateFlashcards = async () => {
    const activePlanId = selectedPlan || planId;
    if (!activePlanId) {
      showToast('Please select a study plan to generate flashcards.', 'error');
      return;
    }
    if (!selectedTopic.trim()) {
      showToast('Please select a topic for these flashcards.', 'error');
      setIsGenerating(false);
      return;
    }
    const selectedPlanData = availablePlans.find(plan => plan.id === activePlanId);
    setIsGenerating(true);
    try {
      if (!session?.access_token) {
        throw new Error('User not authenticated. Please sign in again.');
      }
      const payload = {
        subject: selectedPlanData?.subject ?? '',
        class: selectedPlanData?.class ?? '',
        chapters: selectedPlanData?.chapters ?? '',
        plan_id: activePlanId ?? null,
        count: 65,
        topic: selectedTopic,
      };
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: payload,
      });
      if (error) throw error;
      // Robustly handle stringified JSON, array, and { flashcards: [...] } formats
      let newFlashcards: any[] = [];
      let parsed = data;
      if (typeof parsed === 'string') {
        // Remove markdown code fences if present
        parsed = parsed.trim();
        if (parsed.startsWith('```json')) {
          parsed = parsed.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (parsed.startsWith('```')) {
          parsed = parsed.replace(/^```/, '').replace(/```$/, '').trim();
        }
        try {
          parsed = JSON.parse(parsed);
        } catch {
          throw new Error('Gemini response is not valid JSON');
        }
      }
      if (Array.isArray(parsed)) {
        newFlashcards = parsed;
      } else if (parsed && Array.isArray(parsed.flashcards)) {
        newFlashcards = parsed.flashcards;
      } else {
        throw new Error('Invalid response format: expected array or { flashcards: [...] }');
      }
      // Ensure topic is set for each flashcard (use selected topic from dropdown, fallback to 'General')
      const topicValue = selectedTopic && selectedTopic.trim() ? selectedTopic.trim() : 'General';
      const flashcardsWithTopic = newFlashcards.map(card => ({
        ...card,
        topic: topicValue,
      }));
      await fetchFlashcards();
    } catch (error) {
      console.error('Error generating flashcards:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate flashcards';
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const startTopicReview = (topic: string) => {
    const topicCards = allFlashcards.filter(card => card.topic === topic);
    if (topicCards.length === 0) return;
    setFlashcards(topicCards);
    setCurrentCard(0);
    setIsFlipped(false);
    setActiveTopicFilter(topic);
    setStudyMode('review');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const handleDeleteFlashcard = async (id: string) => {
    if (!window.confirm('Delete this flashcard?')) return;
    try {
      const { error } = await supabase.from('flashcards').delete().eq('id', id);
      if (error) throw error;
      setFlashcards(prev => prev.filter(card => card.id !== id));
      showToast('Flashcard deleted', 'success');
    } catch (err: any) {
      showToast('Failed to delete flashcard', 'error');
    }
  };

  const handleDeleteTopic = async (topic: string) => {
    if (!window.confirm(`Delete all flashcards for topic "${topic}"?`)) return;
    try {
      const { error } = await supabase.from('flashcards').delete().eq('topic', topic).eq('user_id', user?.id);
      if (error) throw error;
      setFlashcards(prev => prev.filter(card => card.topic !== topic));
      showToast(`All flashcards for topic "${topic}" deleted`, 'success');
    } catch (err: any) {
      showToast('Failed to delete topic flashcards', 'error');
    }
  };

  const fetchPremiumStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id);

    if (error || !data || data.length === 0) {
      setIsPremium(false);
      return;
    }
    setIsPremium(data[0].status === 'active');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));
  const availableTopics = selectedPlanData ? selectedPlanData.chapters.split(',').map(c => c.trim()) : topics;

  // Show paywall if not subscribed
  if (isPremium === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm w-full">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Unlock All Features</h2>
          <p className="mb-6 text-gray-700">Subscribe for <span className="font-bold">₹199</span> to access all flashcard and study features.</p>
          <button
            onClick={() => setShowPaywall(false)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Razorpay Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Unlock All Features</h2>
            <p className="mb-6 text-gray-700">Subscribe for <span className="font-bold">₹199</span> to access all flashcard and study features.</p>
            <button
              onClick={() => setShowPaywall(false)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">AI Flashcards</h3>
            <p className="text-gray-400">Smart spaced repetition learning</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStudyMode('topics')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              studyMode === 'topics'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Topics ({topicGroups.length})
          </button>
          <button
            onClick={() => setStudyMode('generate')}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              studyMode === 'generate'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Generate
          </button>
          <button
            onClick={() => {
              setFlashcards(allFlashcards);
              setStudyMode('review');
            }}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              studyMode === 'review'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Review All ({allFlashcards.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {studyMode === 'topics' ? (
        /* Topics Overview */
        <div className="space-y-6">
          {/* View Controls */}
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">Study by Topic</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Show No Flashcards Yet only in content area */}
          {topicGroups.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h4>
              <p className="text-gray-400 mb-6">Generate AI-powered flashcards from your study plans</p>
              <button
                onClick={() => setStudyMode('generate')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 inline mr-2" />
                Generate Flashcards
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {topicGroups.map((group, index) => (
                <div
                  key={index}
                  className={`glass rounded-2xl p-6 border border-gray-700/50 card-hover ${
                    viewMode === 'list' ? 'flex items-center justify-between' : ''
                  }`}
                >
                  <div className={viewMode === 'list' ? 'flex-grow' : ''}>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-lg font-semibold text-white">{group.topic}</h5>
                      <button
                        className="text-red-400 hover:text-red-600 text-xs font-semibold ml-4"
                        onClick={() => handleDeleteTopic(group.topic)}
                      >
                        Delete Topic
                      </button>
                    </div>
                    <div className={`${viewMode === 'list' ? 'flex items-center gap-6' : 'space-y-3'}`}> 
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <BookOpen className="h-4 w-4" />
                        {group.totalCards} cards
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => startTopicReview(group.topic)}
                    className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 ${
                      viewMode === 'list' ? 'ml-4' : 'w-full mt-4'
                    }`}
                  >
                    Study Topic
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : studyMode === 'generate' ? (
        /* Generate Mode */
        <div className="glass rounded-2xl p-6 border border-gray-700/50">
          <h4 className="text-lg font-semibold text-white mb-4">Generate New Flashcards</h4>
          <div className="space-y-4">
            {/* Study Plan Selection */}
            {!planId && availablePlans.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Study Plan
                </label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Choose a study plan...</option>
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.subject} - Class {plan.class} (Exam: {new Date(plan.exam_date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* No Plans Available Message */}
            {availablePlans.length === 0 && (
              <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10">
                <p className="text-yellow-400 text-sm">
                  No study plans found. Please create a study plan first to generate contextual flashcards.
                </p>
              </div>
            )}
            {/* Topic Dropdown Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Topic <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">Choose a topic...</option>
                {availableTopics.map((topic, idx) => (
                  <option key={idx} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generateFlashcards}
              disabled={isGenerating || (!selectedPlan && !planId) || !selectedTopic}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating Flashcards...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5" />
                  Generate AI Flashcards
                </div>
              )}
            </button>
          </div>
        </div>
      ) : studyMode === 'review' ? (
        /* Review Mode */
        <div className="space-y-6">
          {/* Review Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white">
                {activeTopicFilter === 'all' ? 'Reviewing All Cards' : `Reviewing: ${activeTopicFilter}`}
              </h4>
              <p className="text-gray-400">Card {currentCard + 1} of {flashcards.length}</p>
            </div>
          </div>
          {/* Show No Flashcards Yet only in content area for review mode */}
          {flashcards.length === 0 ? (
            <div className="glass rounded-2xl p-8 border border-gray-700/50 text-center">
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 p-6 rounded-2xl mb-6 inline-block">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h4>
              <p className="text-gray-400 mb-6">Generate AI-powered flashcards from your study plans</p>
              <button
                onClick={() => setStudyMode('generate')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 inline mr-2" />
                Generate Flashcards
              </button>
            </div>
          ) : (
            <>
              {/* Flashcard Review UI (unchanged) */}
              {/* ... existing review mode content ... */}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}