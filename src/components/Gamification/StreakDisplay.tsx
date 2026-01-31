import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserGamification } from '../../lib/gamification';

interface StreakDisplayProps {
    compact?: boolean;
    showShield?: boolean;
}

export function StreakDisplay({ compact = false, showShield = true }: StreakDisplayProps) {
    const { user } = useAuth() as any;
    const [streak, setStreak] = useState(0);
    const [longestStreak, setLongestStreak] = useState(0);
    const [hasShield, setHasShield] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadStreak();
        }
    }, [user?.id]);

    const loadStreak = async () => {
        const gamification = await getUserGamification(user.id);
        if (gamification) {
            setStreak(gamification.current_streak);
            setLongestStreak(gamification.longest_streak);
            setHasShield(gamification.streak_shields_remaining > 0);
        }
    };

    // Determine flame intensity based on streak
    const getFlameStyle = () => {
        if (streak >= 30) return { color: '#FF6B6B', scale: 1.3, glow: true };
        if (streak >= 14) return { color: '#FF9F43', scale: 1.2, glow: true };
        if (streak >= 7) return { color: '#FFC300', scale: 1.1, glow: false };
        if (streak >= 3) return { color: '#FFA500', scale: 1.0, glow: false };
        return { color: '#999', scale: 0.9, glow: false };
    };

    const flameStyle = getFlameStyle();

    if (compact) {
        return (
            <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000]">
                <motion.div
                    animate={streak > 0 ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                >
                    <Flame
                        className="w-5 h-5"
                        style={{ color: flameStyle.color, fill: streak > 0 ? flameStyle.color : 'none' }}
                    />
                </motion.div>
                <span className="font-black text-lg">{streak}</span>
                {hasShield && showShield && (
                    <Shield className="w-4 h-4 text-blue-500" />
                )}
            </div>
        );
    }

    return (
        <div className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_#000] p-4">
            <div className="flex items-center gap-4">
                {/* Flame Icon */}
                <motion.div
                    animate={streak > 0 ? {
                        scale: [flameStyle.scale, flameStyle.scale * 1.1, flameStyle.scale],
                        rotate: [0, 5, -5, 0]
                    } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-16 h-16 border-4 border-black flex items-center justify-center ${flameStyle.glow ? 'shadow-[0_0_20px_rgba(255,107,107,0.5)]' : ''
                        }`}
                    style={{ backgroundColor: streak > 0 ? flameStyle.color + '20' : '#f0f0f0' }}
                >
                    <Flame
                        className="w-10 h-10"
                        style={{
                            color: flameStyle.color,
                            fill: streak > 0 ? flameStyle.color : 'none',
                            transform: `scale(${flameStyle.scale})`
                        }}
                    />
                </motion.div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-4xl font-black">{streak}</span>
                        <span className="text-sm font-black uppercase text-black/40">DAY{streak !== 1 ? 'S' : ''}</span>
                        {hasShield && showShield && (
                            <div className="bg-blue-100 border-2 border-blue-400 px-2 py-0.5 flex items-center gap-1" title="Streak Shield Active">
                                <Shield className="w-3 h-3 text-blue-600" />
                                <span className="text-[8px] font-black text-blue-600">PROTECTED</span>
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                        {streak === 0 ? 'START YOUR STREAK TODAY!' :
                            streak < 3 ? 'KEEP IT GOING!' :
                                streak < 7 ? 'YOU\'RE ON FIRE!' :
                                    streak < 14 ? 'UNSTOPPABLE!' :
                                        streak < 30 ? 'LEGENDARY STREAK!' :
                                            'ABSOLUTE TITAN!'}
                    </p>

                    {longestStreak > streak && (
                        <p className="text-[8px] font-bold text-black/30 mt-1">
                            Personal best: {longestStreak} days
                        </p>
                    )}
                </div>
            </div>

            {/* Streak Calendar Preview */}
            <div className="mt-4 flex gap-1">
                {[...Array(7)].map((_, i) => {
                    const dayOffset = 6 - i;
                    const isActive = dayOffset < streak;
                    return (
                        <div
                            key={i}
                            className={`flex-1 h-2 border-2 border-black ${isActive ? 'bg-neo-accent' : 'bg-neo-bg'
                                }`}
                        />
                    );
                })}
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-[8px] font-bold text-black/30">6 DAYS AGO</span>
                <span className="text-[8px] font-bold text-black/30">TODAY</span>
            </div>
        </div>
    );
}

export default StreakDisplay;
