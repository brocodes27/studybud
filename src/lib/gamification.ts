/**
 * Gamification System
 * Handles XP, levels, streaks, and achievements
 */

import { supabase } from './supabase';

// ============================================
// XP Rewards Configuration
// ============================================
export const XP_REWARDS = {
    // Daily activities
    daily_checkin: 50,
    daily_checkin_correct: 60,
    daily_checkin_incorrect: 40,

    // Practice questions
    question_correct: 10,
    question_incorrect: 3,
    question_streak_bonus: 5, // Per consecutive correct

    // Tests
    practice_test_complete: 200,
    practice_test_section: 50,

    // Features
    feynman_session: 100,
    video_watched: 25,
    flashcard_reviewed: 5,
    notes_saved: 15,
    study_plan_created: 75,

    // Roadmap-synced task completion
    prescription_task_complete: 40,
    sprint_task_complete: 50,
    assignment_complete: 30,
    plan_task_complete: 25,
    all_prescription_tasks_complete: 100,

    // Streaks
    streak_bonus_per_day: 10,
    streak_milestone_7: 100,
    streak_milestone_30: 500,
    streak_milestone_100: 2000,
} as const;

// ============================================
// Level Configuration
// ============================================
export interface LevelConfig {
    level: number;
    name: string;
    minXp: number;
    badge: string;
    color: string;
}

export const LEVELS: LevelConfig[] = [
    { level: 1, name: 'Rookie', minXp: 0, badge: '🌱', color: '#10B981' },
    { level: 2, name: 'Learner', minXp: 100, badge: '📚', color: '#3B82F6' },
    { level: 3, name: 'Student', minXp: 400, badge: '📝', color: '#6366F1' },
    { level: 4, name: 'Scholar', minXp: 900, badge: '🎓', color: '#8B5CF6' },
    { level: 5, name: 'Expert', minXp: 1600, badge: '🧠', color: '#A855F7' },
    { level: 6, name: 'Master', minXp: 2500, badge: '⚡', color: '#EC4899' },
    { level: 7, name: 'Sage', minXp: 3600, badge: '🔮', color: '#F43F5E' },
    { level: 8, name: 'Champion', minXp: 4900, badge: '🏆', color: '#F59E0B' },
    { level: 9, name: 'Legend', minXp: 6400, badge: '👑', color: '#EAB308' },
    { level: 10, name: 'Titan', minXp: 8100, badge: '🌟', color: '#FBBF24' },
];

export interface UserGamification {
    user_id: string;
    total_xp: number;
    current_level: number;
    current_streak: number;
    longest_streak: number;
    last_activity_date: string | null;
    streak_shields_remaining: number;
}

export interface Achievement {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    xp_reward: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    category: string;
    unlocked_at?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): { level: number; name: string; badge: string; color: string; progress: number } {
    let currentLevel = LEVELS[0];
    let nextLevel = LEVELS[1];

    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i].minXp) {
            currentLevel = LEVELS[i];
            nextLevel = LEVELS[i + 1] || LEVELS[i];
            break;
        }
    }

    const xpInLevel = xp - currentLevel.minXp;
    const xpForNextLevel = nextLevel.minXp - currentLevel.minXp;
    const progress = xpForNextLevel > 0 ? (xpInLevel / xpForNextLevel) * 100 : 100;

    return {
        level: currentLevel.level,
        name: currentLevel.name,
        badge: currentLevel.badge,
        color: currentLevel.color,
        progress: Math.min(100, Math.max(0, progress)),
    };
}

/**
 * Get XP needed for next level
 */
export function getXpToNextLevel(currentXp: number): number {
    const currentLevel = calculateLevel(currentXp);
    const nextLevelConfig = LEVELS.find(l => l.level === currentLevel.level + 1);
    if (!nextLevelConfig) return 0;
    return nextLevelConfig.minXp - currentXp;
}

// ============================================
// Supabase Operations
// ============================================

/**
 * Get user's gamification state
 */
export async function getUserGamification(userId: string): Promise<UserGamification | null> {
    const { data, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching gamification:', error);
    }

    return data;
}

/**
 * Initialize gamification for new user
 */
export async function initializeGamification(userId: string): Promise<UserGamification> {
    const { data, error } = await supabase
        .from('user_gamification')
        .upsert({
            user_id: userId,
            total_xp: 0,
            current_level: 1,
            current_streak: 0,
            longest_streak: 0,
            streak_shields_remaining: 0,
        }, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) {
        console.error('Error initializing gamification:', error);
        throw error;
    }

    return data;
}

/**
 * Award XP to user
 */
export async function awardXp(
    userId: string,
    amount: number,
    reason: string,
    sourceType?: string,
    sourceId?: string
): Promise<{ newTotal: number; levelUp: boolean; newLevel?: number }> {
    // Get current state
    let state = await getUserGamification(userId);
    if (!state) {
        state = await initializeGamification(userId);
    }

    const oldLevel = calculateLevel(state.total_xp).level;

    // Insert XP transaction
    await supabase.from('xp_transactions').insert({
        user_id: userId,
        amount,
        reason,
        source_type: sourceType,
        source_id: sourceId,
    });

    // Update total XP
    const newTotal = state.total_xp + amount;
    const newLevelData = calculateLevel(newTotal);

    await supabase
        .from('user_gamification')
        .update({
            total_xp: newTotal,
            current_level: newLevelData.level,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

    const levelUp = newLevelData.level > oldLevel;

    return {
        newTotal,
        levelUp,
        newLevel: levelUp ? newLevelData.level : undefined,
    };
}

/**
 * Update streak
 */
export async function updateStreak(userId: string): Promise<{ streak: number; isNewStreak: boolean; streakBonus: number }> {
    let state = await getUserGamification(userId);
    if (!state) {
        state = await initializeGamification(userId);
    }

    const oldStreak = state.current_streak || 0;
    const oldLastActivity = state.last_activity_date || '';

    // Invoke the database RPC function to calculate and update streak consistently
    const { data: newStreakVal, error: rpcError } = await supabase.rpc('update_streak', { p_user_id: userId });
    if (rpcError) {
        console.error('Error executing update_streak RPC:', rpcError);
        return { streak: oldStreak, isNewStreak: false, streakBonus: 0 };
    }

    // Fetch the updated state to get new values
    const updatedState = await getUserGamification(userId);
    const resolvedStreak = typeof newStreakVal === 'number' ? newStreakVal : (updatedState?.current_streak ?? oldStreak);
    const newLastActivity = updatedState?.last_activity_date ?? oldLastActivity;

    // Check if the streak was newly incremented today
    const isNewStreak = resolvedStreak > oldStreak || (oldStreak === 0 && resolvedStreak === 1) || (oldLastActivity !== newLastActivity);

    // Calculate streak bonus
    let streakBonus = 0;
    if (isNewStreak && resolvedStreak > 1) {
        streakBonus = XP_REWARDS.streak_bonus_per_day * resolvedStreak;

        // Milestone bonuses
        if (resolvedStreak === 7) streakBonus += XP_REWARDS.streak_milestone_7;
        if (resolvedStreak === 30) streakBonus += XP_REWARDS.streak_milestone_30;
        if (resolvedStreak === 100) streakBonus += XP_REWARDS.streak_milestone_100;
    }

    // Award streak bonus XP
    if (streakBonus > 0) {
        await awardXp(userId, streakBonus, `Streak bonus (Day ${resolvedStreak})`, 'streak');
    }

    return { streak: resolvedStreak, isNewStreak, streakBonus };
}

/**
 * Get user achievements
 */
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
    const { data, error } = await supabase
        .from('achievements')
        .select(`
      *,
      user_achievements!left(unlocked_at)
    `)
        .eq('user_achievements.user_id', userId)
        .eq('is_active', true)
        .order('rarity', { ascending: true });

    if (error) {
        console.error('Error fetching achievements:', error);
        return [];
    }

    return data.map(a => ({
        ...a,
        unlocked_at: a.user_achievements?.[0]?.unlocked_at,
    }));
}

/**
 * Check and unlock achievements
 */
export async function checkAchievements(userId: string): Promise<Achievement[]> {
    // Get user stats
    const [gamification, mastery] = await Promise.all([
        getUserGamification(userId),
        supabase
            .from('user_subject_mastery')
            .select('questions_attempted')
            .eq('user_id', userId),
    ]);

    if (!gamification) return [];

    const totalQuestions = mastery.data?.reduce((sum, m) => sum + (m.questions_attempted || 0), 0) || 0;

    // Get all achievements already unlocked by the user
    const { data: unlockedIdsData } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

    const unlockedIds = unlockedIdsData?.map(ua => ua.achievement_id) || [];

    // Get all active achievements not yet unlocked
    let query = supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true);

    if (unlockedIds.length > 0) {
        query = query.not('id', 'in', unlockedIds);
    }

    const { data: achievements } = await query;

    if (!achievements) return [];

    const unlocked: Achievement[] = [];

    for (const achievement of achievements) {
        let shouldUnlock = false;

        switch (achievement.requirement_type) {
            case 'streak_days':
                shouldUnlock = gamification.current_streak >= achievement.requirement_value;
                break;
            case 'questions_answered':
                shouldUnlock = totalQuestions >= achievement.requirement_value;
                break;
            case 'xp_earned':
                shouldUnlock = gamification.total_xp >= achievement.requirement_value;
                break;
        }

        if (shouldUnlock) {
            // Unlock achievement
            await supabase.from('user_achievements').insert({
                user_id: userId,
                achievement_id: achievement.id,
            });

            // Award XP if any
            if (achievement.xp_reward > 0) {
                await awardXp(userId, achievement.xp_reward, `Achievement: ${achievement.name}`, 'achievement', achievement.id);
            }

            unlocked.push(achievement);
        }
    }

    return unlocked;
}

/**
 * Record daily check-in
 */
export async function recordDailyCheckin(
    userId: string,
    questionDomain: string,
    isCorrect: boolean
): Promise<{
    xpEarned: number;
    streak: number;
    streakBonus: number;
    totalXp: number;
    levelUp: boolean;
    newLevel?: number;
    achievements: Achievement[];
}> {
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const { data: existing } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('checkin_date', today)
        .maybeSingle();

    if (existing) {
        throw new Error('Already checked in today');
    }

    // Calculate XP
    const baseXp = isCorrect ? XP_REWARDS.daily_checkin_correct : XP_REWARDS.daily_checkin_incorrect;

    // Update streak
    const { streak, streakBonus } = await updateStreak(userId);

    const totalXpEarned = baseXp + streakBonus;

    // Award XP
    const { newTotal, levelUp, newLevel } = await awardXp(
        userId,
        totalXpEarned,
        'Daily check-in',
        'daily_checkin'
    );

    // Record check-in
    await supabase.from('daily_checkins').insert({
        user_id: userId,
        checkin_date: today,
        question_domain: questionDomain,
        is_correct: isCorrect,
        xp_earned: totalXpEarned,
    });

    // Log activity
    await supabase.from('user_activity_log').upsert({
        user_id: userId,
        activity_date: today,
        activity_type: 'daily_checkin',
        xp_earned: totalXpEarned,
    }, { onConflict: 'user_id,activity_date,activity_type' });

    // Check for new achievements
    const achievements = await checkAchievements(userId);

    return {
        xpEarned: totalXpEarned,
        streak,
        streakBonus,
        totalXp: newTotal,
        levelUp,
        newLevel,
        achievements,
    };
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
    type: 'weekly' | 'alltime' = 'weekly',
    limit: number = 10
): Promise<Array<{
    user_id: string;
    display_name: string;
    total_xp: number;
    current_level: number;
    current_streak: number;
    rank: number;
}>> {
    if (type === 'weekly') {
        // Get XP earned this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data } = await supabase
            .from('xp_transactions')
            .select('user_id, amount')
            .gte('created_at', weekAgo.toISOString())
            .order('amount', { ascending: false });

        // Aggregate by user
        const userXp: Record<string, number> = {};
        data?.forEach(t => {
            userXp[t.user_id] = (userXp[t.user_id] || 0) + t.amount;
        });

        // Sort and return top N
        const sorted = Object.entries(userXp)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        // Fetch user details
        const userIds = sorted.map(([id]) => id);
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', userIds);

        const { data: gamification } = await supabase
            .from('user_gamification')
            .select('user_id, current_level, current_streak')
            .in('user_id', userIds);

        return sorted.map(([userId, xp], index) => ({
            user_id: userId,
            display_name: profiles?.find(p => p.id === userId)?.full_name || 'Anonymous',
            total_xp: xp,
            current_level: gamification?.find(g => g.user_id === userId)?.current_level || 1,
            current_streak: gamification?.find(g => g.user_id === userId)?.current_streak || 0,
            rank: index + 1,
        }));
    } else {
        // All-time leaderboard
        const { data } = await supabase
            .from('user_gamification')
            .select('user_id, total_xp, current_level, current_streak')
            .order('total_xp', { ascending: false })
            .limit(limit);

        if (!data) return [];

        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', userIds);

        return data.map((d, index) => ({
            user_id: d.user_id,
            display_name: profiles?.find(p => p.id === d.user_id)?.full_name || 'Anonymous',
            total_xp: d.total_xp,
            current_level: d.current_level,
            current_streak: d.current_streak,
            rank: index + 1,
        }));
    }
}
