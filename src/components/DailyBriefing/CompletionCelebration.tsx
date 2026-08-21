import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Sparkles, ArrowRight, Star, Zap, Flame, Trophy,
  Calendar, Target, Award, Share2, Check, ShieldCheck, Heart, RefreshCw, BookmarkCheck
} from 'lucide-react';

interface CompletionCelebrationProps {
  onContinue: () => void;
  xpEarned?: number;
  levelUp?: boolean;
  newLevel?: number;
  streakCount?: number;
}

const MOTIVATIONAL_QUOTES = [
  {
    quote: "Consistency is not about perfection. It's about refusing to give up on the days that feel heavy.",
    author: "Ranjan Sir",
    role: "Senior Mentor",
  },
  {
    quote: "You didn't just complete today's tasks — you built another brick in your foundation for success.",
    author: "Atlas AI",
    role: "Learner Model",
  },
  {
    quote: "Every single daily session compounds. The student you become tomorrow is built by the effort you put in today.",
    author: "StudyBud Guide",
    role: "Academic Coach",
  },
];

export function CompletionCelebration({
  onContinue,
  xpEarned = 150,
  levelUp = false,
  newLevel = 3,
  streakCount = 5,
}: CompletionCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'rewards' | 'tomorrow'>('rewards');
  const [selectedQuote] = useState(() => 
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );

  useEffect(() => {
    const particles = Array.from({ length: 30 }, (_, i) => i);
    setShowConfetti(particles);
  }, []);

  const handleShare = () => {
    const text = `🔥 I just completed 100% of my daily study missions on StudyBud! Maintaining a ${streakCount}-day streak! 🎓✨`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 7-day habit week sample data
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const completedDays = [true, true, true, true, true, false, false];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center justify-center min-h-[75vh] px-4 py-8 max-w-2xl mx-auto"
    >
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <AnimatePresence>
          {showConfetti.map((i) => (
            <motion.div
              key={i}
              initial={{
                x: `${Math.random() * 100 - 50}vw`,
                y: -20,
                opacity: 1,
                scale: 0,
              }}
              animate={{
                y: '100vh',
                opacity: 0,
                scale: Math.random() * 0.8 + 0.5,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 2.5 + Math.random() * 2,
                delay: Math.random() * 0.6,
                ease: 'easeOut',
              }}
              className="absolute top-0 left-1/2 rounded-sm"
              style={{
                width: i % 3 === 0 ? '10px' : '6px',
                height: i % 3 === 0 ? '10px' : '6px',
                backgroundColor: ['#8B7355', '#C4A484', '#6B8E6B', '#B8956A', '#D4AF37', '#E5A93C'][i % 6],
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Main Celebration Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative z-10 w-full bg-white border-2 border-[#2D2A26] rounded-3xl p-6 md:p-8 shadow-[8px_8px_0px_0px_#2D2A26] text-center"
      >
        {/* Top Badge Icon */}
        <div className="relative inline-block mb-4">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.15 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6B8E6B] to-[#4A6B4A] text-white flex items-center justify-center shadow-md mx-auto border-2 border-[#2D2A26]"
          >
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="absolute -top-2 -right-2 bg-amber-400 text-[#2D2A26] border border-[#2D2A26] p-1.5 rounded-full shadow-sm"
          >
            <Sparkles className="w-4 h-4 fill-current" />
          </motion.div>
        </div>

        {/* Appreciation Header */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF5EE] border border-[#8B7355]/30 rounded-full text-xs font-bold text-[#8B7355] uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-600" /> Daily Target Reached
          </span>
          <h2
            className="text-2xl md:text-3xl font-extrabold text-[#2D2A26] tracking-tight mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Outstanding Dedication Today!
          </h2>
          <p className="text-[#8A8279] font-medium text-sm max-w-md mx-auto mb-6">
            You completed all of today's study prescriptions. Your persistence is keeping your mastery on track!
          </p>
        </motion.div>

        {/* Mentor Appreciation Quote */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-4 mb-6 text-left relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8B7355]" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#8B7355] text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-sm">
              RS
            </div>
            <div>
              <p className="text-xs italic font-medium text-[#2D2A26] leading-relaxed">
                &ldquo;{selectedQuote.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold text-[#8B7355]">{selectedQuote.author}</span>
                <span className="text-[10px] text-[#B5AEA5]">· {selectedQuote.role}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Gamification / Rewards & Streak Grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          {/* Streak Box */}
          <div className="bg-[#FFFDF9] border-2 border-[#2D2A26]/10 rounded-2xl p-3.5 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-amber-600 font-extrabold text-lg mb-0.5">
              <Flame className="w-5 h-5 fill-amber-500 text-amber-600 animate-bounce" />
              <span>{streakCount} Day Streak</span>
            </div>
            <span className="text-[11px] font-semibold text-[#8A8279]">Streak Protected 🔥</span>
            <div className="mt-2 flex items-center gap-1">
              {weekDays.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <span className="text-[9px] font-bold text-[#B5AEA5]">{day}</span>
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5 ${
                      completedDays[idx]
                        ? 'bg-[#6B8E6B] text-white'
                        : 'bg-[#F5F0E8] text-[#B5AEA5]'
                    }`}
                  >
                    {completedDays[idx] ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* XP & Level Box */}
          <div className="bg-[#FFFDF9] border-2 border-[#2D2A26]/10 rounded-2xl p-3.5 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-[#8B7355] font-extrabold text-lg mb-0.5">
              <Zap className="w-5 h-5 fill-[#B8956A] text-[#8B7355]" />
              <span>+{xpEarned} XP</span>
            </div>
            <span className="text-[11px] font-bold text-[#2D2A26]">
              {levelUp ? `🎉 Level Up: Lv.${newLevel}` : 'Daily Completion Bonus'}
            </span>
            <div className="w-full bg-[#F5F0E8] h-2 rounded-full mt-3 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '85%' }}
                transition={{ duration: 1, delay: 0.6 }}
                className="h-full bg-[#8B7355] rounded-full"
              />
            </div>
            <span className="text-[9px] font-semibold text-[#8A8279] mt-1">
              85 XP to next milestone
            </span>
          </div>
        </motion.div>

        {/* Tab switcher: Why come back tomorrow */}
        <div className="bg-[#FAF8F5] border border-[#E8E2D9] rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between border-b border-[#E8E2D9] pb-2.5 mb-3">
            <span className="text-xs font-bold text-[#2D2A26] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#8B7355]" />
              What's waiting for you tomorrow?
            </span>
            <span className="text-[10px] font-extrabold text-[#6B8E6B] bg-[#6B8E6B]/10 px-2 py-0.5 rounded-full">
              Streak Unlocks +100 XP
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2.5 text-xs text-[#5D5A56]">
              <div className="w-5 h-5 rounded-full bg-[#8B7355]/10 text-[#8B7355] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                1
              </div>
              <div>
                <span className="font-bold text-[#2D2A26]">Fresh Daily Prescription:</span> Atlas AI will curate tailored practice problems based on today's performance.
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-[#5D5A56]">
              <div className="w-5 h-5 rounded-full bg-[#8B7355]/10 text-[#8B7355] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                2
              </div>
              <div>
                <span className="font-bold text-[#2D2A26]">Streak Shield Multiplier:</span> Log in tomorrow to keep your {streakCount + 1}-day streak alive!
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onContinue}
            className="w-full flex-1 flex items-center justify-center gap-2 bg-[#2D2A26] hover:bg-[#3D3833] text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Explore Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShare}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-[#FAF8F5] border border-[#2D2A26]/20 text-[#2D2A26] font-bold text-sm py-3.5 px-5 rounded-xl transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#6B8E6B]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-[#8B7355]" />
                <span>Share Streak</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

