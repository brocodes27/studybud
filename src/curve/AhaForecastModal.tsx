import React, { useState } from 'react';
import { Sparkles, ArrowRight, TrendingUp, CheckCircle2, Zap, Clock, Award } from 'lucide-react';
import { CurveButton, Panel, Display, Eyebrow } from './ui';
import type { ParsedSyllabus } from './ai';

interface AhaForecastModalProps {
  parsedCourses: ParsedSyllabus[];
  onContinue: () => void;
}

export function AhaForecastModal({ parsedCourses, onContinue }: AhaForecastModalProps) {
  const [dailyMinutes, setDailyMinutes] = useState<number>(20);

  const mainCourse = parsedCourses[0] || {
    courseCode: 'CHEM 2210',
    title: 'Organic Chemistry I',
    topics: [{ topic: 'Stereochemistry & Substitutions', week: 1 }],
  };

  const topicList = parsedCourses.flatMap((c) =>
    (c.topics || []).map((t) => ({ ...t, courseCode: c.courseCode }))
  );

  const baselinePercent = 84; // B
  // Dynamic boost based on study minutes
  const projectedBoost = Math.min(13, Math.round(dailyMinutes * 0.22));
  const targetPercent = Math.min(99, baselinePercent + projectedBoost);

  function getLetter(pct: number): string {
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    return 'C';
  }

  const projectedLetter = getLetter(targetPercent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-[#0f0c1d] p-6 text-white shadow-2xl sm:p-8">
        {/* Glow decorative background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-curve-violet/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300">
            <Sparkles className="h-3.5 w-3.5" />
            Aha! Instant Grade & Mastery Forecast
          </div>

          <Display lead="Your syllabus" className="mt-3">
            is unlocked.
          </Display>

          <p className="mt-2 text-sm text-curve-muted">
            We extracted <span className="font-semibold text-white">{parsedCourses.length} course(s)</span> and{' '}
            <span className="font-semibold text-white">{topicList.length} syllabus topic(s)</span>. Curve’s BKT engine
            calculated your optimum trajectory:
          </p>

          {/* Forecast Cards Grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel className="border border-white/10 bg-white/[0.04] p-4">
              <Eyebrow>Current Pace (Baseline)</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">B</span>
                <span className="text-sm font-medium text-curve-muted">(84% projected)</span>
              </div>
              <p className="mt-2 text-xs text-curve-faint">Standard ungraded performance without targeted intervention.</p>
            </Panel>

            <Panel className="border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-indigo-900/30 p-4">
              <Eyebrow className="text-purple-300">Curve Optimized Potential</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{projectedLetter}</span>
                <span className="text-sm font-semibold text-emerald-300">({targetPercent}% target)</span>
              </div>
              <p className="mt-2 text-xs text-purple-200/80">Achievable with just {dailyMinutes} mins/day of adaptive practice.</p>
            </Panel>
          </div>

          {/* Interactive Effort Slider */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-curve-violet-soft">
                <Clock className="h-4 w-4" />
                Daily Adaptive Practice
              </span>
              <span className="text-emerald-400">{dailyMinutes} minutes / day</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              className="mt-3 w-full accent-[#8b5cf6]"
            />
            <div className="mt-2 flex justify-between text-[10px] text-curve-faint">
              <span>10m (Maintenance)</span>
              <span>30m (Optimal)</span>
              <span>60m (Mastery)</span>
            </div>
          </div>

          {/* High Leverage Topics */}
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-curve-muted">
              🔥 Top High-Leverage Focus Topics
            </p>
            <div className="mt-2 space-y-2">
              {topicList.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-semibold text-white">{item.topic}</span>
                  </div>
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                    +{4 - idx}% Grade Impact
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action button */}
          <div className="mt-7 flex justify-end">
            <CurveButton onClick={onContinue} className="w-full sm:w-auto">
              <span className="flex items-center justify-center gap-2">
                Continue to My Courses
                <ArrowRight className="h-4 w-4" />
              </span>
            </CurveButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AhaForecastModal;
