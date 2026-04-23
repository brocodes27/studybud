import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, Sparkles, RefreshCw, AlertCircle, BookOpen, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import {
  fetchDailyBriefing,
  markTaskCompleted,
  generateDailyPrescription,
  type DailyBriefingData,
} from '../../lib/dailyBriefing';
import { supabase } from '../../lib/supabase';
import { AgentGreeting } from './AgentGreeting';
import { ClassUpdateCard } from './ClassUpdateCard';
import { TodayTaskCard } from './TodayTaskCard';
import { TaskFocusView } from './TaskFocusView';
import { CompletionCelebration } from './CompletionCelebration';
import { ExploreGrid } from './ExploreGrid';
import { CorrectionSprintBanner } from './CorrectionSprintBanner';
import { BacklogAlert } from './BacklogAlert';
import { TestUploadModal } from './TestUploadModal';
import { RoadmapOnboarding } from './RoadmapOnboarding';

type BriefingState = 'loading' | 'generating' | 'briefing' | 'task' | 'complete' | 'explore' | 'error';

interface RoadmapOption {
  id: string;
  institute_name: string;
  program: string;
  current_week: number;
  is_active: boolean;
}

export function DailyBriefing() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const [state, setState] = useState<BriefingState>('loading');
  const [data, setData] = useState<DailyBriefingData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [completionMeta, setCompletionMeta] = useState<{ xpEarned?: number; levelUp?: boolean; newLevel?: number }>({});
  const isLoadingRef = useRef(false);

  // Roadmap picker state
  const [allRoadmaps, setAllRoadmaps] = useState<RoadmapOption[]>([]);
  const [showRoadmapPicker, setShowRoadmapPicker] = useState(false);
  const [switchingRoadmap, setSwitchingRoadmap] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fetch all roadmaps for the user
  const fetchRoadmaps = useCallback(async () => {
    if (!user?.id) return;
    const { data: rows } = await supabase
      .from('student_roadmaps')
      .select('id, institute_name, program, current_week, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAllRoadmaps((rows || []) as RoadmapOption[]);
  }, [user?.id]);

  useEffect(() => { fetchRoadmaps(); }, [fetchRoadmaps]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowRoadmapPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSwitchRoadmap = async (targetId: string) => {
    if (!user?.id || switchingRoadmap) return;
    setSwitchingRoadmap(true);
    try {
      await supabase.from('student_roadmaps').update({ is_active: false }).eq('user_id', user.id);
      await supabase.from('student_roadmaps').update({ is_active: true }).eq('id', targetId);
      setAllRoadmaps(prev => prev.map(r => ({ ...r, is_active: r.id === targetId })));
      setShowRoadmapPicker(false);
      showToast('Switched roadmap — refreshing...', 'success');
      await loadBriefing();
    } catch {
      showToast('Failed to switch roadmap', 'error');
    } finally {
      setSwitchingRoadmap(false);
    }
  };

  // ------------------------------------------------------------------
  // Load briefing data — only depends on user.id, NEVER on roadmapId
  // ------------------------------------------------------------------
  const loadBriefing = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      setState('loading');
      setErrorMsg(null);
      const briefing = await fetchDailyBriefing(user.id);
      setData(briefing);
      setRoadmapId(briefing.roadmapId);

      if (briefing.isTaskCompleted) {
        setState('explore');
      } else {
        setState('briefing');
      }
    } catch (err: any) {
      console.error('DailyBriefing load error:', err);
      setErrorMsg(err?.message || 'Something went wrong loading your briefing.');
      setState('error');
    } finally {
      isLoadingRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  // ------------------------------------------------------------------
  // Auto-generate prescription when briefing loads and no task exists
  // Runs AFTER data is set, as a separate effect
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!data || !user?.id) return;
    if (data.isTaskCompleted) return;
    if (!data.activeRoadmap || !data.roadmapId) return;
    if (data.todayTask.type !== 'none') return; // task already exists (sprint, prescription, etc.)

    let cancelled = false;

    const autoGenerate = async () => {
      setState('generating');
      try {
        const generated = await generateDailyPrescription(user.id, data.roadmapId!);
        if (generated && !cancelled) {
          const refreshed = await fetchDailyBriefing(user.id);
          if (!cancelled) {
            setData(refreshed);
            setRoadmapId(refreshed.roadmapId);
            setState('briefing');
          }
        } else if (!cancelled) {
          setState('briefing');
        }
      } catch {
        if (!cancelled) setState('briefing');
      }
    };

    autoGenerate();
    return () => { cancelled = true; };
  }, [data?.activeRoadmap, data?.roadmapId, data?.todayTask?.type, data?.todayTask?.implementationIntentions, data?.isTaskCompleted, user?.id]);

  const handleStartTask = () => {
    // If no real task, open the roadmap picker instead of focus view
    if (data?.todayTask?.type === 'none') {
      setShowRoadmapPicker(true);
      return;
    }
    setState('task');
  };

  const handleTaskComplete = async () => {
    if (data && user?.id) {
      const sourceType =
        data.todayTask.type === 'prescription' ? 'prescription' :
        data.todayTask.type === 'correction_sprint' ? 'sprint' :
        data.todayTask.type === 'assignment' ? 'assignment' : 'weak_area';

      const result = await markTaskCompleted(
        user.id,
        sourceType,
        data.todayTask.prescriptionId || data.todayTask.sprintId || data.todayTask.id,
        data.todayTask.taskOrder || 0,
        data.todayTask.durationMin
      );

      if (result.success) {
        setCompletionMeta({
          xpEarned: result.xpEarned,
          levelUp: result.levelUp,
          newLevel: result.newLevel,
        });
        if (result.xpEarned) {
          showToast(`+${result.xpEarned} XP earned!`, 'success');
        }
      }

      setData((prev) =>
        prev
          ? { ...prev, isTaskCompleted: true, todayTask: { ...prev.todayTask, completed: true } }
          : prev
      );
    }
    setState('complete');
  };

  const handleExplore = () => {
    setState('explore');
  };

  const handleReschedule = () => {
    window.dispatchEvent(
      new CustomEvent('trigger-atlas-chat', {
        detail: { message: 'Ranjan Sir, I have a backlog and missed days. Can you reschedule my plan realistically?', voice: false },
      })
    );
    showToast('Opening rescheduling chat with Atlas...', 'info');
  };

  const handleTestSuccess = () => {
    loadBriefing();
    showToast('Correction sprint generated! Check your briefing.', 'success');
  };

  if (!user) return null;

  // Show onboarding when user has no roadmaps
  if (allRoadmaps.length === 0 && state !== 'loading') {
    return (
      <RoadmapOnboarding
        userId={user.id}
        onComplete={() => {
          fetchRoadmaps();
          loadBriefing();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center px-4 pt-8 md:pt-16 pb-20">
      {/* Top action bar */}
      <div className="w-full max-w-xl flex items-center justify-end gap-2 mb-4">
        {/* Roadmap Picker */}
        {allRoadmaps.length > 0 && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowRoadmapPicker(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#2D2A26]/[0.06] rounded-xl text-[11px] font-bold text-[#8A8279] hover:text-[#2D2A26] hover:border-[#2D2A26]/10 transition-colors shadow-sm"
              id="choose-roadmap-btn"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {allRoadmaps.find(r => r.is_active)?.institute_name || 'Choose Roadmap'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showRoadmapPicker ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showRoadmapPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white rounded-2xl border border-[#2D2A26]/[0.08] shadow-lg overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-[#2D2A26]/[0.06]">
                    <p className="text-[10px] font-bold text-[#B5AEA5] uppercase tracking-wider">Switch Roadmap</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {allRoadmaps.map(rm => (
                      <button
                        key={rm.id}
                        onClick={() => handleSwitchRoadmap(rm.id)}
                        disabled={switchingRoadmap}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#FAF8F5] ${
                          rm.is_active ? 'bg-[#8B7355]/[0.06]' : ''
                        } disabled:opacity-50`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          rm.is_active ? 'bg-[#8B7355] text-white' : 'border border-[#2D2A26]/10'
                        }`}>
                          {rm.is_active && <Check className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-bold truncate ${rm.is_active ? 'text-[#2D2A26]' : 'text-[#8A8279]'}`}>
                            {rm.institute_name}
                          </p>
                          <p className="text-[10px] text-[#B5AEA5] truncate">
                            {rm.program} · Week {rm.current_week}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          onClick={() => setShowTestModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#2D2A26]/[0.06] rounded-xl text-[11px] font-bold text-[#8A8279] hover:text-[#2D2A26] hover:border-[#2D2A26]/10 transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Test
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* LOADING */}
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <div className="w-12 h-12 rounded-full bg-[#8B7355] flex items-center justify-center shadow-md mb-4">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#8A8279]">Preparing your daily briefing...</p>
          </motion.div>
        )}

        {/* GENERATING PRESCRIPTION */}
        {state === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <div className="w-12 h-12 rounded-full bg-[#8B7355] flex items-center justify-center shadow-md mb-4">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-[#8A8279]">Ranjan Sir is writing your plan...</p>
            <p className="text-xs text-[#B5AEA5] mt-1">Analysing today's classes, upcoming tests, and your state</p>
          </motion.div>
        )}

        {/* ERROR STATE */}
        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[50vh] w-full max-w-xl"
          >
            <div className="w-16 h-16 rounded-full bg-[#B87B6B]/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-[#B87B6B]" />
            </div>
            <h2 className="text-xl font-bold text-[#2D2A26] mb-2">Couldn&apos;t load briefing</h2>
            <p className="text-sm text-[#8A8279] text-center mb-6 max-w-sm">
              {errorMsg || 'Something went wrong. This usually happens when new features are being rolled out.'}
            </p>
            <button
              onClick={loadBriefing}
              className="flex items-center gap-2 bg-[#2D2A26] hover:bg-[#3D3833] text-white font-bold text-sm py-3 px-6 rounded-xl shadow-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </motion.div>
        )}

        {/* BRIEFING */}
        {state === 'briefing' && data && (
          <motion.div
            key="briefing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-xl flex flex-col items-center"
          >
            {data.correctionSprint && (
              <CorrectionSprintBanner sprint={data.correctionSprint} onContinue={handleStartTask} />
            )}
            <BacklogAlert state={data.studentState} onReschedule={handleReschedule} />
            <AgentGreeting greeting={data.greeting} userName={data.userName} streak={data.streak} />
            <ClassUpdateCard update={data.classUpdate} />
            <TodayTaskCard task={data.todayTask} onStart={handleStartTask} />
          </motion.div>
        )}

        {/* TASK */}
        {state === 'task' && data && (
          <motion.div key="task" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl">
            <TaskFocusView
              task={data.todayTask}
              userId={user.id}
              onComplete={handleTaskComplete}
              onBack={() => setState('briefing')}
            />
          </motion.div>
        )}

        {/* COMPLETE */}
        {state === 'complete' && (
          <motion.div key="complete" className="w-full">
            <CompletionCelebration onContinue={handleExplore} xpEarned={completionMeta.xpEarned} levelUp={completionMeta.levelUp} newLevel={completionMeta.newLevel} />
          </motion.div>
        )}

        {/* EXPLORE */}
        {state === 'explore' && (
          <motion.div
            key="explore"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full flex flex-col items-center"
          >
            <div className="w-full max-w-3xl mb-8">
              <div className="flex items-center gap-3 px-4 py-3 bg-white/60 backdrop-blur-sm border border-[#2D2A26]/[0.06] rounded-2xl">
                <div className="w-8 h-8 rounded-full bg-[#8B7355] flex items-center justify-center shrink-0">
                  <span className="text-xs text-white">✨</span>
                </div>
                <p className="text-sm font-medium text-[#8A8279]">
                  <span className="font-bold text-[#2D2A26]">All caught up!</span> Explore workspaces, ask AI anything, or dive deeper into your subjects.
                </p>
              </div>
            </div>
            <ExploreGrid />
          </motion.div>
        )}
      </AnimatePresence>

      <TestUploadModal
        userId={user?.id}
        roadmapId={roadmapId}
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        onSuccess={handleTestSuccess}
      />
    </div>
  );
}
