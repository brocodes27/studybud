import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserGamification, calculateLevel, getXpToNextLevel, LEVELS } from '../../lib/gamification';

interface XPCounterProps {
    compact?: boolean;
    showLevel?: boolean;
}

export function XPCounter({ compact = false, showLevel = true }: XPCounterProps) {
    const { user } = useAuth() as any;
    const [totalXp, setTotalXp] = useState(0);
    const [animatingXp, setAnimatingXp] = useState<number | null>(null);

    useEffect(() => {
        if (user?.id) {
            loadXp();
        }
    }, [user?.id]);

    const loadXp = async () => {
        const gamification = await getUserGamification(user.id);
        if (gamification) {
            const prevTotal = totalXp;
            setTotalXp(gamification.total_xp);

            // Animate if XP increased
            if (gamification.total_xp > prevTotal && prevTotal > 0) {
                setAnimatingXp(gamification.total_xp - prevTotal);
                setTimeout(() => setAnimatingXp(null), 2000);
            }
        }
    };

    const levelInfo = calculateLevel(totalXp);
    const xpToNext = getXpToNextLevel(totalXp);
    const currentLevelConfig = LEVELS.find(l => l.level === levelInfo.level);
    const nextLevelConfig = LEVELS.find(l => l.level === levelInfo.level + 1);

    if (compact) {
        return (
            <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000]">
                <Zap className="w-4 h-4 text-neo-accent" />
                <span className="font-black text-sm">{totalXp.toLocaleString()}</span>

                <AnimatePresence>
                    {animatingXp !== null && (
                        <motion.span
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: -20 }}
                            exit={{ opacity: 0 }}
                            className="absolute text-neo-accent font-black text-sm"
                        >
                            +{animatingXp}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] p-4 relative overflow-hidden">
            {/* Animated XP gain */}
            <AnimatePresence>
                {animatingXp !== null && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        className="absolute top-2 right-2 bg-neo-accent text-white px-3 py-1 font-black text-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] -rotate-3"
                    >
                        <ChevronUp className="w-4 h-4 inline" />+{animatingXp} XP
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center gap-4">
                {/* Level Badge */}
                {showLevel && (
                    <div
                        className="w-14 h-14 flex items-center justify-center border-4 border-black text-3xl"
                        style={{ backgroundColor: levelInfo.color + '30' }}
                    >
                        {levelInfo.badge}
                    </div>
                )}

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                            LEVEL {levelInfo.level} • {levelInfo.name}
                        </span>
                        <span className="font-black text-neo-accent">{totalXp.toLocaleString()} XP</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 bg-neo-bg border-2 border-black relative overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${levelInfo.progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="h-full bg-neo-accent"
                            style={{ backgroundColor: levelInfo.color }}
                        />
                    </div>

                    {nextLevelConfig && (
                        <div className="flex justify-between mt-1">
                            <span className="text-[8px] font-bold text-black/40">
                                {currentLevelConfig?.minXp.toLocaleString()} XP
                            </span>
                            <span className="text-[8px] font-bold text-black/40">
                                {xpToNext.toLocaleString()} XP to Level {levelInfo.level + 1}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default XPCounter;
