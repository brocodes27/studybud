import { useState, useEffect } from 'react';
import { Brain, RotateCcw, BookOpen, Grid, List, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
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


pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

export function FlashcardGenerator({ planId, topics = [] }: FlashcardGeneratorProps) {
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
      const _flashcardsWithTopic = newFlashcards.map(card => ({
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

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'hard': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const _handleDeleteFlashcard = async (id: string) => {
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
  /* eslint-enable @typescript-eslint/no-unused-vars */

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));
  const availableTopics = selectedPlanData ? selectedPlanData.chapters.split(',').map(c => c.trim()) : topics;

  // Show paywall if not subscribed
  if (isPremium === false) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <div className="bg-white border-8 border-black p-12 shadow-[20px_20px_0px_0px_#000] text-center max-w-md w-full -rotate-1">
          <div className="w-20 h-20 bg-neo-accent border-4 border-black flex items-center justify-center shadow-[6px_6px_0px_0px_#000] mx-auto mb-8 -rotate-12">
            <Zap className="h-10 w-10 text-white stroke-[4px]" />
          </div>
          <h2 className="text-4xl font-black mb-4 text-black uppercase tracking-tighter italic">GATEWAY LOCKED</h2>
          <p className="mb-8 text-black font-bold uppercase tracking-widest text-sm leading-relaxed">
            SUBSCRIBE FOR <span className="bg-neo-secondary px-2 border-2 border-black inline-block rotate-2">₹199</span> TO ACCESS THE FULL NEURAL RECALL ARCHIVE.
          </p>
          <button
            onClick={() => initiatePayment()}
            className="w-full bg-black text-white px-8 py-5 border-4 border-black font-black uppercase italic tracking-tighter text-2xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
          >
            INITIALIZE ACCESS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-12 relative bg-neo-bg/10 min-h-full">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="flex items-center gap-6">
          <div className="bg-neo-accent border-4 border-black p-4 shadow-[6px_6px_0px_0px_#000] -rotate-6">
            <Brain className="h-10 w-10 text-white stroke-[3px]" />
          </div>
          <div>
            <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic leading-none">NEURAL RECALL</h3>
            <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] mt-2 italic">PROTOCOL: SPACED_REPETITION_GENESIS</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            { id: 'topics', label: `TOPICS (${topicGroups.length})`, color: 'bg-neo-secondary' },
            { id: 'generate', label: 'GENERATE', color: 'bg-neo-accent', text: 'text-white' },
            { id: 'review', label: `REVIEW ALL (${allFlashcards.length})`, color: 'bg-neo-muted' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                if (mode.id === 'review') setFlashcards(allFlashcards);
                setStudyMode(mode.id as any);
              }}
              className={`
                px-8 py-4 border-4 border-black font-black uppercase tracking-tighter italic text-lg transition-all
                ${studyMode === mode.id
                  ? `${mode.color} ${mode.text || 'text-black'} shadow-[6px_6px_0px_0px_#000] -translate-y-1`
                  : 'bg-white text-black hover:bg-neo-bg hover:shadow-[2px_2px_0px_0px_#000]'
                }
              `}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {studyMode === 'topics' ? (
        <div className="space-y-10">
          <div className="flex items-center justify-between border-b-4 border-black pb-6">
            <h4 className="text-2xl font-black text-black uppercase tracking-tighter italic">ARCHIVE SUB-SECTIONS</h4>
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 border-4 border-black transition-all ${viewMode === 'grid' ? 'bg-black text-white' : 'bg-white'}`}
              >
                <Grid className="h-6 w-6 stroke-[3px]" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 border-4 border-black transition-all ${viewMode === 'list' ? 'bg-black text-white' : 'bg-white'}`}
              >
                <List className="h-6 w-6 stroke-[3px]" />
              </button>
            </div>
          </div>

          {topicGroups.length === 0 ? (
            <div className="bg-white border-8 border-black p-20 text-center shadow-[16px_16px_0px_0px_#000] rotate-1">
              <div className="bg-neo-muted border-4 border-black p-8 inline-block mb-10 -rotate-12">
                <BookOpen className="h-20 w-20 text-black stroke-[3px]" />
              </div>
              <h4 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">ARCHIVE EMPTY</h4>
              <p className="text-black font-bold uppercase tracking-widest text-sm mb-12">NO NEURAL DATA DETECTED. INITIALIZE GENERATION SEQUENCE.</p>
              <button
                onClick={() => setStudyMode('generate')}
                className="bg-neo-accent text-white px-10 py-5 border-4 border-black font-black uppercase italic tracking-tighter text-2xl hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000]"
              >
                START GENERATION
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10' : 'space-y-6'}>
              {topicGroups.map((group, index) => (
                <div
                  key={index}
                  className={`
                    bg-white border-4 border-black p-8 shadow-[10px_10px_0px_0px_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_#000]
                    ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'}
                    ${viewMode === 'list' ? 'flex items-center justify-between gap-10' : ''}
                  `}
                >
                  <div className={viewMode === 'list' ? 'flex-grow' : ''}>
                    <div className="flex items-center justify-between mb-6">
                      <h5 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">{group.topic}</h5>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-black/40">
                      <div className="bg-neo-secondary p-1 border-2 border-black">
                        <BookOpen className="h-4 w-4 text-black stroke-[3px]" />
                      </div>
                      {group.totalCards} NEURAL_NODES
                    </div>
                  </div>
                  <div className={`flex flex-col gap-4 ${viewMode === 'list' ? 'md:flex-row' : 'mt-8'}`}>
                    <button
                      onClick={() => startTopicReview(group.topic)}
                      className="flex-1 bg-black text-white font-black uppercase italic py-4 px-8 border-4 border-black shadow-[4px_4px_0px_0px_#FF6B6B] hover:bg-neo-accent active:shadow-none transition-all text-center"
                    >
                      STUDY_NODE
                    </button>
                    <button
                      className="bg-white text-neo-accent border-4 border-neo-accent hover:bg-neo-accent hover:text-white font-black uppercase text-[10px] tracking-widest py-2 px-4 transition-all"
                      onClick={() => handleDeleteTopic(group.topic)}
                    >
                      PURGE_TOPIC
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : studyMode === 'generate' ? (
        <div className="bg-white border-8 border-black p-12 shadow-[16px_16px_0px_0px_#000] rotate-1 max-w-4xl mx-auto">
          <h4 className="text-3xl font-black text-black uppercase tracking-tighter italic mb-10 border-b-4 border-black pb-4">GENERATION_CONFIG</h4>
          <div className="space-y-10">
            {!planId && availablePlans.length > 0 && (
              <div className="space-y-4">
                <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] italic">SOURCE_PLAN</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full bg-white border-4 border-black px-6 py-4 font-black text-xl italic focus:bg-neo-secondary outline-none transition-all shadow-[6px_6px_0px_0px_#000]"
                >
                  <option value="">SELECT SOURCE...</option>
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.subject.toUpperCase()} - CLASS_{plan.class}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] italic">TARGET_AREA <span className="text-neo-accent">*</span></label>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                className="w-full bg-white border-4 border-black px-6 py-4 font-black text-xl italic focus:bg-neo-secondary outline-none transition-all shadow-[6px_6px_0px_0px_#000]"
                required
              >
                <option value="">DEFINE TARGET...</option>
                {availableTopics.map((topic, idx) => (
                  <option key={idx} value={topic}>{topic.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <button
              onClick={generateFlashcards}
              disabled={isGenerating || (!selectedPlan && !planId) || !selectedTopic}
              className="w-full bg-black text-white py-6 border-4 border-black font-black uppercase italic tracking-tighter text-3xl hover:bg-neo-accent hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all shadow-[8px_8px_0px_0px_#000] disabled:opacity-50 flex items-center justify-center gap-6"
            >
              {isGenerating ? (
                <>
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  PROCESSING...
                </>
              ) : (
                <>
                  <Zap className="h-10 w-10 stroke-[4px]" />
                  CONSTRUCT_ARCHIVE
                </>
              )}
            </button>
          </div>
        </div>
      ) : studyMode === 'review' ? (
        <div className="space-y-12 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <h4 className="text-3xl font-black text-black uppercase tracking-tighter italic">
                {activeTopicFilter === 'all' ? 'FULL_ARCHIVE_SYNC' : `NODE: ${activeTopicFilter.toUpperCase()}`}
              </h4>
              <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mt-2">INDEX: {currentCard + 1} / {flashcards.length}</p>
            </div>
            <div className="bg-black text-white px-4 py-1 font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_#FF6B6B]">
              SPACED_PROTOCOLS: ACTIVE
            </div>
          </div>

          {flashcards.length === 0 ? (
            <div className="bg-white border-8 border-black p-20 text-center shadow-[16px_16px_0px_0px_#000] -rotate-1">
              <BookOpen className="h-20 w-20 text-black/10 mx-auto mb-8" />
              <h4 className="text-4xl font-black text-black uppercase tracking-tighter italic mb-4">DATA_NOT_FOUND</h4>
              <button
                onClick={() => setStudyMode('generate')}
                className="bg-neo-accent text-white px-10 py-5 border-4 border-black font-black uppercase italic tracking-tighter text-2xl shadow-[8px_8px_0px_0px_#000]"
              >
                INITIALIZE_CORE
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-12">
              <div
                className={`
                    w-full min-h-[400px] border-8 border-black p-12 text-center cursor-pointer transition-all duration-300 relative overflow-hidden
                    ${isFlipped ? 'bg-neo-secondary shadow-none translate-x-2 translate-y-2' : 'bg-white shadow-[20px_20px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[24px_24px_0px_0px_#000]'}
                `}
                onClick={() => setIsFlipped(f => !f)}
              >
                <div className="relative z-10 flex flex-col items-center justify-center min-h-[300px]">
                  <div className="absolute top-0 left-0 bg-black text-white px-4 py-1 font-black uppercase text-[10px] tracking-[0.2em] -rotate-2">
                    {isFlipped ? 'RESPONSE_DATA' : 'QUERY_NODE'}
                  </div>

                  <h5 className={`text-4xl md:text-5xl font-black tracking-tighter italic leading-tight ${isFlipped ? 'text-black' : 'text-black'}`}>
                    {isFlipped ? flashcards[currentCard].answer : flashcards[currentCard].question}
                  </h5>

                  <div className="mt-12 flex items-center justify-center gap-4">
                    <div className="w-12 h-1 bg-black/10"></div>
                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest italic">
                      {isFlipped ? 'CLICK_TO_RESET' : 'CLICK_TO_REVEAL'}
                    </p>
                    <div className="w-12 h-1 bg-black/10"></div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute bottom-4 right-4 text-black/5 font-black text-8xl pointer-events-none select-none italic -rotate-12">
                  {isFlipped ? 'EF_RE_CALL' : 'EF_QUE_RY'}
                </div>
              </div>

              <div className="flex justify-between w-full gap-8">
                <button
                  onClick={() => { setCurrentCard(c => Math.max(0, c - 1)); setIsFlipped(false); }}
                  disabled={currentCard === 0}
                  className="flex-1 bg-white border-4 border-black py-6 font-black uppercase italic italic tracking-tighter text-2xl shadow-[8px_8px_0px_0px_#000] hover:bg-neo-muted disabled:opacity-20 active:shadow-none transition-all flex items-center justify-center gap-4"
                >
                  <div className="p-2 border-2 border-black bg-black text-white">
                    <RotateCcw className="w-6 h-6 stroke-[3px] -scale-x-100" />
                  </div>
                  PREV_DATA
                </button>
                <button
                  onClick={() => { setCurrentCard(c => Math.min(flashcards.length - 1, c + 1)); setIsFlipped(false); }}
                  disabled={currentCard === flashcards.length - 1}
                  className="flex-1 bg-black text-white border-4 border-black py-6 font-black uppercase italic italic tracking-tighter text-2xl shadow-[8px_8px_0px_0px_#4D96FF] hover:bg-neo-accent active:shadow-none transition-all flex items-center justify-center gap-4"
                >
                  NEXT_DATA
                  <div className="p-2 border-2 border-white bg-white text-black">
                    <RotateCcw className="w-6 h-6 stroke-[3px]" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

}