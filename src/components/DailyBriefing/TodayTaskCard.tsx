import { motion } from 'framer-motion';
import { AlertTriangle, Flame, Target, Zap, ArrowRight, Clock, Lightbulb } from 'lucide-react';
import type { TodayTask } from '../../lib/dailyBriefing';

interface TodayTaskCardProps {
  task: TodayTask;
  onStart: () => void;
}

const urgencyConfig = {
  critical: { icon: AlertTriangle, color: 'text-[#FB7185]', bg: 'bg-[#FB7185]/[0.06]', border: 'border-[#FB7185]/15', badge: 'Overdue' },
  high: { icon: Flame, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/[0.06]', border: 'border-[#F59E0B]/15', badge: 'Priority' },
  normal: { icon: Target, color: 'text-[#00D1FF]', bg: 'bg-[#00D1FF]/[0.06]', border: 'border-[#00D1FF]/15', badge: 'Today' },
  low: { icon: Zap, color: 'text-[#34D399]', bg: 'bg-[#34D399]/[0.06]', border: 'border-[#34D399]/15', badge: 'Recommended' },
};

export function TodayTaskCard({ task, onStart }: TodayTaskCardProps) {
  const config = urgencyConfig[task.urgency] || urgencyConfig.normal;
  const Icon = config.icon;
  const intentions = task.implementationIntentions || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="w-full max-w-xl"
    >
      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 ml-1">
        {task.type === 'correction_sprint'
          ? 'Correction Sprint — Repair Plan'
          : task.type === 'prescription'
          ? 'Tonight\'s Prescribed Plan'
          : 'What you should revise right now'}
      </div>

      <div
        className={`bg-white rounded-2xl border ${config.border} shadow-neo-sm overflow-hidden hover:shadow-neo transition-shadow`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.color} mb-0.5`}
                >
                  {task.type === 'correction_sprint' ? 'Repair' : config.badge}
                </span>
                <h3 className="text-base font-bold text-[#0A192F] leading-tight">{task.title}</h3>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#475569] leading-relaxed mb-4 pl-[52px]">{task.description}</p>

          <div className="flex items-center gap-3 pl-[52px] mb-4">
            {task.durationMin && (
              <span className="text-xs font-medium text-[#94A3B8] flex items-center gap-1">
                <Clock className="w-3 h-3" /> {task.durationMin} min
              </span>
            )}
            {task.subject && (
              <span className="text-xs font-medium text-[#94A3B8]">📚 {task.subject}</span>
            )}
          </div>

          {/* Implementation Intentions Preview */}
          {intentions.length > 0 && (
            <div className="pl-[52px] space-y-2 mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#6366F1] uppercase tracking-wider">
                <Lightbulb className="w-3 h-3" />
                If–Then Commitments
              </div>
              {intentions.slice(0, 2).map((intention, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-[#475569] bg-[#FAFBFF] border border-[#0A192F]/[0.04] rounded-lg px-3 py-2"
                >
                  <span className="text-[10px] font-bold text-[#6366F1] shrink-0 mt-0.5">IF</span>
                  <span className="leading-snug">
                    {intention.trigger}, <span className="font-semibold text-[#0A192F]">then</span> {intention.action}
                  </span>
                </div>
              ))}
              {intentions.length > 2 && (
                <div className="text-[10px] text-[#94A3B8] font-medium pl-1">+{intentions.length - 2} more commitments</div>
              )}
            </div>
          )}
        </div>

        {/* Dominant CTA */}
        <div className="px-5 pb-5 pl-[72px]">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="group relative w-full flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#1E293B] text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-neo transition-colors"
          >
            <span>{task.actionLabel}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            <div className="absolute inset-0 rounded-xl ring-2 ring-white/20" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
