import { useState, useEffect } from 'react';
import { Brain, RotateCcw, BookOpen, Grid, List, X, Activity, BrainCircuit, ArrowRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { usePayment } from '../hooks/usePayment';
import AIService from '../lib/aiService';

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

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export function FlashcardGenerator({ planId, topics = [] }: { planId?: string, topics?: string[] }) {
  const { user, session, isPremium } = useAuth() as any;
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
  const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);

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
      if (!planId && data && data.length > 0) setSelectedPlan(data[0].id);
      else if (planId) setSelectedPlan(planId);
    } catch (error) { console.error(error); }
  };

  const fetchFlashcards = async () => {
    try {
      let query = supabase.from('flashcards').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
      if (planId) query = query.eq('plan_id', planId);
      const { data, error } = await query;
      if (error) throw error;
      const newFlashcards = Array.isArray(data) ? data : (data as any).flashcards;
      setAllFlashcards(newFlashcards);
      setFlashcards(newFlashcards);
    } catch (error) { showToast('Failed to load flashcards', 'error'); } finally { setLoading(false); }
  };

  const organizeFlashcardsByTopic = () => {
    const topicMap = new Map<string, Flashcard[]>();
    flashcards.forEach(card => {
      const topic = card.topic || 'Uncategorized';
      if (!topicMap.has(topic)) topicMap.set(topic, []);
      topicMap.get(topic)!.push(card);
    });
    const groups = Array.from(topicMap.entries()).map(([topic, cards]) => ({
      topic,
      flashcards: cards,
      totalCards: cards.length
    })).sort((a, b) => a.topic.localeCompare(b.topic));
    setTopicGroups(groups);
  };

  const generateFlashcards = async () => {
    const activePlanId = selectedPlan || planId;
    if (!activePlanId || !selectedTopic.trim()) {
      showToast('Please select a study plan and topic first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const neuralContext = await AIService.getInstance().findRelevantKnowledge(selectedTopic);

      const payload = {
        subject: availablePlans.find(p => p.id === activePlanId)?.subject ?? '',
        class: availablePlans.find(p => p.id === activePlanId)?.class ?? '',
        chapters: availablePlans.find(p => p.id === activePlanId)?.chapters ?? '',
        plan_id: activePlanId,
        count: 15,
        topic: selectedTopic,
        neural_context: neuralContext
      };

      const { data, error } = await supabase.functions.invoke('generate-flashcards', { body: payload });
      if (error) throw error;

      await fetchFlashcards();
      showToast('Flashcards generated!', 'success');
      setStudyMode('topics');
    } catch (error) { showToast('Generation failed', 'error'); } finally { setIsGenerating(false); }
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

  const handleDeleteTopic = async (topic: string) => {
    if (!window.confirm(`Delete all flashcards for "${topic}"?`)) return;
    try {
      const { error } = await supabase.from('flashcards').delete().eq('topic', topic).eq('user_id', user?.id);
      if (error) throw error;
      setFlashcards(prev => prev.filter(card => card.topic !== topic));
      showToast(`Deleted: ${topic}`, 'info');
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-10 h-10 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
    </div>
  );

  if (isPremium === false) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-8">
        <div className="neo-card text-center max-w-md w-full p-12">
          <div className="w-20 h-20 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[20px] flex items-center justify-center mx-auto mb-6">
            <BrainCircuit className="h-10 w-10 text-[#F472B6]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#0A192F] mb-3 tracking-tight">Premium Feature</h2>
          <p className="text-[#64748B] font-medium mb-8 leading-relaxed">
            Flashcards are available for Premium subscribers. Upgrade to unlock AI-powered spaced repetition.
          </p>
          <button onClick={() => initiatePayment()} className="neo-button w-full py-3 text-base">
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));
  const availableTopics = selectedPlanData ? selectedPlanData.chapters.split(',').map(c => c.trim()) : topics;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[16px] flex items-center justify-center">
            <BrainCircuit className="h-6 w-6 text-[#F472B6]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#0A192F] tracking-tight">Flashcards</h2>
            <p className="text-xs font-medium text-[#64748B]">Spaced repetition learning</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['topics', 'generate', 'review'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                if (mode === 'review') { setFlashcards(allFlashcards); setStudyMode('review'); }
                else setStudyMode(mode);
              }}
              className={`px-4 py-2 rounded-[10px] border-2 font-bold text-xs transition-all ${studyMode === mode ? 'bg-[#F472B6] border-[#F472B6] text-white' : 'bg-white border-[#0A192F]/10 text-[#64748B] hover:border-[#F472B6]/30'}`}
            >
              {mode === 'topics' ? 'My Cards' : mode === 'generate' ? 'Generate' : 'Review All'}
            </button>
          ))}
        </div>
      </div>

      {/* Topics View */}
      {studyMode === 'topics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">Your Topics</h3>
            <div className="flex border-2 border-[#0A192F]/10 rounded-[10px] overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#0A192F]/5 text-[#0A192F]' : 'bg-white text-[#64748B]'}`}><Grid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#0A192F]/5 text-[#0A192F]' : 'bg-white text-[#64748B]'}`}><List className="h-4 w-4" /></button>
            </div>
          </div>

          {topicGroups.length === 0 ? (
            <div className="neo-card text-center py-16">
              <Activity className="h-16 w-16 mx-auto mb-4 text-[#0A192F]/10" />
              <h3 className="text-lg font-extrabold text-[#0A192F] mb-2">No flashcards yet</h3>
              <p className="text-[#64748B] font-medium mb-6">Generate your first set of flashcards to get started</p>
              <button onClick={() => setStudyMode('generate')} className="neo-button">Generate Flashcards</button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
              {topicGroups.map((group, idx) => (
                <div key={idx} className="neo-card hover:-translate-y-1 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[12px] flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-[#F472B6]" />
                    </div>
                    <button onClick={() => handleDeleteTopic(group.topic)} className="p-2 rounded-[8px] text-[#64748B] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <h3 className="text-base font-extrabold text-[#0A192F] mb-1 tracking-tight">{group.topic}</h3>
                  <p className="text-xs font-medium text-[#64748B] mb-4">{group.totalCards} cards</p>
                  <button onClick={() => startTopicReview(group.topic)} className="w-full py-2.5 rounded-[10px] bg-[#F472B6]/10 border-2 border-[#F472B6]/20 text-[#F472B6] font-bold text-sm hover:bg-[#F472B6]/20 transition-colors">
                    Study Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate View */}
      {studyMode === 'generate' && (
        <div className="max-w-2xl mx-auto">
          <div className="neo-card space-y-6">
            <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">Generate New Flashcards</h3>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Study Plan</label>
              <select
                value={selectedPlan}
                onChange={e => setSelectedPlan(e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] focus:outline-none focus:border-[#F472B6]/40 bg-white"
              >
                <option value="">Select a plan...</option>
                {availablePlans.map(p => <option key={p.id} value={p.id}>{p.subject} (Class {p.class})</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Topic</label>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full px-4 py-3 rounded-[12px] border-2 border-[#0A192F]/10 font-medium text-[#0A192F] focus:outline-none focus:border-[#F472B6]/40 bg-white"
              >
                <option value="">Select a topic...</option>
                {availableTopics.map((t, i) => <option key={i} value={t}>{t}</option>)}
              </select>
            </div>

            <button
              onClick={generateFlashcards}
              disabled={isGenerating || !selectedTopic}
              className="neo-button w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate 15 Flashcards</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Review View */}
      {studyMode === 'review' && flashcards.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-[#0A192F] tracking-tight">
                {activeTopicFilter === 'all' ? 'All Cards' : activeTopicFilter}
              </h3>
              <p className="text-sm font-medium text-[#64748B]">{currentCard + 1} of {flashcards.length}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCurrentCard(c => Math.max(0, c - 1)); setIsFlipped(false); }}
                disabled={currentCard === 0}
                className="w-10 h-10 rounded-[10px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => { setCurrentCard(c => Math.min(flashcards.length - 1, c + 1)); setIsFlipped(false); }}
                disabled={currentCard === flashcards.length - 1}
                className="w-10 h-10 rounded-[10px] border-2 border-[#0A192F]/10 flex items-center justify-center text-[#64748B] hover:border-[#0A192F]/20 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-[#0A192F]/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F472B6] rounded-full transition-all"
              style={{ width: `${((currentCard + 1) / flashcards.length) * 100}%` }}
            />
          </div>

          {/* Card */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className={`min-h-[280px] rounded-[24px] border-2 p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isFlipped ? 'bg-[#F472B6]/10 border-[#F472B6]/20' : 'bg-white border-[#0A192F]/8 hover:border-[#F472B6]/20 hover:-translate-y-1 shadow-float-pink'}`}
          >
            <div className={`text-xs font-bold uppercase tracking-widest mb-6 px-3 py-1 rounded-full ${isFlipped ? 'text-[#F472B6] bg-[#F472B6]/10' : 'text-[#64748B] bg-[#0A192F]/5'}`}>
              {isFlipped ? 'Answer' : 'Question'}
            </div>
            <h4 className="text-2xl font-bold text-[#0A192F] leading-relaxed">
              {isFlipped ? flashcards[currentCard].answer : flashcards[currentCard].question}
            </h4>
            <p className="mt-6 text-xs font-medium text-[#64748B]/60">
              Tap to {isFlipped ? 'see question' : 'reveal answer'}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { setCurrentCard(c => Math.max(0, c - 1)); setIsFlipped(false); }}
              disabled={currentCard === 0}
              className="flex-1 py-3 rounded-[12px] border-2 border-[#0A192F]/10 text-[#64748B] font-bold text-sm hover:border-[#0A192F]/20 disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => { setCurrentCard(c => Math.min(flashcards.length - 1, c + 1)); setIsFlipped(false); }}
              disabled={currentCard === flashcards.length - 1}
              className="flex-1 neo-button py-3 flex items-center justify-center gap-2"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
