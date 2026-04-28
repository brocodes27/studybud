import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock, BookOpen, Brain, Zap, Target, Flame, Lightbulb } from 'lucide-react';
import type { TodayTask } from '../../lib/dailyBriefing';
import { markTaskCompleted } from '../../lib/dailyBriefing';
import { useToast } from '../../hooks/useToast';
import { PreflightCard } from './PreflightCard';
import { FocusRun, type SessionStep } from './FocusRun';
import { SessionDebrief, type DebriefData } from './SessionDebrief';

interface TaskFocusViewProps {
  task: TodayTask;
  userId: string;
  onComplete: () => void;
  onBack: () => void;
}

const taskTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  review_notes: { icon: BookOpen, label: 'Review Notes', color: 'text-[#6366F1]' },
  guided_examples: { icon: Brain, label: 'Guided Examples', color: 'text-[#34D399]' },
  retrieval_check: { icon: Target, label: 'Retrieval Check', color: 'text-[#00D1FF]' },
  timed_set: { icon: Zap, label: 'Timed Practice', color: 'text-[#F59E0B]' },
  deep_work: { icon: Flame, label: 'Deep Work', color: 'text-[#FB7185]' },
  practice: { icon: Target, label: 'Practice', color: 'text-[#00D1FF]' },
  video: { icon: BookOpen, label: 'Video Study', color: 'text-[#6366F1]' },
};

type FlowPhase = 'preflight' | 'focus' | 'debrief';

export function TaskFocusView({ task, userId, onComplete, onBack }: TaskFocusViewProps) {
  const { showToast } = useToast();
  const [phase, setPhase] = useState<FlowPhase>('preflight');
  const [sessionData, setSessionData] = useState<{
    elapsedSec: number;
    pauseEvents: { reason: string; timestampSec: number }[];
    stuckEvents: { timestampSec: number; interventionType: string; resolved: boolean }[];
    finalStepIndex: number;
  } | null>(null);
  const [checkedIntentions, setCheckedIntentions] = useState<Set<number>>(new Set());
  const intentions = task.implementationIntentions || [];

  const deriveSteps = (): SessionStep[] => {
    if (task.steps && task.steps.length > 0) return task.steps;
    // Simple fallback: split description into sentences as steps
    const sentences = task.description
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    if (sentences.length >= 2) {
      return sentences.slice(0, 5).map((s) => ({ label: s }));
    }
    return [{ label: 'Work through the task' }, { label: 'Review and self-check' }];
  };

  const handleNotReady = async (reason: string) => {
    try {
      await import('../../lib/supabase').then(({ supabase }) =>
        supabase.from('session_signals').insert({
          user_id: userId,
          signal_type: 'not_ready',
          reason,
          task_id: task.id,
          created_at: new Date().toISOString(),
        })
      );
    } catch {
      // best-effort capture
    }
    showToast('Feedback saved. We will adjust your next session.', 'info');
    onBack();
  };

  const handleFocusComplete = (data: {
    elapsedSec: number;
    pauseEvents: { reason: string; timestampSec: number }[];
    stuckEvents: { timestampSec: number; interventionType: string; resolved: boolean }[];
    finalStepIndex: number;
  }) => {
    // Persist session telemetry if table exists (best-effort)
    void import('../../lib/supabase').then(({ supabase }) =>
      supabase.from('session_signals').insert({
        user_id: userId,
        signal_type: 'focus_complete',
        task_id: task.id,
        metadata: {
          elapsed_sec: data.elapsedSec,
          pauses: data.pauseEvents,
          stucks: data.stuckEvents,
          final_step: data.finalStepIndex,
        },
        created_at: new Date().toISOString(),
      })
    );
    setSessionData(data);
    setPhase('debrief');
  };

  const handleDebriefSubmit = async (data: DebriefData) => {
    const sourceType =
      task.type === 'prescription' ? ('prescription' as const) :
      task.type === 'correction_sprint' ? ('sprint' as const) :
      task.type === 'assignment' ? ('assignment' as const) :
      ('weak_area' as const);

    const sourceId = task.prescriptionId || task.sprintId || task.id;
    const order = task.taskOrder || 0;

    const result = await markTaskCompleted(
      userId,
      sourceType,
      sourceId,
      order,
      task.durationMin,
      data.confidence,
      {
        taskTitle: task.title,
        subject: task.subject,
        notes: `Confidence: ${data.confidence}/5. Voice reflection: ${data.voiceTranscript || 'none'}. AI analysis: ${data.analysis || 'none'}`,
      }
    );
    if (!result.success) {
      showToast(result.error || 'Could not save task completion', 'error');
      return;
    }
    onComplete();
  };

  const handleGenerateCorrectionSprint = () => {
    showToast('Correction sprint queued for generation', 'info');
    // Parent dashboard or orchestrator can pick this up
  };

  const toggleIntention = (index: number) => {
    setCheckedIntentions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const taskConfig = taskTypeConfig[task.type] || { icon: Brain, label: 'Focus Task', color: 'text-[#8B7355]' };
  const TaskIcon = taskConfig.icon;

  const examType: 'cbse' | 'jee' | 'general' =
    task.subject?.toLowerCase().includes('jee') ? 'jee' :
    task.subject?.toLowerCase().includes('cbse') ? 'cbse' : 'general';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-white transition-colors border border-transparent hover:border-[#2D2A26]/[0.06]"
        >
          <ArrowLeft className="w-5 h-5 text-[#8A8279]" />
        </button>
        <div>
          <div className="text-[10px] font-bold text-[#8A8279] uppercase tracking-wider">
            {phase === 'preflight' ? 'Preflight' : phase === 'focus' ? 'Focus Run' : 'Session Debrief'}
          </div>
          <h2 className="text-lg font-bold text-[#2D2A26]">{task.title}</h2>
        </div>
      </div>

      {/* Immersive Card */}
      <div className="bg-white rounded-[24px] border border-[#2D2A26]/[0.06] shadow-[0_8px_32px_rgba(45,42,38,0.08)] p-6 md:p-10 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B7355]/10 to-[#6B8E6B]/10 flex items-center justify-center">
            <TaskIcon className={`w-6 h-6 ${taskConfig.color}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#2D2A26]">{task.title}</h3>
            {task.durationMin && (
              <div className="flex items-center gap-1.5 text-xs text-[#8A8279] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{task.durationMin} minutes {taskConfig.label.toLowerCase()}</span>
              </div>
            )}
          </div>
        </div>

        {phase === 'preflight' && (
          <>
            <div className="bg-[#F5F0E8] rounded-2xl p-5 mb-6 border border-[#2D2A26]/[0.04]">
              <div className="text-[11px] font-bold text-[#8A8279] uppercase tracking-wider mb-2">Instructions</div>
              <p className="text-sm text-[#3D3833] leading-relaxed">{task.description}</p>
            </div>

            {/* Implementation Intentions Checklist */}
            {intentions.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B7355] uppercase tracking-wider mb-3">
                  <Lightbulb className="w-3 h-3" />
                  If–Then Commitments
                </div>
                <div className="space-y-2">
                  {intentions.map((intention, i) => (
                    <button
                      key={i}
                      onClick={() => toggleIntention(i)}
                      className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border transition-all ${
                        checkedIntentions.has(i)
                          ? 'bg-[#6B8E6B]/5 border-[#6B8E6B]/20'
                          : 'bg-white border-[#2D2A26]/[0.06] hover:border-[#8B7355]/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          checkedIntentions.has(i) ? 'bg-[#6B8E6B] border-[#6B8E6B]' : 'border-[#C4A484]'
                        }`}
                      >
                        {checkedIntentions.has(i) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs leading-relaxed ${checkedIntentions.has(i) ? 'text-[#6B8E6B] line-through' : 'text-[#3D3833]'}`}>
                          <span className="font-bold text-[#8B7355]">If</span> {intention.trigger},{' '}
                          <span className="font-bold text-[#2D2A26]">then</span> {intention.action}
                        </p>
                        {intention.duration_min && (
                          <span className="text-[10px] text-[#8A8279] font-medium">{intention.duration_min} min</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <PreflightCard
              goal={`By the end, you should be able to ${task.description.slice(0, 80).toLowerCase()}${task.description.length > 80 ? '...' : ''}`}
              steps={deriveSteps()}
              successCriteria="Get 8/10 or Explain in 60 seconds"
              materials={['Notebook open', 'Formula sheet']}
              estimatedMin={task.durationMin}
              onStart={() => setPhase('focus')}
              onNotReady={handleNotReady}
            />
          </>
        )}

        {phase === 'focus' && (
          <FocusRun
            steps={deriveSteps()}
            totalMinutes={task.durationMin || 25}
            onComplete={handleFocusComplete}
            onAbandon={() => setPhase('preflight')}
          />
        )}

        {phase === 'debrief' && sessionData && (
          <SessionDebrief
            taskTitle={task.title}
            subject={task.subject}
            examType={examType}
            sessionData={sessionData}
            onSubmit={handleDebriefSubmit}
            onGenerateCorrectionSprint={handleGenerateCorrectionSprint}
          />
        )}
      </div>
    </motion.div>
  );
}
