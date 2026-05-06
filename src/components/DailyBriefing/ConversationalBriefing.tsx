import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Brain, CheckCircle2, Lightbulb,
  AlertTriangle, Flame, Target, BookOpen, Upload, MessageCircle, Send, Timer,
  Trophy,
} from 'lucide-react';
import type { DailyBriefingData, TodayTask } from '../../lib/dailyBriefing';
import { supabase } from '../../lib/supabase';
import { TaskOutputUpload } from './TaskOutputUpload';
import { remember, type ChatTurn } from '../../lib/memory';
import { AgentWorkstream } from './AgentWorkstream';
import type { AgentRunReport } from '../../lib/agentOrchestrator';
import { executeTool, type AgentContext, type ToolResult } from '../../lib/agentTools';
import { buildStudentCommandCenter, type StudentCommandCenterModel } from '../../lib/studentRetentionCore';

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
  | 'typing'
  | 'tool_call';

interface ChatMessage {
  id: string;
  kind: MsgKind;
  text?: string;
  task?: TodayTask;
  taskIndex?: number;
  actions?: Array<{ label: string; onClick: () => void; primary?: boolean; icon?: any }>;
  meta?: string;
  toolCall?: { tool: string; args: any; preface?: string };
  suggestedReplies?: string[];
}

interface Props {
  data: DailyBriefingData;
  userId: string;
  onAllComplete: () => void;
  onRefresh: () => void;
  onReschedule: () => void;
  onStartFocus?: (task: TodayTask, idx: number) => void;
  completedTaskId?: string | null;
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
  onReschedule, // agent now handles rescheduling via regenerate_plan tool
  onStartFocus,
  completedTaskId,
}: Props) {
  void onReschedule; // agent now handles rescheduling via regenerate_plan tool
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localTasks, setLocalTasks] = useState<TodayTask[]>(data.todayTasks);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // completingTaskId state removed — task completion now only happens in FocusRun timer
  const [agentReport, setAgentReport] = useState<AgentRunReport | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<Array<{ role: 'user' | 'model'; content: string }>>([]);
  const initializedRef = useRef(false);
  const isTurnInProgress = useRef(false);
  const prevCompletedRef = useRef<string | null>(null);

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
  // Agent context builder
  // -----------------------------------------------------------------------
  const buildAgentContext = useCallback(() => {
    const s = data.studentState;
    const nextTest = (data as any).nextTest || null;
    return {
      userName: data.userName,
      studentState: {
        currentStreak: data.streak,
        backlogCount: s.backlogCount,
        missedDaysStreak: s.missedDaysStreak,
        weakSubjects: s.weakSubjects,
        preferredTime: s.preferredTime,
        typicalSessionDuration: s.typicalSessionDuration,
      },
      todayTasks: localTasks.map((t, i) => ({
        index: i,
        type: t.type,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        completed: t.completed,
        description: t.description?.slice(0, 200),
      })),
      backlogTasks: data.backlogTasks.map((t, i) => ({
        index: i,
        type: t.type,
        title: t.title,
        subject: t.subject,
        durationMin: t.durationMin,
        completed: t.completed,
        description: t.description?.slice(0, 200),
      })),
      nextTest: nextTest ? {
        name: nextTest.test_name || nextTest.name,
        date: nextTest.test_date || nextTest.date,
        daysUntil: nextTest.days_until || 0,
      } : null,
      findings: agentReport?.findings || [],
      bookmark: agentReport?.bookmark,
      classUpdate: data.classUpdate,
    };
  }, [data, localTasks, agentReport]);

  // -----------------------------------------------------------------------
  // Agent turn — the heart of the loop
  // -----------------------------------------------------------------------
  const agentTurn = useCallback(async (
    studentMessage: string | null,
    overrideContext?: any,
    toolResult?: ToolResult,
  ) => {
    if (studentMessage) {
      conversationHistory.current.push({ role: 'user', content: studentMessage });
    }

    if (isTurnInProgress.current) return;
    isTurnInProgress.current = true;
    setIsAgentThinking(true);
    setSuggestedReplies([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const context = overrideContext || buildAgentContext();
      const body: any = {
        messages: conversationHistory.current.slice(-20),
        context,
      };
      if (toolResult) {
        body.tool_results = toolResult;
      }

      const callAgent = (accessToken: string) => fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-turn`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(body),
        }
      );

      let res = await callAgent(token);
      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token;
        if (token) res = await callAgent(token);
      }

      if (!res.ok) throw new Error(`Agent turn failed: ${res.status}`);
      const result = await res.json();

      if (result.type === 'tool_call') {
        // Show preface text if agent provided one, then execute tool
        if (result.text) {
          conversationHistory.current.push({ role: 'model', content: result.text });
          appendAgent({ kind: 'plan', text: result.text });
        }
        // Execute tool and send result back
        await handleToolExecution(result.tool, result.args);
      } else if (result.type === 'message') {
        conversationHistory.current.push({ role: 'model', content: result.text });
        appendAgent({ kind: 'plan', text: result.text });
        // Parse suggested replies if embedded in text
        const replyMatch = result.text.match(/\[SUGGESTED_REPLIES:([^\]]+)\]/);
        if (replyMatch) {
          try {
            const replies = JSON.parse(replyMatch[1]);
            if (Array.isArray(replies)) setSuggestedReplies(replies);
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      console.error('Agent turn error:', err);
      appendAgent({
        kind: 'plan',
        text: `I'm having a little trouble thinking right now — let's keep going in a moment.`,
      });
    } finally {
      setIsAgentThinking(false);
      isTurnInProgress.current = false;
    }
  }, [buildAgentContext]);

  // -----------------------------------------------------------------------
  // Tool execution
  // -----------------------------------------------------------------------
  const handleToolExecution = useCallback(async (tool: string, args: any) => {
    const toolContext: AgentContext = {
      userId,
      roadmapId: data.roadmapId,
      todayTasks: localTasks,
      data,
      onRefresh,
      onNavigate: (route: string) => {
        if (typeof window !== 'undefined') window.location.href = route;
      },
      onPresentTask: (taskIndex: number, preface: string) => {
        if (preface) appendAgent({ kind: 'plan', text: preface });
        const task = localTasks[taskIndex];
        if (task) appendAgent({ kind: 'task', task, taskIndex });
      },
      onAskReflection: (question: string) => {
        appendAgent({
          kind: 'plan',
          text: question,
          actions: [{ label: 'Skip', onClick: () => agentTurn('Skipped reflection.') }],
        });
      },
      onShowReplies: (replies: string[]) => setSuggestedReplies(replies),
    };

    const result = await executeTool({ tool, args }, toolContext);

    // Refresh local tasks if completion happened
    if (tool === 'mark_task_complete' && result.success) {
      const idx = args.task_index ?? 0;
      const updated = [...localTasks];
      if (updated[idx]) updated[idx] = { ...updated[idx], completed: true };
      setLocalTasks(updated);
      if (result.data?.xp_earned) {
        appendAgent({ kind: 'plan', text: `+${result.data.xp_earned} XP. Great work!` });
      }
      onRefresh();
    }

    // Only send tool result back for tools that need an agent response.
    // present_task, ask_reflection, show_suggested_replies, navigate_to, open_mentor_chat
    // are terminal — executing them is enough; sending back creates an infinite loop.
    const toolsNeedingResponse = ['search_web', 'regenerate_plan', 'mark_task_complete'];
    if (toolsNeedingResponse.includes(tool)) {
      await agentTurn(null, undefined, result);
    }
  }, [localTasks, data, userId, onRefresh, agentTurn]);

  // -----------------------------------------------------------------------
  // Initialize agent when workstream completes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (initializedRef.current || !agentReport) return;
    initializedRef.current = true;

    const init = async () => {
      const context = buildAgentContext();
      await agentTurn(null, context);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentReport]);

  // -----------------------------------------------------------------------
  // Message helpers
  // -----------------------------------------------------------------------
  const appendStudent = (text: string, opts?: { mine?: boolean; bookmarkHint?: string }) => {
    setMessages(prev => [...prev, { id: `student-${Date.now()}-${Math.random()}`, kind: 'student', text }]);
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

  // -----------------------------------------------------------------------
  // Auto-surface next task when a task is completed externally (e.g. via Focus timer)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!completedTaskId || completedTaskId === prevCompletedRef.current) return;
    prevCompletedRef.current = completedTaskId;

    const idx = localTasks.findIndex((t) => t.id === completedTaskId);
    if (idx === -1) return;

    // Mark completed locally so surfaceNextTask skips it
    const updated = [...localTasks];
    if (!updated[idx].completed) {
      updated[idx] = { ...updated[idx], completed: true };
      setLocalTasks(updated);
    }

    // Small delay so UI updates feel natural
    const timer = setTimeout(() => surfaceNextTask(idx), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedTaskId]);

  // -----------------------------------------------------------------------
  // Task interaction helpers
  // -----------------------------------------------------------------------
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
      }
      return;
    }

    const next = remaining[0];
    appendAgent({ kind: 'task', task: next.t, taskIndex: next.i });
  };

  const handleSkip = (idx: number) => {
    appendStudent('Skip for now', { mine: false });
    surfaceNextTask(idx);
  };

  const handleAskHelp = (task: TodayTask) => {
    appendStudent(`I need help with ${task.title}`, {
      mine: true,
      bookmarkHint: `Stuck on: ${task.title}${task.subject ? ` (${task.subject})` : ''}`,
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
    surfaceNextTask(idx);
    onRefresh();
  };

  // -----------------------------------------------------------------------
  // Render message bubble
  // -----------------------------------------------------------------------
  const renderMessage = (m: ChatMessage) => {
    if (m.kind === 'typing') return <TypingBubble key={m.id} />;
    if (m.kind === 'student') return <StudentBubble key={m.id} text={m.text || ''} />;
    if (m.kind === 'task' && m.task && typeof m.taskIndex === 'number') {
      const t = m.task;
      const idx = m.taskIndex;
      const Icon = taskIcon[t.taskType || t.type] || BookOpen;
      const isUploading = uploadingIdx === idx;
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
              {onStartFocus && (
                <ChipButton
                  onClick={() => onStartFocus(current, idx)}
                  icon={Timer}
                >
                  Start Focus
                </ChipButton>
              )}
              {current.type === 'prescription' && !current.outputSubmitted && (
                <ChipButton onClick={() => setUploadingIdx(idx)} icon={Upload}>Submit work</ChipButton>
              )}
              <ChipButton onClick={() => handleAskHelp(current)} icon={MessageCircle}>Need help</ChipButton>
              <ChipButton onClick={() => handleExplainWhy(current)}>Why this?</ChipButton>
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
  const commandCenter = buildStudentCommandCenter({
    streak: data.streak,
    studentState: data.studentState,
    todayTasks: localTasks,
    recentSubmissions: data.recentSubmissions,
  });
  const pendingBacklogTasks = data.backlogTasks.filter(t => !t.completed);

  // Before workstream finishes, show agent activity
  if (!agentReport) {
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col pt-4">
        <AgentWorkstream userId={userId} onComplete={setAgentReport} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      <StudentCommandCenter model={commandCenter} />
      {pendingBacklogTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-black text-amber-900">Backlog</h3>
                  <p className="text-[11px] font-semibold text-amber-700">
                    Previous homework is parked here, separate from today&apos;s plan.
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-white/70 border border-amber-200 rounded-full px-2 py-1">
                  {pendingBacklogTasks.length} pending
                </span>
              </div>
              <div className="space-y-2">
                {pendingBacklogTasks.slice(0, 3).map((task, idx) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 border border-amber-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2D2A26] truncate">{task.title}</p>
                      <p className="text-[10px] font-semibold text-amber-700 truncate">{task.description}</p>
                    </div>
                    {onStartFocus && (
                      <button
                        onClick={() => onStartFocus(task, idx)}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-amber-600 text-white text-[10px] font-black hover:bg-amber-700 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slim header */}
      <div className="flex items-center gap-3 px-1 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#8B7355] to-[#5D4E3C] flex items-center justify-center shadow-sm shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-bold text-[#2D2A26] leading-tight">Ranjan Sir</h2>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-[#8A8279]">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isAgentThinking ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isAgentThinking ? 'Thinking...' : 'Mentoring live'}
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

      <div className="flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto space-y-3 px-1 pb-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          <AnimatePresence initial={false}>
            {messages.map(renderMessage)}
          </AnimatePresence>
        </div>
      </div>

      {/* Composer: free text + suggested replies */}
      <div className="space-y-2">
        {suggestedReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {suggestedReplies.map((reply, i) => (
              <button
                key={i}
                onClick={() => {
                  appendStudent(reply, { mine: true });
                  agentTurn(reply);
                  setSuggestedReplies([]);
                }}
                className="px-3 py-1.5 bg-white border border-[#E8E2D9] rounded-full text-[11px] font-semibold text-[#5D5A56] hover:bg-[#FAF8F5] hover:border-[#8B7355]/30 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <AgentComposer
          onSend={(text) => {
            appendStudent(text, { mine: true, bookmarkHint: text.slice(0, 240) });
            agentTurn(text);
          }}
          disabled={isAgentThinking}
        />
      </div>
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

function StudentCommandCenter({ model }: { model: StudentCommandCenterModel }) {
  const modeStyle =
    model.mode === 'comeback' ? 'bg-red-50 text-red-700' :
    model.mode === 'repair' ? 'bg-amber-50 text-amber-700' :
    model.mode === 'momentum' ? 'bg-emerald-50 text-emerald-700' :
    'bg-blue-50 text-blue-700';

  return (
    <div className="bg-white border border-[#E8E2D9] rounded-2xl px-3.5 py-3 mb-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${modeStyle}`}>
          {model.mode}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-black text-[#2D2A26] truncate">{model.identityTitle}</h2>
            <span className="text-[10px] font-bold text-[#B5AEA5] shrink-0">
              {model.completedCount}/{model.totalCount}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-[#8A8279] truncate">{model.identityDetail}</p>
        </div>
        <div className="w-20 shrink-0">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-[12px] font-black text-[#2D2A26]">{model.progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#F5F0E8] rounded-full overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${model.progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-[#8B7355] rounded-full"
            />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] font-bold text-[#8A8279]">
        <Trophy className="w-3.5 h-3.5 text-amber-500" />
        {model.rewardCue}
      </div>
    </div>
  );
}

function AgentComposer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
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
        placeholder={disabled ? "Ranjan Sir is thinking..." : "Ask Ranjan Sir anything..."}
        disabled={disabled}
        className="flex-1 bg-transparent text-[13px] text-[#2D2A26] placeholder:text-[#B5AEA5] outline-none disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
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
