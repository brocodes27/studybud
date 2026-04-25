import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Brain, CheckCircle2, Lightbulb,
  AlertTriangle, Flame, Target, BookOpen, Upload, MessageCircle, Send,
} from 'lucide-react';
import type { DailyBriefingData, TodayTask } from '../../lib/dailyBriefing';
import { markTaskCompleted } from '../../lib/dailyBriefing';
import { TaskOutputUpload } from './TaskOutputUpload';
import { useToast } from '../../hooks/useToast';
import { remember, type ChatTurn } from '../../lib/memory';
import { AgentWorkstream } from './AgentWorkstream';
import type { AgentRunReport } from '../../lib/agentOrchestrator';
import AIService from '../../lib/aiService';

/**
 * Conversational, agentic replacement for the card-grid Daily Briefing.
 *
 * Ranjan Sir proactively types out:
 *   1. A greeting + state snapshot
 *   2. Today's classes / announcement / backlog (if relevant)
 *   3. The plan for today (with reasoning)
 *   4. Each task as its own message, one at a time
 *
 * The student replies via action chips (Done / Need help / Skip) which appear
 * as outbound bubbles in the same thread. Tasks can also be expanded inline
 * to upload work or ask Ranjan Sir for context.
 */

type MsgKind =
  | 'greeting'
  | 'state'
  | 'classUpdate'
  | 'plan'
  | 'task'
  | 'student'
  | 'allDone'
  | 'typing';

interface ChatMessage {
  id: string;
  kind: MsgKind;
  text?: string;
  task?: TodayTask;
  taskIndex?: number;
  actions?: Array<{ label: string; onClick: () => void; primary?: boolean; icon?: any }>;
  meta?: string;
}

interface Props {
  data: DailyBriefingData;
  userId: string;
  onAllComplete: () => void;
  onRefresh: () => void;
  onReschedule: () => void;
}

const taskIcon: Record<string, any> = {
  correction: AlertTriangle,
  study: BookOpen,
  review_notes: BookOpen,
  guided_examples: Brain,
  retrieval_check: Target,
  timed_set: Flame,
  assignment: Target,
};

function typingDelay(text: string): number {
  // Roughly 22 chars per "thought unit"; cap between 400ms and 1400ms.
  return Math.max(400, Math.min(1400, Math.round(text.length * 18)));
}

export function ConversationalBriefing({
  data,
  userId,
  onAllComplete,
  onRefresh,
  onReschedule,
}: Props) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localTasks, setLocalTasks] = useState<TodayTask[]>(data.todayTasks);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [scripted, setScripted] = useState(false);
  const [agentReport, setAgentReport] = useState<AgentRunReport | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync localTasks when upstream data changes
  useEffect(() => {
    setLocalTasks(data.todayTasks);
  }, [data.todayTasks]);

  // Autoscroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // -----------------------------------------------------------------------
  // Script: the initial conversational sequence
  // -----------------------------------------------------------------------
  useEffect(() => {
    // Wait until the autonomous agent workstream has finished running.
    if (scripted || !agentReport) return;
    setScripted(true);

    const pending = localTasks.filter(t => !t.completed);
    const firstPending = pending[0];

    const script: Array<Omit<ChatMessage, 'id'>> = [];

    // 1. Greeting — but framed around what the agent already DID, not "hi".
    const findingCount = agentReport.findings.length;
    script.push({
      kind: 'greeting',
      text: findingCount > 0
        ? `${data.greeting}, ${data.userName}. I finished a few things for you while you were away:`
        : `${data.greeting}, ${data.userName}.${data.streak > 1 ? ` ${data.streak}-day streak — keep the chain alive.` : ''}`,
    });

    // 1a. Stream each finding as its own message so it feels like the agent is
    //     reporting back, not greeting.
    agentReport.findings.slice(0, 3).forEach((f) => {
      script.push({ kind: 'plan', text: f });
    });

    // 1b. If we have a "left off" bookmark, surface it with a resume action
    if (agentReport.bookmark) {
      const bookmark = agentReport.bookmark;
      script.push({
        kind: 'plan',
        text: `I remember you left off on: "${bookmark.slice(0, 140)}". Want to pick up there, or start fresh with today's plan?`,
        actions: [
          {
            label: 'Pick up where I left off',
            primary: true,
            onClick: () => {
              appendStudent('Pick up where I left off');
              window.dispatchEvent(
                new CustomEvent('trigger-atlas-chat', {
                  detail: { message: `Let's continue from: ${bookmark}`, voice: false },
                }),
              );
            },
          },
          { label: "Today's plan first", onClick: () => appendStudent("Today's plan first") },
        ],
      });
    }

    // 1c. Proactive question — agent-driven, not waiting for input
    if (agentReport.proactiveQuestion) {
      script.push({
        kind: 'plan',
        text: agentReport.proactiveQuestion,
      });
    }

    // 2. State snapshot (only if meaningful)
    const state = data.studentState;
    const stateBits: string[] = [];
    if (state.backlogCount > 0) stateBits.push(`${state.backlogCount} backlog item${state.backlogCount === 1 ? '' : 's'}`);
    if (state.missedDaysStreak > 1) stateBits.push(`${state.missedDaysStreak} missed days`);
    if (state.weakSubjects.length > 0) stateBits.push(`weak in ${state.weakSubjects.slice(0, 2).join(', ')}`);

    if (stateBits.length > 0) {
      script.push({
        kind: 'state',
        text: `Quick read on your current state: ${stateBits.join(', ')}. I've factored that into today's plan.`,
        actions: state.backlogCount > 2 || state.missedDaysStreak > 2 ? [
          { label: 'Reschedule realistically', onClick: onReschedule, icon: MessageCircle },
        ] : undefined,
      });
    }

    // 3. Class / announcement context
    if (data.classUpdate.type !== 'none') {
      const cu = data.classUpdate;
      let text = '';
      if (cu.type === 'class_session') {
        text = `You had class today — ${cu.content}. Let's consolidate that before it fades.`;
      } else if (cu.type === 'announcement') {
        text = `Heads up from ${cu.source}: ${cu.content}`;
      } else if (cu.type === 'assignment_due') {
        text = `"${cu.title}" is due soon — I've pulled it into today's queue.`;
      } else if (cu.type === 'meeting_note') {
        text = `I pulled your note "${cu.title}" — we'll build on that.`;
      }
      if (text) script.push({ kind: 'classUpdate', text });
    }

    // 4. The plan
    if (pending.length > 0) {
      script.push({
        kind: 'plan',
        text: `Here's what I want you to do tonight — ${pending.length} task${pending.length === 1 ? '' : 's'}, about ${data.totalEstimatedMinutes} min total. We'll go one at a time.`,
      });

      // 5. First pending task surfaced immediately
      if (firstPending) {
        const idx = localTasks.indexOf(firstPending);
        script.push({
          kind: 'task',
          task: firstPending,
          taskIndex: idx,
        });
      }
    } else if (data.allTasksCompleted) {
      script.push({
        kind: 'allDone',
        text: `You've cleared everything for today. Proud of you. Go rest — or explore something new.`,
      });
    } else if (!data.activeRoadmap) {
      script.push({
        kind: 'plan',
        text: `You don't have an active roadmap yet. Pick one and I'll start building your daily plan.`,
      });
    }

    // Animate each message in sequence with typing delay
    let cumulative = 0;
    script.forEach((msg, i) => {
      const delay = i === 0 ? 150 : 350;
      cumulative += delay;
      setTimeout(() => {
        setMessages(prev => [...prev, { ...msg, id: `scripted-${i}-${Date.now()}` }]);
      }, cumulative);
      cumulative += typingDelay(msg.text || msg.task?.title || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentReport]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const appendStudent = (text: string, opts?: { mine?: boolean; bookmarkHint?: string }) => {
    setMessages(prev => [...prev, { id: `student-${Date.now()}-${Math.random()}`, kind: 'student', text }]);
    // Silently mine this utterance for long-term memory. Skip trivial chips
    // like "Done ✓" unless explicitly asked to mine, to keep the KB clean.
    if (opts?.mine !== false) {
      const recentChat: ChatTurn[] = messages
        .filter((m) => m.kind === 'student' || m.kind === 'plan' || m.kind === 'greeting' || m.kind === 'state' || m.kind === 'classUpdate' || m.kind === 'allDone')
        .slice(-8)
        .map((m) => ({
          role: (m.kind === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text || '',
        }));
      recentChat.push({ role: 'user', content: text });
      remember(recentChat, {
        source: 'briefing',
        sourceId: userId,
        bookmarkHint: opts?.bookmarkHint,
      });
    }
  };

  const appendAgent = (msg: Omit<ChatMessage, 'id' | 'kind'> & { kind?: MsgKind }) => {
    // Add typing indicator, then replace with real message after delay
    const typingId = `typing-${Date.now()}-${Math.random()}`;
    setMessages(prev => [...prev, { id: typingId, kind: 'typing' }]);
    const delay = typingDelay(msg.text || '');
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== typingId).concat([{
        ...msg,
        kind: msg.kind || 'plan',
        id: `agent-${Date.now()}-${Math.random()}`,
      }]));
    }, delay);
  };

  const surfaceNextTask = (afterIdx: number) => {
    const remaining = localTasks
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => i > afterIdx && !t.completed);

    if (remaining.length === 0) {
      const allDone = localTasks.every(t => t.completed);
      if (allDone) {
        appendAgent({
          kind: 'allDone',
          text: `That's the full list cleared. ${localTasks.length === 1 ? 'Sharp work.' : 'Clean sweep.'} Want to review what you learned?`,
          actions: [{ label: 'Celebrate & continue', onClick: onAllComplete, primary: true, icon: Sparkles }],
        });
      } else {
        appendAgent({
          kind: 'plan',
          text: `That's it for the suggested queue. You can revisit any task above, or call it a night.`,
        });
      }
      return;
    }

    const next = remaining[0];
    appendAgent({
      kind: 'task',
      task: next.t,
      taskIndex: next.i,
    });
  };

  const handleComplete = async (idx: number, task: TodayTask) => {
    if (task.completed) return;
    setCompletingTaskId(task.id);
    appendStudent('Done ✓', { mine: false });

    const sourceType =
      task.type === 'prescription' ? 'prescription' as const :
      task.type === 'correction_sprint' ? 'sprint' as const :
      task.type === 'assignment' ? 'assignment' as const :
      'weak_area' as const;
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
    setCompletingTaskId(null);

    if (!result.success) {
      showToast(result.error || 'Could not save completion', 'error');
      return;
    }

    const updated = [...localTasks];
    updated[idx] = { ...updated[idx], completed: true };
    setLocalTasks(updated);

    if (result.xpEarned) {
      appendAgent({ kind: 'plan', text: `+${result.xpEarned} XP. Moving on.` });
    }
    surfaceNextTask(idx);
  };

  const handleSkip = (idx: number) => {
    appendStudent('Skip for now', { mine: false });
    appendAgent({ kind: 'plan', text: `Noted — I'll keep it on the list. Next one.` });
    surfaceNextTask(idx);
  };

  const handleAskHelp = (task: TodayTask) => {
    appendStudent('I need help with this', {
      mine: true,
      bookmarkHint: `Stuck on: ${task.title}${task.subject ? ` (${task.subject})` : ''}`,
    });
    appendAgent({
      kind: 'plan',
      text: `Opening a focused chat. Tell me where you're stuck — formula, a specific step, or conceptually?`,
    });
    window.dispatchEvent(
      new CustomEvent('trigger-atlas-chat', {
        detail: {
          message: `Ranjan Sir, I need help with: ${task.title} (${task.subject || 'General'}). ${task.description?.slice(0, 120) || ''}`,
          voice: false,
        },
      })
    );
  };

  const handleExplainWhy = (task: TodayTask) => {
    appendStudent('Why this task?');
    const reason = buildReason(task, data);
    appendAgent({ kind: 'plan', text: reason });
  };

  const handleUploadDone = (idx: number) => {
    setUploadingIdx(null);
    const task = localTasks[idx];
    const updated = [...localTasks];
    updated[idx] = { ...updated[idx], outputSubmitted: true, completed: true };
    setLocalTasks(updated);
    appendStudent('Submitted my work', {
      mine: true,
      bookmarkHint: `Student submitted work for: ${task.title}${task.subject ? ` (${task.subject})` : ''}`,
    });
    appendAgent({ kind: 'plan', text: `Got it. I'll analyze what you submitted and fold it into your learner model.` });
    surfaceNextTask(idx);
    onRefresh();
  };

  const renderMessage = (m: ChatMessage) => {
    if (m.kind === 'typing') {
      return <TypingBubble key={m.id} />;
    }
    if (m.kind === 'student') {
      return <StudentBubble key={m.id} text={m.text || ''} />;
    }
    if (m.kind === 'task' && m.task && typeof m.taskIndex === 'number') {
      const t = m.task;
      const idx = m.taskIndex;
      const Icon = taskIcon[t.taskType || t.type] || BookOpen;
      const isUploading = uploadingIdx === idx;
      const isCompleting = completingTaskId === t.id;
      const current = localTasks[idx] || t;
      return (
        <AgentBubble key={m.id}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B7355] mb-1 flex items-center gap-1.5">
            <Icon className="w-3 h-3" />
            {current.subject || 'Task'} · {current.durationMin || 30} min
          </div>
          <p className="text-sm font-bold text-[#2D2A26] mb-1.5 leading-snug">{current.title}</p>
          {current.description && (
            <p className="text-[12.5px] text-[#5D5A56] leading-relaxed whitespace-pre-line mb-3">
              {current.description.split('\n\n')[0]}
            </p>
          )}
          {current.strategy && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50/60 rounded-xl mb-3 border border-amber-100">
              <Lightbulb className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-900 leading-relaxed">{current.strategy}</p>
            </div>
          )}

          <AnimatePresence>
            {isUploading && current.prescriptionId && (
              <TaskOutputUpload
                userId={userId}
                prescriptionId={current.prescriptionId}
                taskOrder={current.taskOrder || 0}
                taskTitle={current.title}
                subject={current.subject}
                onSuccess={() => handleUploadDone(idx)}
                onClose={() => setUploadingIdx(null)}
              />
            )}
          </AnimatePresence>

          {!current.completed && !isUploading && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <ChipButton
                primary
                disabled={!!isCompleting}
                onClick={() => handleComplete(idx, current)}
                icon={isCompleting ? undefined : CheckCircle2}
              >
                {isCompleting ? 'Saving…' : 'Mark done'}
              </ChipButton>
              {current.type === 'prescription' && !current.outputSubmitted && (
                <ChipButton onClick={() => setUploadingIdx(idx)} icon={Upload}>
                  Submit work
                </ChipButton>
              )}
              <ChipButton onClick={() => handleAskHelp(current)} icon={MessageCircle}>
                Need help
              </ChipButton>
              <ChipButton onClick={() => handleExplainWhy(current)}>
                Why this?
              </ChipButton>
              <ChipButton onClick={() => handleSkip(idx)}>Skip</ChipButton>
            </div>
          )}
          {current.completed && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mt-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </div>
          )}
        </AgentBubble>
      );
    }
    return (
      <AgentBubble key={m.id}>
        <p className="text-[13.5px] text-[#2D2A26] leading-relaxed whitespace-pre-line">{m.text}</p>
        {m.actions && m.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {m.actions.map((a, i) => (
              <ChipButton key={i} onClick={a.onClick} primary={a.primary} icon={a.icon}>
                {a.label}
              </ChipButton>
            ))}
          </div>
        )}
      </AgentBubble>
    );
  };

  const completed = localTasks.filter(t => t.completed).length;
  const total = localTasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Before the autonomous workstream finishes, render only the agent activity
  // feed. This is the crucial "it's already working" moment.
  if (!agentReport) {
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col pt-4">
        <AgentWorkstream userId={userId} onComplete={setAgentReport} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Slim header */}
      <div className="flex items-center gap-3 px-1 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B7355] to-[#5D4E3C] flex items-center justify-center shadow-sm shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-bold text-[#2D2A26] leading-tight">Ranjan Sir</h2>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#8A8279]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Mentoring live
            </span>
            {total > 0 && (
              <>
                <span className="text-[#E8E2D9]">·</span>
                <span>{completed}/{total} tasks · {progressPct}%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Thin progress line */}
      {total > 0 && (
        <div className="w-full h-[3px] bg-[#F5F0E8] rounded-full overflow-hidden mb-3">
          <motion.div
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#8B7355] to-[#B5956B] rounded-full"
          />
        </div>
      )}

      {/* Chat thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4"
        style={{ scrollbarGutter: 'stable' }}
      >
        <AnimatePresence initial={false}>
          {messages.map(renderMessage)}
        </AnimatePresence>
      </div>

      {/* Quick-reply composer */}
      <QuickComposer
        onSend={async (text) => {
          appendStudent(text, { mine: true, bookmarkHint: text.slice(0, 240) });
          try {
            const today = localTasks.map((task, i) => `${i + 1}. ${task.title}${task.subject ? ` (${task.subject})` : ''}${task.completed ? ' [done]' : ''}`).join('\n') || 'No tasks loaded yet.';
            const stateLine = `Backlog: ${data.studentState.backlogCount}, Missed days streak: ${data.studentState.missedDaysStreak}, Weak: ${(data.studentState.weakSubjects || []).slice(0, 3).join(', ') || 'unknown'}`;
            const prompt = `You are Ranjan Sir, the student's personal JEE coach inside their Daily Briefing. Reply concisely, warmly, and decisively in 2-4 short sentences. No fluff. Use second person.\n\nStudent context:\n${stateLine}\n\nToday's tasks:\n${today}\n\nStudent question: ${text}`;
            const { response } = await AIService.getInstance().generateEmpatheticChat(prompt, userId || 'guest', [], 'daily-briefing', false);
            const reply = response?.trim() || `I hear you. Let's keep moving on today's tasks and we can dig deeper after.`;
            appendAgent({ kind: 'plan', text: reply });
          } catch (err) {
            appendAgent({ kind: 'plan', text: `I couldn't reach the brain just now. Try again in a moment, or open Atlas for a deeper chat.` });
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-2 max-w-[92%]"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8B7355] to-[#5D4E3C] flex items-center justify-center shrink-0 mt-0.5">
        <Brain className="w-3 h-3 text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-md border border-[#E8E2D9] px-3.5 py-2.5 shadow-sm flex-1 min-w-0">
        {children}
      </div>
    </motion.div>
  );
}

function StudentBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-end"
    >
      <div className="bg-[#2D2A26] text-white rounded-2xl rounded-tr-md px-3.5 py-2 max-w-[80%] shadow-sm">
        <p className="text-[13px] leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-2"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8B7355] to-[#5D4E3C] flex items-center justify-center shrink-0">
        <Brain className="w-3 h-3 text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-md border border-[#E8E2D9] px-4 py-3 shadow-sm inline-flex items-center gap-1">
        <TypingDot delay={0} />
        <TypingDot delay={0.15} />
        <TypingDot delay={0.3} />
      </div>
    </motion.div>
  );
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-[#B5AEA5]"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

function ChipButton({
  children,
  onClick,
  primary,
  disabled,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  icon?: any;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-all disabled:opacity-50 ${
        primary
          ? 'bg-[#2D2A26] text-white hover:bg-[#3D3833] shadow-sm'
          : 'bg-[#FAF8F5] text-[#5D5A56] border border-[#E8E2D9] hover:bg-white hover:border-[#8B7355]/30'
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </button>
  );
}

function QuickComposer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSend(v);
    setValue('');
  };
  return (
    <div className="flex items-center gap-2 bg-white border border-[#E8E2D9] rounded-2xl px-3 py-2 shadow-sm">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Ask Ranjan Sir anything..."
        className="flex-1 bg-transparent text-[13px] text-[#2D2A26] placeholder:text-[#B5AEA5] outline-none"
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="w-8 h-8 rounded-full bg-[#2D2A26] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#3D3833] transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function buildReason(task: TodayTask, data: DailyBriefingData): string {
  if (task.type === 'correction_sprint') {
    return `This one's a repair job. A recent mistake pattern needs to be corrected before it hardens — that's why it jumped the queue.`;
  }
  if (task.type === 'assignment') {
    return `Deadline risk is higher than exploration value right now, so I prioritized this over open study.`;
  }
  if (task.subject && data.studentState.weakSubjects.includes(task.subject)) {
    return `${task.subject} is currently one of your weaker signals. A focused, bounded task closes the gap faster than broad revision.`;
  }
  if (task.outputSubmitted) {
    return `You already submitted work for this — the next value is validating what you produced, not re-doing it.`;
  }
  if (data.classUpdate.type === 'class_session' && task.subject) {
    const related = data.classUpdate.sessions?.find((s) => s.subject === task.subject);
    if (related) {
      return `${task.subject} showed up in class today. Same-day consolidation locks retention — that's why it's here.`;
    }
  }
  if (data.studentState.backlogCount > 0) {
    return `I kept this bounded on purpose — regaining momentum without growing your backlog is the priority.`;
  }
  return `Given your current roadmap, pace, and recent signals, this is the highest-leverage next step I can justify.`;
}
