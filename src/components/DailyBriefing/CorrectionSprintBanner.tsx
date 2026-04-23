import { motion } from 'framer-motion';
import { Wrench, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { CorrectionSprint } from '../../lib/dailyBriefing';

interface CorrectionSprintBannerProps {
  sprint: CorrectionSprint;
  onContinue: () => void;
}

export function CorrectionSprintBanner({ sprint, onContinue }: CorrectionSprintBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="w-full max-w-xl mb-6"
    >
      <div className="bg-gradient-to-r from-[#FB7185]/10 to-[#F59E0B]/10 border border-[#FB7185]/15 rounded-2xl p-5 shadow-neo-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FB7185]/10 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-[#FB7185]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-[#0A192F]">{sprint.sprintName}</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FB7185]/10 text-[#FB7185] uppercase tracking-wider">
                Active
              </span>
            </div>
            <p className="text-xs text-[#475569] mb-3">
              {sprint.tasksRemaining} task{sprint.tasksRemaining === 1 ? '' : 's'} remaining · {sprint.estimatedDays}-day repair plan
            </p>
            <button
              onClick={onContinue}
              className="group inline-flex items-center gap-2 text-xs font-bold text-[#FB7185] hover:text-[#E11D48] transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Continue Repair</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
