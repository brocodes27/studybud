import { useState, useEffect } from 'react';
import { Brain, RotateCcw, BookOpen, Grid, List, Zap, Terminal, Database, ShieldCheck, X, Activity, Award, BrainCircuit, ArrowRight } from 'lucide-react';
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
    } catch (error) { showToast('Failed to load neural nodes', 'error'); } finally { setLoading(false); }
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
      showToast('Define TARGET_AREA and SOURCE_PLAN first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      // PROACTIVE UPGRADE: Check neural memory for previous struggles to prioritize those cards
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
      showToast("Neural Archive Updated.", "success");
      setStudyMode('topics');
    } catch (error) { showToast('Generation sequence failed', 'error'); } finally { setIsGenerating(false); }
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
    if (!window.confirm(`PURGE ALL DATA NODES FOR "${topic}"?`)) return;
    try {
      const { error } = await supabase.from('flashcards').delete().eq('topic', topic).eq('user_id', user?.id);
      if (error) throw error;
      setFlashcards(prev => prev.filter(card => card.topic !== topic));
      showToast(`Archive purged: ${topic}`, 'info');
    } catch (err) { showToast('Purge failed', 'error'); }
  };

  if (loading) return <div className="flex items-center justify-center p-20 animate-pulse text-neo-accent font-black uppercase tracking-[0.4em]">INIT_NEURAL_RECALL...</div>;

  if (isPremium === false) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-8">
        <div className="bg-slate-800 border border-white/10 p-12 shadow-neo text-center max-w-md w-full">
          <div className="w-24 h-24 bg-neo-accent border border-white/10 flex items-center justify-center shadow-neo mx-auto mb-8 -rotate-6 animate-bounce">
            <ShieldCheck className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-5xl font-black mb-6 uppercase tracking-tighter italic">ACCESS_LOCKED</h2>
          <p className="mb-10 text-slate-100 font-bold uppercase tracking-widest text-xs leading-loose">
            NEURAL RECALL ARCHIVE IS RESERVED FOR <span className="bg-neo-secondary px-2 border border-white/10 inline-block">PREMIUM_NODES</span>. INITIALIZE SUBSCRIPTION (₹199).
          </p>
          <button onClick={() => initiatePayment()} className="w-full bg-slate-900 text-white px-8 py-6 border border-white/10 font-black uppercase text-2xl hover:bg-neo-accent hover:text-slate-100 transition-all shadow-neo">
            UPGRADE_CORE_LEVEL
          </button>
        </div>
      </div>
    );
  }

  const selectedPlanData = availablePlans.find(plan => plan.id === (selectedPlan || planId));
  const availableTopics = selectedPlanData ? selectedPlanData.chapters.split(',').map(c => c.trim()) : topics;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 overflow-hidden p-6 space-y-6">

      {/* SYSTEM HUD */}
      <div className="bg-slate-900 text-white p-6 border-b-8 border-neo-accent shadow-neo flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-neo-accent p-3 border border-white -rotate-6 shadow-neo">
            <BrainCircuit className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">NEURAL_RECALL</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 w-1.5 bg-[#2D9E64] rounded-full animate-pulse" />
              <span className="text-[8px] font-black tracking-widest text-white/40 uppercase">SPACED_REPETITION_ENGINE_v4.0</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => setStudyMode('topics')} className={`px-6 py-2 border border-white font-black uppercase text-xs transition-all ${studyMode === 'topics' ? 'bg-neo-secondary text-slate-100 shadow-neo' : 'bg-transparent hover:bg-slate-800/10'}`}>
            TOPIC_NODES
          </button>
          <button onClick={() => setStudyMode('generate')} className={`px-6 py-2 border border-white font-black uppercase text-xs transition-all ${studyMode === 'generate' ? 'bg-neo-accent text-white shadow-neo' : 'bg-transparent hover:bg-slate-800/10'}`}>
            SYNC_NEW_DATA
          </button>
          <button onClick={() => { setFlashcards(allFlashcards); setStudyMode('review'); }} className={`px-6 py-2 border border-white font-black uppercase text-xs transition-all ${studyMode === 'review' ? 'bg-slate-800 text-slate-100 shadow-neo' : 'bg-transparent hover:bg-slate-800/10'}`}>
            FULL_SYNC
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {studyMode === 'topics' ? (
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-black uppercase tracking-tighter italic border-l-8 border-white/10 pl-6">Neural Archive</h2>
              <div className="flex border border-white/10 overflow-hidden shadow-neo">
                <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-slate-800'}`}><Grid className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-800'}`}><List className="h-4 w-4" /></button>
              </div>
            </div>

            {topicGroups.length === 0 ? (
              <div className="bg-slate-800 border border-white/10 p-24 text-center shadow-neo">
                <Activity className="h-24 w-24 mx-auto mb-8 text-slate-100/10 animate-spin-slow" />
                <h3 className="text-4xl font-black uppercase italic mb-4 tracking-tighter text-slate-100/40">MEMORY_CELLS_NULL</h3>
                <button onClick={() => setStudyMode('generate')} className="bg-neo-accent px-12 py-5 border border-white/10 font-black uppercase text-xl shadow-neo hover:-translate-y-1 active:shadow-none transition-all">INITIALIZE_GENESIS</button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8' : 'space-y-4'}>
                {topicGroups.map((group, idx) => (
                  <div key={idx} className={`bg-slate-800 border border-white/10 p-8 shadow-neo hover:-translate-y-2 transition-all relative overflow-hidden group ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1 hover:rotate-0'}`}>
                    <div className="absolute top-0 right-0 bg-slate-900 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">v4.0_STABLE</div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter italic mb-8">{group.topic}</h3>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-100/40 uppercase">DATA_NODES</span>
                        <span className="text-2xl font-black">{group.totalCards}</span>
                      </div>
                      <div className="h-12 w-12 bg-neo-secondary border border-white/10 flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                        <BookOpen className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => startTopicReview(group.topic)} className="flex-1 bg-slate-900 text-white font-black uppercase py-4 border border-white/10 shadow-neo hover:bg-[#2D9E64] hover:text-slate-100 transition-all italic text-sm">ACTIVATE_SYNC</button>
                      <button onClick={() => handleDeleteTopic(group.topic)} className="bg-slate-800 border border-white/10 p-4 hover:bg-red-500 hover:text-white transition-all"><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : studyMode === 'generate' ? (
          <div className="max-w-4xl mx-auto py-12">
            <div className="bg-slate-800 border border-white/10 p-12 shadow-neo -rotate-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 bg-neo-secondary h-2 w-full" />
              <h2 className="text-5xl font-black uppercase tracking-tighter italic mb-12 border-b-8 border-white/10 pb-4">GENERATION_SYNAPSE</h2>
              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-100/40">01_IDENTIFY_SOURCE_PLAN</label>
                  <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} className="w-full p-6 border border-white/10 font-black uppercase text-xl focus:bg-slate-900 outline-none shadow-neo bg-slate-800">
                    <option value="">SELECT_PLAN_ID</option>
                    {availablePlans.map(p => <option key={p.id} value={p.id}>{p.subject} (CLASS_{p.class})</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-100/40">02_TARGET_KNOWLEDGE_CELL</label>
                  <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} className="w-full p-6 border border-white/10 font-black uppercase text-xl focus:bg-slate-900 outline-none shadow-neo bg-slate-800">
                    <option value="">DEFINE_TARGET</option>
                    {availableTopics.map((t, i) => <option key={i} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
                <button onClick={generateFlashcards} disabled={isGenerating || !selectedTopic} className="w-full group flex items-center justify-between bg-slate-900 text-white px-10 py-10 border border-white/10 font-black text-4xl uppercase tracking-tighter hover:bg-[#2D9E64] hover:text-slate-100 transition-all shadow-neo disabled:opacity-20">
                  {isGenerating ? 'NEURAL_CONSTRUCTION_IN_PROGRESS...' : 'INITIATE_SYNC'}
                  <ArrowRight className="h-12 w-12 group-hover:translate-x-4 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        ) : studyMode === 'review' && flashcards.length > 0 && (
          <div className="max-w-5xl mx-auto py-12 space-y-12">
            <div className="flex items-center justify-between border-b-8 border-white/10 pb-8">
              <div>
                <h2 className="text-6xl font-black uppercase tracking-tighter italic leading-none">{activeTopicFilter === 'all' ? 'NEURAL_OVERRIDE' : activeTopicFilter}</h2>
                <p className="text-xl font-black uppercase italic text-neo-accent mt-4">Node_Position: {currentCard + 1} // {flashcards.length}</p>
              </div>
              <div className="flex gap-6">
                <div className="bg-slate-900 text-white p-6 border border-white/10 shadow-neo">
                  <span className="block text-[8px] font-black uppercase tracking-widest text-white/40 mb-2">MASTERY_LVL</span>
                  <span className="text-3xl font-black italic">{Math.round((currentCard / flashcards.length) * 100)}%</span>
                </div>
              </div>
            </div>

            <div onClick={() => setIsFlipped(!isFlipped)} className={`w-full min-h-[500px] border border-white/10 p-20 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 relative ${isFlipped ? 'bg-neo-secondary shadow-none translate-x-3 translate-y-3' : 'bg-slate-800 shadow-neo hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-neo'}`}>
              <div className="absolute top-0 left-0 bg-slate-900 text-white px-6 py-2 font-black uppercase text-xs tracking-[0.3em] -rotate-1">
                {isFlipped ? 'RESPONSE_DATA_FOUND' : 'NEURAL_QUERY_EMITTED'}
              </div>
              <h4 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight">
                {isFlipped ? flashcards[currentCard].answer : flashcards[currentCard].question}
              </h4>
              <p className="mt-16 text-[10px] font-black uppercase tracking-[0.5em] text-slate-100/20 animate-pulse">
                CLICK_TO_{isFlipped ? 'COLLAPSE' : 'EXPAND'}
              </p>
              <div className="absolute bottom-6 right-6 text-[8rem] font-black italic text-slate-100/5 select-none pointer-events-none -rotate-12 uppercase">
                {isFlipped ? 'Recall' : 'Query'}
              </div>
            </div>

            <div className="flex gap-10">
              <button onClick={() => { setCurrentCard(c => Math.max(0, c - 1)); setIsFlipped(false); }} disabled={currentCard === 0} className="flex-1 bg-slate-800 border border-white/10 py-10 font-black text-4xl uppercase tracking-tighter shadow-neo hover:bg-slate-900/50 disabled:opacity-20 active:shadow-none transition-all">PREV_NODE</button>
              <button onClick={() => { setCurrentCard(c => Math.min(flashcards.length - 1, c + 1)); setIsFlipped(false); }} disabled={currentCard === flashcards.length - 1} className="flex-1 bg-slate-900 text-white border border-white/10 py-10 font-black text-4xl uppercase tracking-tighter shadow-neo hover:bg-neo-accent active:shadow-none transition-all">NEXT_NODE</button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER STATS */}
      <footer className="h-10 bg-slate-900 text-white flex items-center px-10 gap-12 border-t-4 border-neo-accent">
        <div className="flex items-center gap-2"><Database className="h-3 w-3 text-neo-secondary" /><span className="text-[8px] font-black uppercase tracking-widest">Archival_State: SYNCHRONIZED</span></div>
        <div className="flex items-center gap-2"><Terminal className="h-3 w-3 text-neo-accent" /><span className="text-[8px] font-black uppercase tracking-widest">Protocol: Spaced_Repetition_v4.0</span></div>
        <div className="ml-auto flex items-center gap-4"><Award className="h-3 w-3 text-yellow-400" /><span className="text-[8px] font-black uppercase tracking-widest">Nodes_Mastered: {allFlashcards.length}</span></div>
      </footer>
    </div>
  );
}
