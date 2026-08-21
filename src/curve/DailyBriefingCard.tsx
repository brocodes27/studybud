import { useState } from 'react';
import { Volume2, Pause, Sparkles, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { CurveButton, Panel } from './ui';
import type { CourseSnapshot } from './data';

interface DailyBriefingCardProps {
  /** Real snapshot; when provided, card derives briefing from nextDue + projection. */
  snapshot?: CourseSnapshot | null;
  courseCode?: string;
  topic?: string;
  estimatedMinutes?: number;
  gradeLift?: string;
  onStartSession?: () => void;
}

/** "20 min on X" — pick the topic from the next due component's name. */
function topicFor(snapshot: CourseSnapshot | null | undefined): string {
  if (!snapshot) return 'your weakest topic';
  const next = snapshot.nextDue?.name;
  const weakestUngraded = snapshot.components
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)[0];
  return next ?? weakestUngraded?.name ?? snapshot.course.title;
}

/** "+0.35 GPA" placeholder becomes a real projection delta. */
function liftCopy(snapshot: CourseSnapshot | null | undefined): string {
  if (!snapshot) return '1 letter grade';
  const target = snapshot.projection.letter;
  const lowBand = snapshot.projection.lowLetter;
  const highBand = snapshot.projection.highLetter;
  if (lowBand === highBand) return `lock in your ${target}`;
  return `lift ${snapshot.projection.letter} → ${highBand}`;
}

function minutesFor(snapshot: CourseSnapshot | null | undefined): number {
  if (!snapshot) return 20;
  const pastDue = snapshot.nextDue && snapshot.nextDue.daysAway <= 3;
  return pastDue ? 30 : 20;
}

export function DailyBriefingCard({
  snapshot,
  courseCode,
  topic,
  estimatedMinutes,
  gradeLift,
  onStartSession,
}: DailyBriefingCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const code = snapshot?.course.courseCode ?? courseCode ?? '—';
  const topicText = snapshot ? topicFor(snapshot) : (topic ?? 'your weakest topic');
  const minutes = snapshot ? minutesFor(snapshot) : (estimatedMinutes ?? 20);
  const lift = snapshot ? liftCopy(snapshot) : (gradeLift ?? 'lock in your grade');
  const projectedLetter = snapshot?.projection.letter;

  const briefingScript = `Today, ${minutes} focused minutes on ${topicText} in ${code} moves the needle. ${
    projectedLetter
      ? `You are projected ${projectedLetter}. This action can ${lift}.`
      : `It will ${lift}.`
  }`;

  function toggleAudio() {
    if (isPlaying) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(briefingScript);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  }

  function toggleStep(idx: number) {
    setCompletedSteps((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  const steps = [
    { title: 'Prime the concept', desc: `Rapid-check ${topicText} against your notes` },
    { title: 'High-yield drills', desc: `${minutes}-min practice on exam-pattern problems` },
    { title: 'Confidence lock-in', desc: 'Self-explain one answer out loud' },
  ];

  return (
    <Panel className="relative overflow-hidden border-purple-500/30 bg-gradient-to-r from-[#140d2b] via-[#1a1238] to-[#0f0a21] p-5 sm:p-6 shadow-xl">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="curve-eyebrow text-purple-300">Daily Cognitive Audio & Visual Briefing</p>
              <h3 className="text-sm font-bold text-white">Highest-Leverage Action Today</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAudio}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-400 text-black animate-pulse'
                : 'bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Playing Briefing...
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-amber-400" /> Listen
              </>
            )}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-500/30 px-2 py-0.5 text-[11px] font-black text-purple-200">
                {code}
              </span>
              <span className="flex items-center gap-1 text-xs text-curve-muted">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> {minutes} mins
              </span>
            </div>
            <h4 className="mt-1 text-base font-extrabold text-white sm:text-lg">
              {topicText}
            </h4>
            <p className="mt-1.5 text-xs text-curve-muted leading-relaxed">
              {projectedLetter
                ? `Current projection: ${projectedLetter}. This drill targets the concept your exam will hit hardest.`
                : "Curve's engine flags this concept as your highest-leverage repair today."}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-3.5 border border-white/10 lg:col-span-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-curve-faint">
                Today's effect
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-0.5">
                {lift}
              </div>
              <span className="text-[10px] text-purple-200">Top action by minutes-to-impact</span>
            </div>
            {onStartSession && (
              <CurveButton onClick={onStartSession} className="!px-4 !py-2 !text-xs">
                Start
                <ArrowRight className="h-3.5 w-3.5" />
              </CurveButton>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {steps.map((s, idx) => {
            const isDone = completedSteps.includes(idx);
            return (
              <div
                key={idx}
                onClick={() => toggleStep(idx)}
                className={`cursor-pointer rounded-xl p-2.5 transition-all border text-xs ${
                  isDone
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-white'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-curve-faint">0{idx + 1}.</span> {s.title}
                  </span>
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${isDone ? 'text-emerald-400' : 'text-white/20'}`}
                  />
                </div>
                <p className="mt-1 text-[11px] text-curve-muted truncate">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export default DailyBriefingCard;
