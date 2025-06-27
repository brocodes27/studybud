import React, { useState, useEffect } from 'react';
import { Brain, Plus, RotateCcw, Check, X, Star, Zap, BookOpen, Filter, Grid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

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
  const { user, session } = useAuth();
  const { showToast } = useToast();
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (user) {
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
    if (!activePlanId && !notes.trim()) {
      showToast('Please select a study plan or enter notes to generate flashcards.', 'error');
      return;
    }
    const selectedPlanData = availablePlans.find(plan => plan.id === activePlanId);
    setIsGenerating(true);
    try {
      if (!session?.access_token) {
        throw new Error('User not authenticated. Please sign in again.');
      }
      const payload = {
        notes: notes.trim(),
        subject: selectedPlanData?.subject ?? '',
        class: selectedPlanData?.class ?? '',
        chapters: selectedPlanData?.chapters ?? '',
        plan_id: activePlanId ?? null,
        count: 65,
      };
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: payload,
      });
      if (error) throw error;
      const newFlashcards = data as Flashcard[];
      if (!Array.isArray(newFlashcards)) {
        throw new Error('Invalid response format: expected array of flashcards');
      }
      setFlashcards(prev => [...newFlashcards, ...prev]);
      showToast(`Generated ${newFlashcards.length} flashcards!`, 'success');
      setStudyMode('topics');
    } catch (error) {
      console.error('Error generating flashcards:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate flashcards';
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
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

  const getNextReviewDate = (masteryLevel: number) => {
    // Days for each mastery level
    const days = [1, 2, 4, 7, 15, 30];
    const idx = Math.max(0, Math.min(masteryLevel, days.length - 1));
    const now = new Date();
    now.setDate(now.getDate() + days[idx]);
    return now.toISOString();
  };

  const handleCardResponse = async (correct: boolean) => {
    const card = flashcards[currentCard];
    if (!card) return;

    try {
      let newMasteryLevel = card.mastery_level;
      if (correct) {
        newMasteryLevel = Math.min(card.mastery_level + 1, 5);
      } else {
        newMasteryLevel = Math.max(card.mastery_level - 1, 0);
      }

      const nextReviewAt = getNextReviewDate(newMasteryLevel);

      const { error } = await supabase
        .from('flashcards')
        .update({
          mastery_level: newMasteryLevel,
          review_count: card.review_count + 1,
          correct_count: correct ? card.correct_count + 1 : card.correct_count,
          last_reviewed_at: new Date().toISOString(),
          next_review_at: nextReviewAt,
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
              correct_count: correct ? fc.correct_count + 1 : fc.correct_count,
              next_review_at: nextReviewAt,
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

  // PDF or image upload and OCR logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError(null);
    setPdfLoading(true);
    setOcrProgress(null);
    try {
      const file = e.target.files?.[0];
      if (!file) throw new Error('No file selected');
      if (file.type === 'application/pdf') {
        // PDF logic
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(' ');
          text += pageText + '\n';
        }
        // If text is too short, try OCR
        if (text.replace(/\s/g, '').length < 30) {
          let ocrText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            setOcrProgress(Math.round((i - 1) / pdf.numPages * 100));
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            // @ts-ignore
            await page.render({ canvasContext: context, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            const { data: { text: ocrPageText } } = await Tesseract.recognize(dataUrl, 'eng', {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round(((i - 1) + m.progress) / pdf.numPages * 100));
                }
              }
            });
            ocrText += ocrPageText + '\n';
          }
          setOcrProgress(100);
          setNotes(ocrText.trim());
        } else {
          setNotes(text.trim());
        }
      } else if (file.type.startsWith('image/')) {
        // Image logic
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const { data: { text: ocrText } } = await Tesseract.recognize(dataUrl, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                setOcrProgress(Math.round(m.progress * 100));
              }
            }
          });
          setNotes(ocrText.trim());
        };
        reader.readAsDataURL(file);
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or image.');
      }
    } catch (err: any) {
      setPdfError('Failed to extract text from file. Please try another file.');
    } finally {
      setPdfLoading(false);
      setOcrProgress(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));
  const availableTopics = selectedPlanData ? selectedPlanData.chapters.split(',').map(c => c.trim()) : topics;

  const today = new Date();
  const dueToday = flashcards.filter(card => new Date(card.next_review_at) <= today).length;
  const mastered = flashcards.filter(card => card.mastery_level >= 5).length;

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
                    {/* List flashcards for this topic with delete button */}
                    <div className="mt-4 space-y-2">
                      {group.flashcards.map(card => (
                        <div key={card.id} className="flex items-center justify-between bg-gray-800 rounded p-2 border border-gray-700">
                          <div className="text-white text-sm flex-1">
                            Q: {card.question}
                          </div>
                          <button
                            className="ml-4 text-red-400 hover:text-red-600 text-xs font-semibold"
                            onClick={() => handleDeleteFlashcard(card.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
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
            {/* PDF/Image Upload for OCR */}
            <div className="flex items-center gap-3 mb-2">
              <label className="text-gray-300 font-medium">Upload PDF or Image:</label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileUpload}
                className="text-white"
                disabled={pdfLoading}
              />
              {pdfLoading && <span className="text-blue-400 ml-2">Extracting text...</span>}
              {ocrProgress !== null && pdfLoading && (
                <span className="text-yellow-400 ml-2">OCR Progress: {ocrProgress}%</span>
              )}
            </div>
            {pdfError && <div className="text-red-400 mb-2">{pdfError}</div>}
            {/* Notes textarea for review/editing */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Review/Edit Extracted Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Paste or review extracted notes here..."
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none h-32"
              />
            </div>
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
            <button
              onClick={generateFlashcards}
              disabled={isGenerating || (!selectedPlan && !planId && !notes)}
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

          {/* Progress Stats Bar */}
          <div className="flex gap-4 mb-4">
            <div className="bg-blue-700 text-white px-4 py-2 rounded-lg">
              Due Today: {dueToday}
            </div>
            <div className="bg-green-700 text-white px-4 py-2 rounded-lg">
              Mastered: {mastered}
            </div>
            <div className="bg-gray-700 text-white px-4 py-2 rounded-lg">
              Total: {flashcards.length}
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
                {/* Delete button for current card */}
                <button
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600 text-xs font-semibold bg-gray-900 bg-opacity-80 px-3 py-1 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFlashcard(flashcards[currentCard]?.id);
                  }}
                >
                  Delete
                </button>
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