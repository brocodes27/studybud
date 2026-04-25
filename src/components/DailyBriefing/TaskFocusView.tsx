import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Clock, BookOpen, ExternalLink, Brain, Zap, Target, Flame, Lightbulb, Star } from 'lucide-react';
import type { TodayTask } from '../../lib/dailyBriefing';
import { markTaskCompleted } from '../../lib/dailyBriefing';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

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

export function TaskFocusView({ task, userId, onComplete, onBack }: TaskFocusViewProps) {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [checkedIntentions, setCheckedIntentions] = useState<Set<number>>(new Set());
  const [engagementScore, setEngagementScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const intentions = task.implementationIntentions || [];

  const handleDone = async () => {
    setSaving(true);
    const sourceType = task.type === 'prescription' ? 'prescription' as const :
                       task.type === 'correction_sprint' ? 'sprint' as const :
                       task.type === 'assignment' ? 'assignment' as const :
                       'weak_area' as const;

    const sourceId = task.prescriptionId || task.sprintId || task.id;
    const order = task.taskOrder || 0;

    const result = await markTaskCompleted(
      userId,
      sourceType,
      sourceId,
      order,
      task.durationMin,
      engagementScore ?? undefined,
      { taskTitle: task.title, subject: task.subject }
    );
    setSaving(false);
    if (!result.success) {
      showToast(result.error || 'Could not save task completion', 'error');
      return;
    }
    onComplete();
  };

  const handleNavigate = () => {
    if (task.actionRoute) navigate(task.actionRoute);
  };

  const toggleIntention = (index: number) => {
    setCheckedIntentions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const taskConfig = taskTypeConfig[task.type] || { icon: Brain, label: 'Focus Task', color: 'text-[#6366F1]' };
  const TaskIcon = taskConfig.icon;

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
          className="p-2 rounded-xl hover:bg-white transition-colors border border-transparent hover:border-[#0A192F]/[0.06]"
        >
          <ArrowLeft className="w-5 h-5 text-[#64748B]" />
        </button>
        <div>
          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Focus Mode</div>
          <h2 className="text-lg font-bold text-[#0A192F]">{task.title}</h2>
        </div>
      </div>

      {/* Immersive Card */}
      <div className="bg-white rounded-[24px] border border-[#0A192F]/[0.06] shadow-neo-lg p-6 md:p-10 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366F1]/10 to-[#00D1FF]/10 flex items-center justify-center">
            <TaskIcon className={`w-6 h-6 ${taskConfig.color}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0A192F]">{task.title}</h3>
            {task.durationMin && (
              <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{task.durationMin} minutes {taskConfig.label.toLowerCase()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FAFBFF] rounded-2xl p-5 mb-6 border border-[#0A192F]/[0.04]">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Instructions</div>
          <p className="text-sm text-[#475569] leading-relaxed">{task.description}</p>
        </div>

        {/* Implementation Intentions Checklist */}
        {intentions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6366F1] uppercase tracking-wider mb-3">
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
                      ? 'bg-[#34D399]/5 border-[#34D399]/20'
                      : 'bg-white border-[#0A192F]/[0.06] hover:border-[#6366F1]/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      checkedIntentions.has(i) ? 'bg-[#34D399] border-[#34D399]' : 'border-[#CBD5E1]'
                    }`}
                  >
                    {checkedIntentions.has(i) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs leading-relaxed ${checkedIntentions.has(i) ? 'text-[#34D399] line-through' : 'text-[#475569]'}`}>
                      <span className="font-bold text-[#6366F1]">If</span> {intention.trigger},{' '}
                      <span className="font-bold text-[#0A192F]">then</span> {intention.action}
                    </p>
                    {intention.duration_min && (
                      <span className="text-[10px] text-[#94A3B8] font-medium">{intention.duration_min} min</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!timerStarted ? (
          <div className="flex flex-col sm:flex-row gap-3">
            {task.actionRoute && (
              <button
                onClick={handleNavigate}
                className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-[#0A192F]/10 hover:border-[#6366F1]/30 text-[#0A192F] font-bold text-sm py-3.5 px-6 rounded-xl transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Open in App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setTimerStarted(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#1E293B] text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-neo transition-colors"
            >
              <Clock className="w-4 h-4" />
              <span>Start Focus Timer</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <FocusTimer minutes={task.durationMin || 25} />

            {/* Engagement Rating */}
            <div className="bg-[#FAFBFF] rounded-2xl p-4 border border-[#0A192F]/[0.04]">
              <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">
                How focused were you? (optional)
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => setEngagementScore(score)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      engagementScore === score
                        ? 'bg-[#F59E0B] text-white shadow-neo'
                        : 'bg-white border border-[#0A192F]/[0.06] text-[#64748B] hover:border-[#F59E0B]/30'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setConfirming(true)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-[#34D399] hover:bg-[#10B981] text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-neo transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Mark as Complete</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A192F]/40 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-neo-xl"
          >
            <h3 className="text-lg font-bold text-[#0A192F] mb-2">Confirm completion?</h3>
            <p className="text-sm text-[#64748B] mb-6">
              Great job! Marking this complete will unlock the full platform for you to explore.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 rounded-xl border-2 border-[#0A192F]/10 text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              >
                Not yet
              </button>
              <button
                onClick={handleDone}
                className="flex-1 py-3 rounded-xl bg-[#0A192F] text-white text-sm font-bold hover:bg-[#1E293B] transition-colors"
              >
                Yes, done!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

function FocusTimer({ minutes }: { minutes: number }) {
  const [timeLeft, setTimeLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  };

  return (
    <div className="bg-[#FAFBFF] rounded-2xl p-6 text-center border border-[#0A192F]/[0.04]">
      <div className="text-5xl font-extrabold text-[#0A192F] tabular-nums tracking-tight mb-4">
        {formatTime(timeLeft)}
      </div>
      <div className="flex justify-center gap-3">
        {!running ? (
          <button
            onClick={startTimer}
            className="px-5 py-2 bg-[#00D1FF] hover:bg-[#0EA5E9] text-white font-bold text-sm rounded-xl transition-colors"
          >
            Start
          </button>
        ) : (
          <button
            onClick={pauseTimer}
            className="px-5 py-2 bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold text-sm rounded-xl transition-colors"
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
}
