import React, { useState, useEffect } from 'react';
import { Brain, Plus, RotateCcw, Check, X, Star, Zap, BookOpen, Filter, Grid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

interface Flashcard {
  id: string;
  topic: string;
  question: string;
  answer: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  mastery_level: number;
  next_review_at: string;
  review_count: number;
  correct_count: number;
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
  averageMastery: number;
}

interface FlashcardGeneratorProps {
  planId?: string;
  subject?: string;
  topics?: string[];
}

export function FlashcardGenerator({ planId, subject, topics = [] }: FlashcardGeneratorProps) {
  const { user, session } = useAuth();
  const { showToast } = useToast();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [studyMode, setStudyMode] = useState<'review' | 'generate' | 'topics'>('topics');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [availablePlans, setAvailablePlans] = useState<StudyPlan[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFlashcards();
      fetchAvailablePlans();
    }
  }, [user, planId]);

  useEffect(() => {
    organizeFlashcardsByTopic();
  }, [flashcards]);

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

      setFlashcards(data || []);
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

    const groups: TopicGroup[] = Array.from(topicMap.entries()).map(([topic, cards]) => {
      const averageMastery = cards.reduce((sum, card) => sum + card.mastery_level, 0) / cards.length;
      return {
        topic,
        flashcards: cards,
        totalCards: cards.length,
        averageMastery: Math.round(averageMastery * 10) / 10
      };
    });

    // Sort by topic name
    groups.sort((a, b) => a.topic.localeCompare(b.topic));
    setTopicGroups(groups);
  };

  const generateFlashcards = async () => {
    const activePlanId = selectedPlan || planId;

    // Require at least one source: a study plan+topic, a free topic, or a PDF file
    if (!pdfFile && !selectedTopic && !activePlanId) {
      showToast('Please select a study plan, type a topic, or upload a PDF', 'error');
      return;
    }

    // Resolve plan data if we have one
    const selectedPlanData = activePlanId ? availablePlans.find(plan => plan.id === activePlanId) : undefined;

    // Determine topic: priority → explicit topic field, else first chapter of selected plan, else empty string
    const topicToUse =
      selectedTopic ||
      (!pdfFile && selectedPlanData?.chapters
        ? selectedPlanData.chapters.split(',')[0].trim()
        : '');
    if (!pdfFile && !topicToUse) {
      showToast('Please enter a topic or upload a PDF', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      // Check if we have the required environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.');
      }

      // Check if user is authenticated
      if (!session?.access_token) {
        throw new Error('User not authenticated. Please sign in again.');
      }

      console.log('Generating flashcards with data:', {
        topic: topicToUse,
        subject: selectedPlanData?.subject,
        class: selectedPlanData?.class,
        chapters: selectedPlanData?.chapters,
        plan_id: activePlanId,
        count: 10,
        pdf: Boolean(pdfFile)
      });

      // Invoke Supabase Edge Function using the JS client (adds auth headers automatically)
      let newFlashcards: Flashcard[] = []; // store freshly generated cards
      if (pdfFile) {
        const formData = new FormData();
        formData.append('file', pdfFile);
        if (selectedTopic) formData.append('topic', selectedTopic);
        if (activePlanId) formData.append('plan_id', activePlanId);
        if (selectedPlanData?.subject) formData.append('subject', selectedPlanData.subject);
        const { data, error } = await supabase.functions.invoke('generate-flashcards-from-pdf', {
          headers: {
            apikey: anonKey,
            authorization: `Bearer ${session?.access_token ?? anonKey}`,
            Authorization: `Bearer ${session?.access_token ?? anonKey}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });
        if (error) throw error;
        newFlashcards = data as Flashcard[];
      } else {
        const payload = {
          topic: topicToUse,
          subject: selectedPlanData?.subject ?? '',
          class: selectedPlanData?.class ?? '',
          chapters: selectedPlanData?.chapters ?? topicToUse,
          plan_id: activePlanId ?? null,
          count: 10,
        };
        const { data, error } = await supabase.functions.invoke('generate-flashcards', {
          body: payload,
        });
        if (error) throw error;
        newFlashcards = data as Flashcard[];
      }

      if (!Array.isArray(legacyFlashcards)) {
        throw new Error('Invalid response format: expected array of flashcards');
      }

      setFlashcards(prev => [...legacyFlashcards, ...prev]);
      showToast(`Generated ${legacyFlashcards.length} flashcards!`, 'success');
      setStudyMode('topics');
      return;

      // Decide which endpoint and payload to hit
      let apiUrl = `${supabaseUrl}/functions/v1/generate-flashcards`;
      let fetchOptions: RequestInit;

      if (pdfFile) {
        // PDF based generation
        apiUrl = `${supabaseUrl}/functions/v1/generate-flashcards-from-pdf`;
        const formData = new FormData();
        formData.append('file', pdfFile);
        // Only attach optional metadata if available
        if (selectedPlanData?.subject) formData.append('subject', selectedPlanData.subject);
        if (selectedTopic) formData.append('topic', selectedTopic);
        if (activePlanId) formData.append('plan_id', activePlanId);

        fetchOptions = {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'authorization': `Bearer ${session?.access_token ?? anonKey}`,
            'Authorization': `Bearer ${session?.access_token ?? anonKey}`,
          },
          body: formData,
        };
      } else {
        // Topic / plan based generation
        fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'authorization': `Bearer ${session?.access_token ?? anonKey}`,
            'Authorization': `Bearer ${session?.access_token ?? anonKey}`,
          },
          body: JSON.stringify({
            topic: topicToUse,
            subject: selectedPlanData?.subject ?? '',
            class: selectedPlanData?.class ?? '',
            chapters: selectedPlanData?.chapters ?? topicToUse,
            plan_id: activePlanId ?? null,
            count: 10,
          }),
        };
      }

      const apiUrlFinal = apiUrl; // just to satisfy linter

      const response = await fetch(apiUrlFinal, fetchOptions);

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // Parse the error response to get detailed error message
        let errorMessage = 'Failed to generate flashcards';
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          console.error('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = errorData.details || '';
        } catch (parseError) {
          // If we can't parse the response, try to get text
          try {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            // Use the HTTP status as fallback
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        
        const fullErrorMessage = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;
        throw new Error(fullErrorMessage);
      }

      const legacyFlashcards = await response.json();
      console.log('Generated flashcards (legacy):', legacyFlashcards);
      
      if (!Array.isArray(legacyFlashcards)) {
        throw new Error('Invalid response format: expected array of flashcards');
      }

      setFlashcards(prev => [...legacyFlashcards, ...prev]);
      showToast(`Generated ${legacyFlashcards.length} flashcards!`, 'success');
      setStudyMode('topics');
    } catch (error) {
      console.error('Error generating flashcards:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate flashcards';
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
      // reset pdfFile when done
      setPdfFile(null);
    }
  };

  const startTopicReview = (topic: string) => {
    const topicCards = flashcards.filter(card => card.topic === topic);
    if (topicCards.length === 0) return;
    
    setFlashcards(topicCards);
    setCurrentCard(0);
    setIsFlipped(false);
    setActiveTopicFilter(topic);
    setStudyMode('review');
  };

  const handleCardResponse = async (correct: boolean) => {
    const card = flashcards[currentCard];
    if (!card) return;

    try {
      const newMasteryLevel = correct 
        ? Math.min(card.mastery_level + 1, 5)
        : Math.max(card.mastery_level - 1, 0);

      const { error } = await supabase
        .from('flashcards')
        .update({
          mastery_level: newMasteryLevel,
          review_count: card.review_count + 1,
          correct_count: correct ? card.correct_count + 1 : card.correct_count,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq('id', card.id);

      if (error) throw error;

      // Update local state
      setFlashcards(prev => prev.map(fc => 
        fc.id === card.id 
          ? { 
              ...fc, 
              mastery_level: newMasteryLevel,
              review_count: fc.review_count + 1,
              correct_count: correct ? fc.correct_count + 1 : fc.correct_count
            }
          : fc
      ));

      // Move to next card
      nextCard();
    } catch (error) {
      console.error('Error updating flashcard:', error);
      showToast('Failed to update progress', 'error');
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setCurrentCard(prev => (prev + 1) % flashcards.length);
  };

  const previousCard = () => {
    setIsFlipped(false);
    setCurrentCard(prev => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getMasteryStars = (level: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < level ? 'text-yellow-400 fill-current' : 'text-gray-600'
        }`}
      />
    ));
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 4) return 'text-green-400';
    if (mastery >= 2) return 'text-yellow-400';
    return 'text-red-400';
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

  return (
    <div className="space-y-6">
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
              // Reset to all flashcards for review
              fetchFlashcards();
              setStudyMode('review');
            }}
            className={`px-4 py-2 rounded-lg transition-all duration-200 ${
              studyMode === 'review'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Review All ({flashcards.length})
          </button>
        </div>
      </div>

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
                    <h5 className="text-lg font-semibold text-white mb-2">{group.topic}</h5>
                    <div className={`${viewMode === 'list' ? 'flex items-center gap-6' : 'space-y-3'}`}>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <BookOpen className="h-4 w-4" />
                        {group.totalCards} cards
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Mastery:</span>
                        <span className={`font-semibold ${getMasteryColor(group.averageMastery)}`}>
                          {group.averageMastery}/5
                        </span>
                        <div className="flex">
                          {getMasteryStars(Math.round(group.averageMastery))}
                        </div>
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

            {/* Plan Details Display */}
            {selectedPlanData && (
              <div className="glass rounded-xl p-4 border border-gray-700/50 bg-blue-500/10">
                <h5 className="font-semibold text-blue-400 mb-2">Selected Plan Details</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Subject:</span>
                    <span className="text-white ml-2">{selectedPlanData.subject}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Class:</span>
                    <span className="text-white ml-2">{selectedPlanData.class}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Chapters:</span>
                    <span className="text-white ml-2">{selectedPlanData.chapters}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Topic Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Topic/Chapter
              </label>
              {availableTopics.length > 0 ? (
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Choose a topic...</option>
                  {availableTopics.map((topic, index) => (
                    <option key={index} value={topic}>{topic}</option>
                  ))}
                  <option value="all_chapters">All Chapters (Mixed)</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  placeholder="Enter a topic (e.g., Photosynthesis, Calculus)"
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>

            {/* PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload PDF (optional)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
              />
              {pdfFile && (
                <p className="text-sm text-gray-400 mt-1">Selected: {pdfFile.name}</p>
              )}
            </div>

            {/* No Plans Available Message */}
            {availablePlans.length === 0 && (
              <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10">
                <p className="text-yellow-400 text-sm">
                  No study plans found. Please create a study plan first to generate contextual flashcards.
                </p>
              </div>
            )}

            <button
              onClick={generateFlashcards}
              disabled={isGenerating || (!selectedPlan && !planId && !selectedTopic && !pdfFile)}
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
      ) : flashcards.length === 0 ? (
        /* No Flashcards */
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
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Mastery:</span>
              {getMasteryStars(flashcards[currentCard]?.mastery_level || 0)}
            </div>
          </div>

          {/* Flashcard */}
          <div className="relative h-80">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -180, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="glass rounded-2xl p-8 border border-gray-700/50 h-full cursor-pointer card-hover"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className={`h-full flex flex-col justify-center ${isFlipped ? 'hidden' : 'block'}`}>
                    {/* Front - Question */}
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(flashcards[currentCard]?.difficulty_level)}`}>
                          {flashcards[currentCard]?.difficulty_level}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {flashcards[currentCard]?.topic}
                        </span>
                      </div>
                      <h4 className="text-2xl font-bold text-white mb-6">
                        {flashcards[currentCard]?.question}
                      </h4>
                      <p className="text-gray-400">Click to reveal answer</p>
                    </div>
                  </div>

                  <div className={`h-full flex flex-col justify-center ${isFlipped ? 'block' : 'hidden'}`}>
                    {/* Back - Answer */}
                    <div className="text-center space-y-4">
                      <h4 className="text-xl font-semibold text-blue-400 mb-4">Answer:</h4>
                      <p className="text-lg text-white leading-relaxed">
                        {flashcards[currentCard]?.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={previousCard}
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-colors duration-200"
            >
              <RotateCcw className="h-5 w-5" />
            </button>

            {isFlipped && (
              <div className="flex gap-4">
                <button
                  onClick={() => handleCardResponse(false)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition-colors duration-200 flex items-center gap-2"
                >
                  <X className="h-5 w-5" />
                  Incorrect
                </button>
                <button
                  onClick={() => handleCardResponse(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl transition-colors duration-200 flex items-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Correct
                </button>
              </div>
            )}

            <button
              onClick={nextCard}
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-colors duration-200"
            >
              <RotateCcw className="h-5 w-5 rotate-180" />
            </button>
          </div>

          {/* Back to Topics */}
          <div className="text-center">
            <button
              onClick={() => setStudyMode('topics')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Back to Topics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}