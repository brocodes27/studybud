import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import type { StudentState } from '../../lib/dailyBriefing';

interface BacklogAlertProps {
  state: StudentState;
  onReschedule: () => void;
}

export function BacklogAlert({ state, onReschedule }: BacklogAlertProps) {
  const hasBacklog = state.backlogCount > 2;
  const hasMissedStreak = state.missedDaysStreak >= 2;

  if (!hasBacklog && !hasMissedStreak) return null;

  let title = '';
  let message = '';

  if (hasMissedStreak && hasBacklog) {
    title = 'Backlog building up';
    message = `You've missed ${state.missedDaysStreak} days and have ${state.backlogCount} pending tasks. Let's reshuffle your plan realistically.`;
  } else if (hasMissedStreak) {
    title = 'Missed days detected';
    message = `You've missed ${state.missedDaysStreak} consecutive study days. A short catch-up plan will help you get back on track without overload.`;
  } else {
    title = 'Backlog alert';
    message = `You have ${state.backlogCount} pending tasks. Let's reschedule them so you don't feel overwhelmed.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="w-full max-w-xl mb-6"
    >
      <div className="bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#92400E] mb-1">{title}</h3>
            <p className="text-xs text-[#B45309] leading-relaxed mb-3">{message}</p>
            <button
              onClick={onReschedule}
              className="group inline-flex items-center gap-2 bg-white border border-[#F59E0B]/20 hover:border-[#F59E0B]/40 text-[#92400E] font-bold text-xs py-2 px-4 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reschedule My Plan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
