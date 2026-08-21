import { Sparkles, Calendar, TrendingUp } from 'lucide-react';

export interface ForecastCardProps {
  courseCode: string;
  courseTitle: string;
  projectedLetter: string;
  lowPercent: number;
  highPercent: number;
  nextExamName: string;
  daysToExam: number;
  institutionName?: string;
}

export function ForecastCard({
  courseCode,
  courseTitle,
  projectedLetter,
  lowPercent,
  highPercent,
  nextExamName,
  daysToExam,
  institutionName = 'US College',
}: ForecastCardProps) {
  return (
    <div className="curve-root relative max-w-md mx-auto p-6 bg-[#0a0814] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden font-sans">
      <span
        aria-hidden="true"
        className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-[#8b5cf6]/25 blur-[60px]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-[#f59e0b]/15 blur-[60px]"
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#a78bfa]">
            {institutionName}
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {courseCode}
          </h2>
          <p className="text-xs text-white/60">{courseTitle}</p>
        </div>
        <div className="px-3 py-1 bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 rounded-full flex items-center gap-1.5 text-xs font-bold text-[#c4b5fd]">
          <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
          <span>Curve Forecast</span>
        </div>
      </div>

      {/* Main Grade Display */}
      <div className="relative z-10 my-6 text-center py-6 bg-gradient-to-b from-white/5 to-white/0 rounded-2xl border border-white/5">
        <div className="text-xs font-semibold text-white/50 mb-1">
          PROJECTED END-OF-SEMESTER GRADE
        </div>
        <div className="text-6xl font-extrabold text-white tracking-tight">
          {projectedLetter}
        </div>
        <div className="text-sm font-semibold text-[#a78bfa] mt-1">
          {lowPercent.toFixed(1)}% – {highPercent.toFixed(1)}% confidence band
        </div>
      </div>

      {/* Horizon Stats */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-white/60 mb-1">
            <Calendar className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>Next Target</span>
          </div>
          <div className="text-sm font-bold text-white truncate">{nextExamName}</div>
          <div className="text-xs text-[#a78bfa] font-semibold">{daysToExam} days remaining</div>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-white/60 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Standing Trend</span>
          </div>
          <div className="text-sm font-bold text-[#34d399]">+2.4% this week</div>
          <div className="text-xs text-white/50">3 actions completed</div>
        </div>
      </div>

      {/* Footer / Branding */}
      <div className="relative z-10 flex items-center justify-between text-xs text-white/40 pt-3 border-t border-white/10">
        <span>curve.app/m</span>
        <span>Know your grade early</span>
      </div>
    </div>
  );
}
