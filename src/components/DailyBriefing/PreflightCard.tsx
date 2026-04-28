import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket,
  ListChecks,
  Target,
  Backpack,
  Play,
  X,
  Clock,
  ChevronRight,
  AlertCircle,
  BatteryWarning,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

interface SessionStep {
  label: string;
  durationMin?: number;
}

interface PreflightCardProps {
  goal: string;
  steps: SessionStep[];
  successCriteria: string;
  materials?: string[];
  estimatedMin?: number;
  onStart: () => void;
  onNotReady: (reason: string) => void;
}

const NOT_READY_REASONS = [
  { key: 'confused', label: 'Confused about what to do', icon: HelpCircle },
  { key: 'tired', label: 'Too tired right now', icon: BatteryWarning },
  { key: 'no_time', label: 'Not enough time', icon: Clock },
  { key: 'missing_materials', label: 'Missing notebook / materials', icon: BookOpen },
  { key: 'other', label: 'Something else', icon: AlertCircle },
];

export function PreflightCard({
  goal,
  steps,
  successCriteria,
  materials,
  estimatedMin,
  onStart,
  onNotReady,
}: PreflightCardProps) {
  const [showNotReady, setShowNotReady] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');

  const handleNotReadySubmit = () => {
    const fullReason = selectedReason
      ? `${selectedReason}${reasonNote ? ': ' + reasonNote : ''}`
      : reasonNote;
    onNotReady(fullReason);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Goal */}
      <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="w-4 h-4 text-[#8B7355]" />
          <span className="text-[10px] font-bold text-[#8B7355] uppercase tracking-wider">
            Session Goal
          </span>
        </div>
        <p className="text-sm font-medium text-[#2D2A26] leading-relaxed">
          {goal}
        </p>
        {estimatedMin && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#8A8279] font-medium">
            <Clock className="w-3 h-3" />
            <span>~{estimatedMin} min</span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)]">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-[#6B8E6B]" />
          <span className="text-[10px] font-bold text-[#6B8E6B] uppercase tracking-wider">
            What You Will Do
          </span>
        </div>
        <div className="space-y-2.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-[#F5F0E8] border border-[#2D2A26]/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-[#8B7355]">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#2D2A26]">{step.label}</p>
                {step.durationMin && (
                  <span className="text-[10px] text-[#8A8279] font-medium">
                    {step.durationMin} min
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success Criteria */}
      <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-[#B87B6B]" />
          <span className="text-[10px] font-bold text-[#B87B6B] uppercase tracking-wider">
            Success Criteria
          </span>
        </div>
        <p className="text-sm font-medium text-[#2D2A26] leading-relaxed">
          {successCriteria}
        </p>
      </div>

      {/* Materials Check */}
      {materials && materials.length > 0 && (
        <div className="bg-white rounded-[20px] border border-[#2D2A26]/[0.06] p-5 shadow-[0_2px_8px_rgba(45,42,38,0.04)]">
          <div className="flex items-center gap-2 mb-3">
            <Backpack className="w-4 h-4 text-[#7A6B8A]" />
            <span className="text-[10px] font-bold text-[#7A6B8A] uppercase tracking-wider">
              Materials Check
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {materials.map((m, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-[#F5F0E8] rounded-full text-xs font-medium text-[#3D3833] border border-[#2D2A26]/[0.04]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buttons */}
      {!showNotReady ? (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => setShowNotReady(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl border-2 border-[#2D2A26]/10 text-sm font-bold text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-all"
          >
            <X className="w-4 h-4" />
            Not Ready
          </button>
          <button
            onClick={onStart}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-[#2D2A26] hover:bg-[#3D3833] text-white text-sm font-bold transition-all shadow-[0_4px_16px_rgba(45,42,38,0.12)] hover:shadow-[0_8px_24px_rgba(45,42,38,0.16)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Focus Run
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[#F5F0E8] rounded-[20px] border border-[#2D2A26]/[0.06] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#2D2A26]">Why aren&apos;t you ready?</h4>
            <button
              onClick={() => { setShowNotReady(false); setSelectedReason(''); setReasonNote(''); }}
              className="p-1 hover:bg-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-[#8A8279]" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NOT_READY_REASONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedReason(key)}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-left text-xs font-medium transition-all border ${
                  selectedReason === key
                    ? 'bg-white border-[#8B7355]/30 shadow-sm'
                    : 'bg-white/60 border-transparent hover:bg-white'
                }`}
              >
                <Icon className="w-4 h-4 text-[#8B7355] shrink-0" />
                <span className="text-[#2D2A26]">{label}</span>
              </button>
            ))}
          </div>

          <textarea
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="Anything else? (optional)"
            rows={2}
            className="w-full px-3 py-2.5 bg-white rounded-xl border border-[#2D2A26]/[0.08] text-sm text-[#2D2A26] placeholder:text-[#8A8279]/60 focus:outline-none focus:border-[#8B7355]/40 resize-none"
          />

          <button
            onClick={handleNotReadySubmit}
            disabled={!selectedReason && !reasonNote}
            className="w-full py-3 rounded-xl bg-[#B87B6B] hover:bg-[#A86B5B] disabled:opacity-40 text-white text-sm font-bold transition-all"
          >
            Send Feedback
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
