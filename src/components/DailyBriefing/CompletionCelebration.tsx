import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, ArrowRight, Star, Zap } from 'lucide-react';

interface CompletionCelebrationProps {
  onContinue: () => void;
  xpEarned?: number;
  levelUp?: boolean;
  newLevel?: number;
}

export function CompletionCelebration({ onContinue, xpEarned, levelUp, newLevel }: CompletionCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState<number[]>([]);

  useEffect(() => {
    const particles = Array.from({ length: 20 }, (_, i) => i);
    setShowConfetti(particles);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center justify-center min-h-[60vh] px-4"
    >
      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
                scale: 1,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut',
              }}
              className="absolute top-0 left-1/2 w-2 h-2 rounded-sm"
              style={{
                backgroundColor: ['#8B7355', '#C4A484', '#6B8E6B', '#B8956A', '#7A6B8A'][i % 5],
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative z-10"
      >
        <div className="w-20 h-20 rounded-full bg-[#6B8E6B] flex items-center justify-center shadow-lg mb-6">
          <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl md:text-3xl font-semibold text-[#2D2A26] tracking-tight mb-2 text-center relative z-10"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        Task Complete!
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-[#8A8279] font-medium text-sm text-center mb-6 relative z-10"
      >
        Great work. You've earned it — now go explore everything StudyBud has to offer.
      </motion.p>

      {/* XP + Level Up Badge */}
      <AnimatePresence>
        {(xpEarned || levelUp) && (
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            className="flex items-center gap-3 mb-8 relative z-10"
          >
            {xpEarned ? (
              <div className="flex items-center gap-2 bg-[#F5F0E8] border border-[#E8E2D9] rounded-xl px-4 py-2.5">
                <Zap className="w-4 h-4 text-[#B8956A]" />
                <span className="text-sm font-bold text-[#8B7355]">+{xpEarned} XP</span>
              </div>
            ) : null}
            {levelUp && newLevel ? (
              <div className="flex items-center gap-2 bg-[#F5F0E8] border border-[#E8E2D9] rounded-xl px-4 py-2.5">
                <Star className="w-4 h-4 text-[#B8956A]" />
                <span className="text-sm font-bold text-[#8B7355]">Level Up! Lv.{newLevel}</span>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.65 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onContinue}
        className="group relative z-10 flex items-center gap-2 bg-[#2D2A26] hover:bg-[#3D3833] text-white font-bold text-sm py-3.5 px-8 rounded-xl shadow-md transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        <span>Explore Platform</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </motion.button>
    </motion.div>
  );
}
