import { motion } from 'framer-motion';
import { Brain, Flame, Gauge, Moon, Target, TrendingUp, Zap, Activity, Sparkles } from 'lucide-react';
import type { DailyBriefingData } from '../../lib/dailyBriefing';
import { useMLIntelligence } from '../../hooks/useMLIntelligence';

interface LearnerModelCardProps {
  data: DailyBriefingData;
}

function getLoadSignal(data: DailyBriefingData) {
  if (data.studentState.backlogCount >= 4 || data.studentState.missedDaysStreak >= 2) {
    return { label: 'Recovery Mode', tone: 'text-amber-700 bg-amber-50 border-amber-200', detail: 'Keep the plan realistic and rebuild consistency first.' };
  }
  if (data.completedCount >= Math.max(1, Math.floor(data.totalCount / 2))) {
    return { label: 'Momentum Building', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', detail: 'The system can safely get a little more ambitious tomorrow.' };
  }
  return { label: 'Steady Build', tone: 'text-sky-700 bg-sky-50 border-sky-200', detail: 'Today is about protecting focus and making the next rep count.' };
}

export function LearnerModelCard({ data }: LearnerModelCardProps) {
  const loadSignal = getLoadSignal(data);
  const weakSubjects = data.studentState.weakSubjects.slice(0, 3);
  const ml = useMLIntelligence();

  const tierConfig = {
    anoetic: { label: 'Anoetic', color: '#F472B6', desc: 'Needs guided practice', icon: Brain },
    noetic: { label: 'Noetic', color: '#00D1FF', desc: 'Building understanding', icon: Activity },
    autonoetic: { label: 'Autonoetic', color: '#34D399', desc: 'Independent mastery', icon: Sparkles },
  };
  const tier = ml.dominantTier as keyof typeof tierConfig;
  const tierInfo = tierConfig[tier] ?? tierConfig.anoetic;
  const TierIcon = tierInfo.icon;

  const traits = [
    {
      icon: Target,
      label: 'Preferred Window',
      value: data.studentState.preferredTime || 'evening',
    },
    {
      icon: Gauge,
      label: 'Best Session Length',
      value: `${data.studentState.typicalSessionDuration || 90} min`,
    },
    {
      icon: Flame,
      label: 'Backlog Pressure',
      value: data.studentState.backlogCount > 0 ? `${data.studentState.backlogCount} pending signals` : 'Under control',
    },
    {
      icon: Moon,
      label: 'Consistency Risk',
      value: data.studentState.missedDaysStreak > 0 ? `${data.studentState.missedDaysStreak} missed day streak` : 'Stable',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.45 }}
      className="w-full max-w-xl"
    >
      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 ml-1">
        Your Live Learner Model
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-neo-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF6FF] flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2D2A26]">Ranjan Sir is adapting to you</h3>
              <p className="text-xs text-[#8A8279]">This model updates from your completions, uploads, and study rhythm.</p>
            </div>
          </div>
          <div className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold ${loadSignal.tone}`}>
            {loadSignal.label}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {traits.map((trait) => (
            <div key={trait.label} className="rounded-xl bg-[#FAF8F5] border border-[#F0EAE0] p-3">
              <div className="flex items-center gap-2 mb-1">
                <trait.icon className="w-3.5 h-3.5 text-[#8B7355]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A79F96]">{trait.label}</span>
              </div>
              <p className="text-xs font-semibold text-[#2D2A26]">{trait.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#E8E2D9] bg-[#FCFBF8] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#8B7355]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8279]">What the system believes right now</span>
          </div>
          <p className="text-xs text-[#5D5A56] leading-relaxed">{loadSignal.detail}</p>
          <p className="text-xs text-[#5D5A56] leading-relaxed mt-2">
            {weakSubjects.length > 0
              ? `Current weak subjects: ${weakSubjects.join(', ')}. These should get more deliberate revision and tighter follow-up.`
              : 'No major weak subjects have been isolated yet. More work samples will make the model sharper.'}
          </p>
        </div>

        {/* ML Intelligence Section */}
        {(ml.cognitiveProfiles.length > 0 || ml.velocityTier !== 'unknown') && (
          <div className="mt-3 rounded-xl border border-[#34D399]/20 bg-[#34D399]/5 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-[#34D399]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#34D399]">ML Intelligence Active</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Cognitive tier */}
              <div className="flex items-center gap-1.5">
                <TierIcon className="w-3.5 h-3.5" style={{ color: tierInfo.color }} />
                <span className="text-xs font-bold" style={{ color: tierInfo.color }}>{tierInfo.label}</span>
                <span className="text-[10px] text-[#8A8279]">{tierInfo.desc}</span>
              </div>
              {/* Velocity */}
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="text-xs font-semibold text-[#5D5A56] capitalize">{ml.velocityTier} pace</span>
              </div>
              {/* avg mastery */}
              {ml.avgMastery > 0 && (
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#00D1FF]" />
                  <span className="text-xs font-semibold text-[#5D5A56]">{(ml.avgMastery * 100).toFixed(0)}% avg mastery</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#8A8279]">BKT mastery tracking · IRT adaptive question selection · Daily behavioral adaptation</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
