import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, BookOpen, Brain, Zap, Target,
  Flame, ChevronDown, Upload, ArrowLeft, MessageCircle, X,
  Lightbulb, Star, FileCheck, AlertTriangle
} from 'lucide-react';
import type { TodayTask, DailyBriefingData } from '../../lib/dailyBriefing';
import { markTaskCompleted } from '../../lib/dailyBriefing';
import { TaskOutputUpload } from './TaskOutputUpload';
import { useToast } from '../../hooks/useToast';

interface TaskDashboardProps {
  data: DailyBriefingData;
  userId: string;
  onBack: () => void;
  onAllComplete: () => void;
  onRefresh: () => void;
}

const taskTypeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  review_notes: { icon: BookOpen, label: 'Learn & Understand', color: 'text-[#8B7355]', bg: 'bg-[#F5F0E8]' },
  guided_examples: { icon: Brain, label: 'Practice Examples', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  retrieval_check: { icon: Target, label: 'Self-Test', color: 'text-blue-600', bg: 'bg-blue-50' },
  timed_set: { icon: Zap, label: 'Timed Practice', color: 'text-amber-600', bg: 'bg-amber-50' },
  correction: { icon: AlertTriangle, label: 'Correction', color: 'text-red-600', bg: 'bg-red-50' },
  study: { icon: BookOpen, label: 'Study', color: 'text-[#8B7355]', bg: 'bg-[#F5F0E8]' },
  assignment: { icon: FileCheck, label: 'Assignment', color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

function getTaskReason(task: TodayTask, data: DailyBriefingData) {
  if (task.type === 'correction_sprint') {
    return 'This is here because a recent mistake pattern needs repair before it hardens into a habit.';
  }

  if (task.type === 'assignment') {
    return 'This is in front of you because deadline risk is higher than exploration value right now.';
  }

  if (task.subject && data.studentState.weakSubjects.includes(task.subject)) {
    return `This task is prioritized because ${task.subject} is currently a weaker signal in your learner model.`;
  }

  if (task.outputSubmitted) {
    return 'This task already has a work sample, so the next value is consolidating or validating what you produced.';
  }

  if (data.classUpdate.type === 'class_session' && task.subject) {
    const relatedSession = data.classUpdate.sessions?.find((session) => session.subject === task.subject);
    if (relatedSession) {
      return `This was scheduled because ${task.subject} showed up in class today and the system wants same-day consolidation.`;
    }
  }

  if (data.studentState.backlogCount > 0) {
    return 'This task is intentionally specific and bounded so you can regain momentum without growing your backlog.';
  }

  return 'This is the highest-leverage next step the system can justify with your current roadmap, pace, and recent study signals.';
}

export function TaskDashboard({ data, userId, onBack, onAllComplete, onRefresh }: TaskDashboardProps) {
  const { showToast } = useToast();
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [uploadingTask, setUploadingTask] = useState<number | null>(null);
  const [showMentor, setShowMentor] = useState(false);
  const [localTasks, setLocalTasks] = useState<TodayTask[]>(data.todayTasks);

  useEffect(() => {
    setLocalTasks(data.todayTasks);
  }, [data.todayTasks]);

  const completedCount = localTasks.filter(t => t.completed).length;
  const totalCount = localTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleTask = async (index: number) => {
    const task = localTasks[index];
    if (task.completed) return; // Don't allow un-completing

    setCompletingTask(task.id);

    const sourceType =
      task.type === 'prescription' ? 'prescription' as const :
      task.type === 'correction_sprint' ? 'sprint' as const :
      task.type === 'assignment' ? 'assignment' as const : 'weak_area' as const;

    const sourceId = task.prescriptionId || task.sprintId || task.id;
    const result = await markTaskCompleted(
      userId,
      sourceType,
      sourceId,
      task.taskOrder || 0,
      task.durationMin,
      undefined,
      { taskTitle: task.title, subject: task.subject }
    );

    if (result.success) {
      const updated = [...localTasks];
      updated[index] = { ...updated[index], completed: true };
      setLocalTasks(updated);

      if (result.xpEarned) {
        showToast(`+${result.xpEarned} XP earned!`, 'success');
      }

      // Check if all done
      const newCompleted = updated.filter(t => t.completed).length;
      if (newCompleted === totalCount) {
        setTimeout(onAllComplete, 800);
      }
    } else {
      showToast(result.error || 'Could not save task completion', 'error');
    }
    setCompletingTask(null);
  };

  const handleUploadSuccess = async (index: number) => {
    const task = localTasks[index];
    
    if (!task.completed) {
      setCompletingTask(task.id);
      const sourceType =
        task.type === 'prescription' ? 'prescription' as const :
        task.type === 'correction_sprint' ? 'sprint' as const :
        task.type === 'assignment' ? 'assignment' as const : 'weak_area' as const;

      const sourceId = task.prescriptionId || task.sprintId || task.id;
      const result = await markTaskCompleted(
        userId,
        sourceType,
        sourceId,
        task.taskOrder || 0,
        task.durationMin,
        undefined,
        { taskTitle: task.title, subject: task.subject }
      );
      
      if (result.success && result.xpEarned) {
        showToast(`+${result.xpEarned} XP earned!`, 'success');
      } else if (!result.success) {
        const updated = [...localTasks];
        updated[index] = { ...updated[index], outputSubmitted: true, completed: false };
        setLocalTasks(updated);
        setUploadingTask(null);
        setCompletingTask(null);
        showToast(result.error || 'Output saved, but task completion failed', 'error');
        onRefresh();
        return;
      }
    }

    const updated = [...localTasks];
    updated[index] = { ...updated[index], outputSubmitted: true, completed: true };
    setLocalTasks(updated);
    setUploadingTask(null);
    setCompletingTask(null);

    const newCompleted = updated.filter(t => t.completed).length;
    if (newCompleted === totalCount) {
      setTimeout(onAllComplete, 800);
    } else {
      onRefresh();
    }
  };

  const getTaskConfig = (task: TodayTask) => {
    return taskTypeConfig[task.taskType || task.type] || taskTypeConfig.study;
  };

  const openMentorWithContext = (task: TodayTask) => {
    window.dispatchEvent(
      new CustomEvent('trigger-atlas-chat', {
        detail: {
          message: `Ranjan Sir, I need help with: ${task.title} (${task.subject || 'General'}). ${task.description?.slice(0, 100)}`,
          voice: false,
        },
      })
    );
    setShowMentor(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex gap-6">
      {/* Main Task Panel */}
      <div className={`flex-1 min-w-0 transition-all ${showMentor ? 'max-w-[60%]' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white transition-colors border border-transparent hover:border-[#E8E2D9]"
          >
            <ArrowLeft className="w-5 h-5 text-[#8A8279]" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#2D2A26] tracking-tight">Today's Tasks</h2>
            <p className="text-xs text-[#8A8279] font-medium">
              {completedCount}/{totalCount} completed · {data.totalEstimatedMinutes} min total
            </p>
          </div>
          <button
            onClick={() => setShowMentor(!showMentor)}
            className={`p-2.5 rounded-xl transition-all ${
              showMentor
                ? 'bg-[#8B7355] text-white shadow-md'
                : 'bg-white border border-[#E8E2D9] text-[#8A8279] hover:text-[#2D2A26] hover:border-[#8B7355]/30'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-4 mb-4 shadow-sm">
          <div className="flex justify-between text-xs font-bold text-[#8A8279] mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-[#F5F0E8] rounded-full h-2.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[#8B7355] to-[#B5956B]"
            />
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {localTasks.map((task, idx) => {
            const config = getTaskConfig(task);
            const TaskIcon = config.icon;
            const isExpanded = expandedTask === idx;
            const isCompleting = completingTask === task.id;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`bg-white rounded-2xl border transition-all ${
                  task.completed
                    ? 'border-[#E8E2D9] opacity-60'
                    : isExpanded
                      ? 'border-[#8B7355]/30 shadow-md'
                      : 'border-[#E8E2D9] hover:border-[#8B7355]/20 hover:shadow-sm'
                }`}
              >
                {/* Task Header */}
                <div className="p-4 flex items-start gap-3">
                  <button
                    onClick={() => handleToggleTask(idx)}
                    disabled={task.completed || !!isCompleting}
                    className="mt-0.5 flex-shrink-0 transition-colors"
                  >
                    {isCompleting ? (
                      <div className="w-5 h-5 border-2 border-[#8B7355] rounded-full border-t-transparent animate-spin" />
                    ) : task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#B5AEA5] hover:text-[#8B7355]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : idx)}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <TaskIcon className={`w-3 h-3 ${config.color}`} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>
                      {task.outputSubmitted && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">SUBMITTED</span>
                      )}
                    </div>
                    <h3 className={`text-sm font-bold mb-0.5 ${task.completed ? 'text-[#B5AEA5] line-through' : 'text-[#2D2A26]'}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-[#8A8279] font-medium">
                      {task.subject && <span className="bg-[#F5F0E8] px-1.5 py-0.5 rounded text-[#8B7355]">{task.subject}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.durationMin || 30}m</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : idx)}
                    className="p-1 mt-1"
                  >
                    <ChevronDown className={`w-4 h-4 text-[#B5AEA5] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-[#F5F0E8]">
                        {/* Description */}
                        <div className="bg-[#FAF8F5] rounded-xl p-3 mt-3 mb-3">
                          <p className="text-xs text-[#5D5A56] leading-relaxed whitespace-pre-line">
                            {task.description}
                          </p>
                        </div>

                        {/* Strategy */}
                        {task.strategy && (
                          <div className="flex items-start gap-2 p-3 bg-amber-50/50 rounded-xl mb-3 border border-amber-100">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-800 leading-relaxed">{task.strategy}</p>
                          </div>
                        )}

                        <div className="flex items-start gap-2 p-3 bg-[#F3F8FF] rounded-xl mb-3 border border-[#DCEAFE]">
                          <Target className="w-3.5 h-3.5 text-[#2563EB] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">Why this task, why now</p>
                            <p className="text-[11px] text-[#1E3A8A] leading-relaxed">{getTaskReason(task, data)}</p>
                          </div>
                        </div>

                        {/* Resources */}
                        {task.resources && task.resources.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-[#B5AEA5] uppercase tracking-wider mb-1.5">Resources</p>
                            <div className="space-y-1">
                              {task.resources.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] text-[#5D5A56]">
                                  <BookOpen className="w-3 h-3 text-[#8B7355]" />
                                  {r}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {!task.completed && (
                            <button
                              onClick={() => openMentorWithContext(task)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F0E8] hover:bg-[#EDE7DD] text-[#8B7355] font-bold text-[11px] rounded-xl transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" /> Ask Ranjan Sir
                            </button>
                          )}
                          {!task.outputSubmitted && task.type === 'prescription' && (
                            <button
                              onClick={() => setUploadingTask(uploadingTask === idx ? null : idx)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-[#2D2A26] hover:bg-[#3D3833] text-white font-bold text-[11px] rounded-xl transition-colors"
                            >
                              <Upload className="w-3 h-3" /> Upload Output
                            </button>
                          )}
                          {task.outputSubmitted && (
                            <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-xl">
                              <CheckCircle2 className="w-3 h-3" /> Output Submitted
                            </span>
                          )}
                        </div>

                        {/* Upload Section */}
                        <AnimatePresence>
                          {uploadingTask === idx && task.prescriptionId && (
                            <TaskOutputUpload
                              userId={userId}
                              prescriptionId={task.prescriptionId}
                              taskOrder={task.taskOrder || 0}
                              taskTitle={task.title}
                              subject={task.subject}
                              onSuccess={() => handleUploadSuccess(idx)}
                              onClose={() => setUploadingTask(null)}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {localTasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#E8E2D9]">
              <Star className="w-8 h-8 text-[#B5AEA5] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#8A8279]">No tasks for today yet.</p>
              <p className="text-xs text-[#B5AEA5] mt-1">Your daily prescription will be generated soon.</p>
            </div>
          )}
        </div>

        {/* Implementation Intentions */}
        {data.implementationIntentions && data.implementationIntentions.length > 0 && (
          <div className="mt-6 bg-gradient-to-br from-[#F5F0E8] to-[#FAF8F5] rounded-2xl border border-[#E8E2D9] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-[#8B7355]" />
              <h3 className="text-xs font-bold text-[#2D2A26] uppercase tracking-wider">If–Then Commitments</h3>
            </div>
            <div className="space-y-2">
              {data.implementationIntentions.map((intent, i) => (
                <div key={i} className="text-[11px] text-[#5D5A56] leading-relaxed">
                  <span className="font-bold text-[#8B7355]">When</span> {intent.trigger},{' '}
                  <span className="font-bold text-[#2D2A26]">I will</span> {intent.action}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mentor Sidebar */}
      <AnimatePresence>
        {showMentor && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 360 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="hidden md:block flex-shrink-0 overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-[#E8E2D9] h-[calc(100vh-200px)] sticky top-24 flex flex-col shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-[#E8E2D9]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#8B7355] flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#2D2A26]">Ranjan Sir</h3>
                    <p className="text-[9px] text-[#B5AEA5]">Your Mentor</p>
                  </div>
                </div>
                <button onClick={() => setShowMentor(false)} className="p-1 hover:bg-[#F5F0E8] rounded-lg">
                  <X className="w-3.5 h-3.5 text-[#8A8279]" />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <Brain className="w-10 h-10 text-[#B5AEA5] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#8A8279] mb-2">Click "Ask Ranjan Sir" on any task</p>
                  <p className="text-xs text-[#B5AEA5]">or open Atlas for a full session</p>
                  <button
                    onClick={() => window.location.href = '/atlas'}
                    className="mt-4 px-4 py-2 bg-[#8B7355] text-white text-xs font-bold rounded-xl hover:bg-[#7A6548] transition-colors"
                  >
                    Open Atlas
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
