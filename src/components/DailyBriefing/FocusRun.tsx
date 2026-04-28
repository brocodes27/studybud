import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, HelpCircle, AlertTriangle, ArrowDown, MessageSquare, X, CheckCircle2, Coffee, Phone, EyeOff, ChevronRight } from 'lucide-react';

export interface SessionStep { label: string; durationMin?: number; }

interface PauseEvent { reason: string; timestampSec: number; }

interface StuckEvent { timestampSec: number; interventionType: 'hint' | 'easier' | 'explain'; resolved: boolean; }

interface FocusRunProps {
  steps: SessionStep[];
  totalMinutes: number;
  onComplete: (data: { elapsedSec: number; pauseEvents: PauseEvent[]; stuckEvents: StuckEvent[]; finalStepIndex: number; }) => void;
  onAbandon: () => void;
}

const PAUSE_REASONS = [
  { key: 'bathroom', label: 'Bathroom', icon: Coffee },
  { key: 'parent_call', label: 'Parent call', icon: Phone },
  { key: 'confused', label: 'Confused', icon: HelpCircle },
  { key: 'need_hint', label: 'Need a hint', icon: HelpCircle },
  { key: 'distraction', label: 'Got distracted', icon: EyeOff },
  { key: 'other', label: 'Other', icon: AlertTriangle },
];

const STUCK_OPTIONS = [
  { key: 'hint' as const, label: 'Show me one hint', desc: 'A small nudge to get unstuck', icon: HelpCircle },
  { key: 'easier' as const, label: 'Make it easier', desc: 'Switch to a simpler version', icon: ArrowDown },
  { key: 'explain' as const, label: 'Explain what I know', desc: '2-min self-explain step', icon: MessageSquare },
];

export function FocusRun({ steps, totalMinutes, onComplete, onAbandon }: FocusRunProps) {
  const totalSec = totalMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pauseEvents, setPauseEvents] = useState<PauseEvent[]>([]);
  const [stuckEvents, setStuckEvents] = useState<StuckEvent[]>([]);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showStuckMenu, setShowStuckMenu] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [stuckResolved, setStuckResolved] = useState<StuckEvent | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const tick = useCallback(() => {
    setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    elapsedRef.current += 1;
  }, []);

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeLeft === 0 && running) {
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      onComplete({ elapsedSec: elapsedRef.current, pauseEvents, stuckEvents, finalStepIndex: currentStep });
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, timeLeft, tick, onComplete, pauseEvents, stuckEvents, currentStep]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePause = (reason: string) => {
    setRunning(false);
    setShowPauseMenu(false);
    setPauseEvents((prev) => [...prev, { reason, timestampSec: elapsedRef.current }]);
  };

  const handleResume = () => {
    setRunning(true);
    setShowPauseMenu(false);
  };

  const handleStuck = (type: 'hint' | 'easier' | 'explain') => {
    const event: StuckEvent = { timestampSec: elapsedRef.current, interventionType: type, resolved: false };
    setStuckEvents((prev) => [...prev, event]);
    setStuckResolved(event);
    setShowStuckMenu(false);
  };

  const resolveStuck = () => {
    if (stuckResolved) {
      setStuckEvents((prev) => prev.map((e) => (e === stuckResolved ? { ...e, resolved: true } : e)));
      setStuckResolved(null);
    }
  };

  const progress = ((totalSec - timeLeft) / totalSec) * 100;
  const stepProgress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Timer */}
      <div className="bg-white rounded-[24px] border border-[#2D2A26]/[0.06] p-6 shadow-[0_4px_16px_rgba(45,42,38,0.06)]">
        <div className="text-center mb-5">
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#F5F0E8" strokeWidth="6" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#8B7355" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold text-[#2D2A26] tabular-nums tracking-tight">{formatTime(timeLeft)}</span>
              <span className="text-[10px] font-bold text-[#8A8279] uppercase tracking-wider mt-0.5">
                {running ? 'Running' : timeLeft === totalSec ? 'Ready' : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <div className="flex justify-between text-[10px] font-bold text-[#8A8279] uppercase tracking-wider mb-1">
              <span>Time</span><span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
              <div className="h-full bg-[#8B7355] rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {steps.length > 0 && (
            <div>
              <div className="flex justify-between text-[10px] font-bold text-[#8A8279] uppercase tracking-wider mb-1">
                <span>Steps</span><span>Step {currentStep + 1}/{steps.length}</span>
              </div>
              <div className="h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
                <div className="h-full bg-[#6B8E6B] rounded-full transition-all" style={{ width: `${stepProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {!running ? (
            <button onClick={handleResume} className="flex items-center gap-2 px-5 py-2.5 bg-[#2D2A26] hover:bg-[#3D3833] text-white text-sm font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(45,42,38,0.12)]">
              <Play className="w-4 h-4 fill-white" /> {timeLeft === totalSec ? 'Start' : 'Resume'}
            </button>
          ) : (
            <button onClick={() => setShowPauseMenu(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#F5F0E8] hover:bg-[#E8E2D9] text-[#2D2A26] text-sm font-bold rounded-xl transition-all border border-[#2D2A26]/[0.08]">
              <Pause className="w-4 h-4 fill-current" /> Pause
            </button>
          )}
          <button onClick={() => setShowStuckMenu(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#B87B6B]/10 hover:bg-[#B87B6B]/20 text-[#B87B6B] text-sm font-bold rounded-xl transition-all border border-[#B87B6B]/20">
            <AlertTriangle className="w-4 h-4" /> I&apos;m Stuck
          </button>
          <button onClick={() => setShowHelpOverlay(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#7A6B8A]/10 hover:bg-[#7A6B8A]/20 text-[#7A6B8A] text-sm font-bold rounded-xl transition-all border border-[#7A6B8A]/20">
            <HelpCircle className="w-4 h-4" /> Help
          </button>
          <button
            onClick={() => {
              setRunning(false);
              if (intervalRef.current) clearInterval(intervalRef.current);
              onComplete({ elapsedSec: elapsedRef.current, pauseEvents, stuckEvents, finalStepIndex: currentStep });
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#6B8E6B]/10 hover:bg-[#6B8E6B]/20 text-[#6B8E6B] text-sm font-bold rounded-xl transition-all border border-[#6B8E6B]/20"
          >
            <CheckCircle2 className="w-4 h-4" /> Mark Done
          </button>
        </div>

        {/* Step navigation */}
        {steps.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            <button onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} disabled={currentStep === 0} className="px-3 py-1.5 text-xs font-bold text-[#8A8279] hover:text-[#2D2A26] disabled:opacity-30 transition-all rounded-lg border border-[#2D2A26]/[0.06]">
              Prev
            </button>
            <div className="flex-1 text-center text-xs font-medium text-[#8A8279]">
              <span className="text-[#2D2A26] font-bold">{steps[currentStep]?.label}</span>
              {steps[currentStep]?.durationMin && <span className="ml-1">({steps[currentStep].durationMin}m)</span>}
            </div>
            <button onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))} disabled={currentStep === steps.length - 1} className="px-3 py-1.5 text-xs font-bold text-[#8A8279] hover:text-[#2D2A26] disabled:opacity-30 transition-all rounded-lg border border-[#2D2A26]/[0.06]">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Pause Menu */}
      <AnimatePresence>
        {showPauseMenu && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-[#F5F0E8] rounded-[20px] border border-[#2D2A26]/[0.06] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#2D2A26]">Pause — why?</h4>
              <button onClick={() => setShowPauseMenu(false)} className="p-1 hover:bg-white rounded-lg transition-colors"><X className="w-4 h-4 text-[#8A8279]" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAUSE_REASONS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => handlePause(label)} className="flex items-center gap-2 p-3 bg-white rounded-xl text-left text-xs font-medium text-[#2D2A26] hover:bg-[#8B7355]/10 transition-all border border-transparent hover:border-[#8B7355]/20">
                  <Icon className="w-4 h-4 text-[#8B7355] shrink-0" /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setRunning(false); onAbandon(); }}
              className="w-full py-2.5 text-xs font-bold text-[#B87B6B] hover:text-[#A86B5B] hover:bg-[#B87B6B]/5 rounded-xl transition-all border border-[#B87B6B]/10"
            >
              End Session
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stuck Menu */}
      <AnimatePresence>
        {showStuckMenu && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-white rounded-[20px] border border-[#B87B6B]/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B87B6B]" />
                <h4 className="text-sm font-bold text-[#2D2A26]">You&apos;re stuck — let&apos;s fix that</h4>
              </div>
              <button onClick={() => setShowStuckMenu(false)} className="p-1 hover:bg-[#F5F0E8] rounded-lg transition-colors"><X className="w-4 h-4 text-[#8A8279]" /></button>
            </div>
            <div className="space-y-2">
              {STUCK_OPTIONS.map(({ key, label, desc, icon: Icon }) => (
                <button key={key} onClick={() => handleStuck(key)} className="w-full flex items-center gap-3 p-3 bg-[#F5F0E8] hover:bg-[#E8E2D9] rounded-xl text-left transition-all border border-transparent hover:border-[#8B7355]/20">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                    <Icon className="w-4 h-4 text-[#8B7355]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2D2A26]">{label}</p>
                    <p className="text-[11px] text-[#8A8279]">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8A8279] ml-auto" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stuck Resolved Overlay */}
      <AnimatePresence>
        {stuckResolved && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#F5F0E8] rounded-[20px] border border-[#6B8E6B]/20 p-5 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#6B8E6B]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5 text-[#6B8E6B]" />
            </div>
            <p className="text-sm font-bold text-[#2D2A26]">Intervention active</p>
            <p className="text-xs text-[#8A8279]">
              {stuckResolved.interventionType === 'hint' && 'Here is a hint to get you moving again.'}
              {stuckResolved.interventionType === 'easier' && 'Try this simpler version first, then come back.'}
              {stuckResolved.interventionType === 'explain' && 'Take 2 minutes to explain what you understand out loud or in text.'}
            </p>
            <button onClick={resolveStuck} className="px-5 py-2 bg-[#2D2A26] hover:bg-[#3D3833] text-white text-xs font-bold rounded-xl transition-all">
              Back to Focus
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelpOverlay && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-white rounded-[20px] border border-[#7A6B8A]/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#2D2A26]">Quick Help</h4>
              <button onClick={() => setShowHelpOverlay(false)} className="p-1 hover:bg-[#F5F0E8] rounded-lg transition-colors"><X className="w-4 h-4 text-[#8A8279]" /></button>
            </div>
            <div className="space-y-2 text-xs text-[#8A8279] leading-relaxed">
              <p className="flex gap-2"><span className="font-bold text-[#2D2A26] shrink-0">1.</span> Read the current step carefully before starting.</p>
              <p className="flex gap-2"><span className="font-bold text-[#2D2A26] shrink-0">2.</span> If stuck, use &quot;I&apos;m Stuck&quot; for a hint or easier version.</p>
              <p className="flex gap-2"><span className="font-bold text-[#2D2A26] shrink-0">3.</span> Use Pause with a reason if you need to step away.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
