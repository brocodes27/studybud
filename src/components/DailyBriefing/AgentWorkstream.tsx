import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, CheckCircle2, Loader2, AlertCircle, SkipForward,
  Activity, Calendar, Wrench, Database, Sparkles,
} from 'lucide-react';
import type { AgentStep, AgentRunReport } from '../../lib/agentOrchestrator';
import { runAgentWorkstream } from '../../lib/agentOrchestrator';

/**
 * AgentWorkstream
 * ---------------
 * Shown BEFORE the conversational briefing. On app open, Ranjan Sir is
 * already working — we display his real parallel actions streaming in, one
 * by one, with status + findings. When all actions complete, we hand off
 * the `AgentRunReport` to the parent so it can open the conversation with
 * context ("Here's what I did while you were away").
 *
 * Purpose: make the system feel proactive from the first second, not
 * reactive. It's the single biggest signal that separates "agent" from
 * "chatbot".
 */

interface Props {
  userId: string;
  onComplete: (report: AgentRunReport) => void;
}

const categoryIcon: Record<AgentStep['category'], any> = {
  analysis: Activity,
  planning: Sparkles,
  memory: Database,
  intel: Calendar,
  repair: Wrench,
};

export function AgentWorkstream({ userId, onComplete }: Props) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const seen = new Map<string, AgentStep>();

    runAgentWorkstream(userId, (step) => {
      if (cancelled) return;
      seen.set(step.id, step);
      setSteps(Array.from(seen.values()));
    }).then((report) => {
      if (cancelled) return;
      setFinishedAt(Date.now());
      // Brief pause so the user gets to see the "all done" state before we
      // cut to the conversation.
      setTimeout(() => {
        if (!cancelled) onComplete(report);
      }, 1200);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const allDone = steps.length > 0 && steps.every((s) => s.status !== 'pending' && s.status !== 'running');
  const runningCount = steps.filter((s) => s.status === 'running').length;
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col">
      {/* Header — Ranjan Sir is actively working */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-5"
      >
        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[#8B7355] to-[#5D4E3C] flex items-center justify-center shadow-md shrink-0">
          <Brain className="w-5 h-5 text-white" />
          {!allDone && (
            <motion.div
              className="absolute -inset-0.5 rounded-full border-2 border-[#8B7355]/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.2, 0.8] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-bold text-[#2D2A26] leading-tight">Ranjan Sir</h2>
          <motion.p
            key={allDone ? 'done' : 'working'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-semibold text-[#8A8279] flex items-center gap-1.5"
          >
            {allDone ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Done prepping. Handing over in a sec...
              </>
            ) : (
              <>
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-[#8B7355]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                {runningCount > 0
                  ? `Working on ${runningCount} thing${runningCount === 1 ? '' : 's'} · ${doneCount}/${steps.length} done`
                  : 'Warming up...'}
              </>
            )}
          </motion.p>
        </div>
      </motion.div>

      {/* Intro line */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-[13px] text-[#5D5A56] mb-4 leading-relaxed px-1"
      >
        I've been working on your prep while you were away — here's what I'm doing right now:
      </motion.p>

      {/* Step list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer: cumulative summary while waiting */}
      {allDone && finishedAt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 p-3 bg-gradient-to-br from-[#FAF8F5] to-white rounded-2xl border border-[#E8E2D9] text-center"
        >
          <p className="text-[11px] font-semibold text-[#8A8279]">
            Everything checked. Opening your session...
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepRow({ step, index }: { step: AgentStep; index: number }) {
  const Icon = categoryIcon[step.category] || Activity;
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';
  const isSkipped = step.status === 'skipped';
  const isError = step.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`flex items-start gap-3 p-3 rounded-2xl border transition-colors ${
        isRunning
          ? 'bg-white border-[#8B7355]/30 shadow-sm'
          : isDone
            ? 'bg-white border-[#E8E2D9]'
            : 'bg-[#FAF8F5] border-[#E8E2D9]'
      }`}
    >
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        {isRunning ? (
          <Loader2 className="w-4 h-4 text-[#8B7355] animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : isSkipped ? (
          <SkipForward className="w-4 h-4 text-[#B5AEA5]" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-[#E8E2D9]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="w-3 h-3 text-[#B5AEA5]" />
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#B5AEA5]">
            {step.category}
          </span>
        </div>
        <p
          className={`text-[12.5px] leading-snug ${
            isRunning ? 'text-[#2D2A26] font-semibold' : 'text-[#5D5A56]'
          }`}
        >
          {isDone || isSkipped ? (step.result || step.label) : step.label}
        </p>
        {step.status !== 'pending' && step.startedAt && step.finishedAt && (
          <p className="text-[10px] text-[#B5AEA5] font-medium mt-0.5">
            {Math.max(1, Math.round((step.finishedAt - step.startedAt) / 100) / 10)}s
          </p>
        )}
      </div>
    </motion.div>
  );
}
