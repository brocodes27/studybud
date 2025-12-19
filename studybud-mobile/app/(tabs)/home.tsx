import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useVideoGeneration } from '../../lib/VideoGenerationContext';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DaySchedule {
    id: string;
    day: number;
    date: string;
    topic: string;
    description: string;
    completed?: boolean;
}

interface Stats {
    streak: number;
    totalPlans: number;
    completedToday: number;
}

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const [todaySchedule, setTodaySchedule] = useState<DaySchedule | null>(null);
    const [stats, setStats] = useState<Stats>({ streak: 0, totalPlans: 0, completedToday: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const { activeGenerations } = useVideoGeneration();
    const generationsArray = Array.from(activeGenerations.values());

    useEffect(() => {
        fetchData();
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date().toISOString().split('T')[0];

            // Fetch today's schedule
            const { data: plans } = await supabase
                .from('exam_plans')
                .select('plan')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (plans?.plan?.daily_schedule) {
                const schedule = plans.plan.daily_schedule.find(
                    (day: DaySchedule) => day.date === today
                );
                setTodaySchedule(schedule || null);
            }

            // Fetch real stats
            const { data: allPlans, count } = await supabase
                .from('exam_plans')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id);

            // Calculate completed tasks today
            let completedCount = 0;
            if (plans?.plan?.daily_schedule) {
                completedCount = plans.plan.daily_schedule.filter(
                    (day: DaySchedule) => day.date === today && day.completed
                ).length;
            }

            // Calculate streak (simplified - could be enhanced with proper tracking)
            const streak = calculateStreak(allPlans || []);

            setStats({
                streak,
                totalPlans: count || 0,
                completedToday: completedCount,
            });
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStreak = (plans: any[]): number => {
        // Simple streak calculation - count consecutive days with plans
        // This is a basic implementation; you could enhance it with completion tracking
        if (plans.length === 0) return 0;

        const sortedPlans = plans.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        let streak = 1;
        const today = new Date();
        const lastPlanDate = new Date(sortedPlans[0].created_at);
        const daysDiff = Math.floor((today.getTime() - lastPlanDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 1) {
            return streak;
        }

        return 0;
    };

    const markAsComplete = async () => {
        if (!todaySchedule) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Update the plan in database
            const { data: plans } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (plans && plans.plan?.daily_schedule) {
                const updatedSchedule = plans.plan.daily_schedule.map((day: DaySchedule) =>
                    day.date === todaySchedule.date ? { ...day, completed: true } : day
                );

                await supabase
                    .from('exam_plans')
                    .update({ plan: { ...plans.plan, daily_schedule: updatedSchedule } })
                    .eq('id', plans.id);

                setTodaySchedule(prev => prev ? { ...prev, completed: true } : null);
                setStats(prev => ({ ...prev, completedToday: prev.completedToday + 1 }));
            }
        } catch (error) {
            console.error('Error marking as complete:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>Loading StudyBud...</Text>
                </LinearGradient>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />
            }
        >
            {/* Global Background Generations */}
            {generationsArray.length > 0 && (
                <View style={[styles.backgroundGenerations, { marginTop: insets.top }]}>
                    {generationsArray.map(gen => (
                        <TouchableOpacity
                            key={gen.id}
                            style={styles.genCard}
                            onPress={() => router.push({ pathname: '/player', params: { topic: gen.topic } })}
                        >
                            <BlurView intensity={20} style={styles.genContent}>
                                <View style={styles.genInfo}>
                                    <View style={styles.genIcon}>
                                        <Ionicons name="sparkles" size={16} color={Colors.dark.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.genTitle} numberOfLines={1}>Generating Visuals: {gen.topic}</Text>
                                        <Text style={styles.genStep}>{gen.current_step}</Text>
                                    </View>
                                    <ActivityIndicator size="small" color={Colors.dark.accent} />
                                </View>
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressBar, { width: `${gen.progress * 100}%` }]} />
                                </View>
                            </BlurView>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Header with Gradient */}
            <LinearGradient
                colors={['rgba(0, 243, 255, 0.1)', 'rgba(255, 0, 255, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}
            >
                <View>
                    <Text style={styles.greeting}>Welcome back! 👋</Text>
                    <Text style={styles.date}>
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </Text>
                </View>
                <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(tabs)/profile')}>
                    <Ionicons name="person-circle-outline" size={40} color={Colors.dark.text} />
                </TouchableOpacity>
            </LinearGradient>

            {/* Stats Cards */}
            <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
                <View style={styles.statCard}>
                    <LinearGradient
                        colors={['#ff00ff20', '#ff00ff10']}
                        style={styles.statGradient}
                    >
                        <Ionicons name="flame" size={28} color="#ff6b35" />
                        <Text style={styles.statValue}>{stats.streak}</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient
                        colors={['#00f3ff20', '#00f3ff10']}
                        style={styles.statGradient}
                    >
                        <Ionicons name="book" size={28} color={Colors.dark.primary} />
                        <Text style={styles.statValue}>{stats.totalPlans}</Text>
                        <Text style={styles.statLabel}>Study Plans</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient
                        colors={['#39ff1420', '#39ff1410']}
                        style={styles.statGradient}
                    >
                        <Ionicons name="checkmark-circle" size={28} color={Colors.dark.accent} />
                        <Text style={styles.statValue}>{stats.completedToday}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </LinearGradient>
                </View>
            </Animated.View>

            {/* Today's Task */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Today's Focus</Text>

                {todaySchedule ? (
                    <TouchableOpacity style={styles.taskCard} activeOpacity={0.9}>
                        <LinearGradient
                            colors={todaySchedule.completed ? ['#39ff1420', '#00f3ff20'] : ['#00f3ff20', '#ff00ff20']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.taskGradient}
                        >
                            <View style={styles.taskHeader}>
                                <View style={styles.dayBadge}>
                                    <Text style={styles.dayText}>Day {todaySchedule.day}</Text>
                                </View>
                                {todaySchedule.completed && (
                                    <View style={styles.completedBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color={Colors.dark.accent} />
                                        <Text style={styles.completedText}>Done!</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.taskTopic}>{todaySchedule.topic}</Text>
                            <Text style={styles.taskDescription}>{todaySchedule.description}</Text>

                            {!todaySchedule.completed && (
                                <TouchableOpacity style={styles.completeButton} onPress={markAsComplete}>
                                    <LinearGradient
                                        colors={['#00f3ff', '#0080ff']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.completeButtonGradient}
                                    >
                                        <Text style={styles.completeButtonText}>Mark Complete</Text>
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={Colors.dark.textSecondary} />
                        <Text style={styles.emptyText}>No task scheduled for today</Text>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => router.push('/(tabs)/plans')}
                        >
                            <Text style={styles.createButtonText}>View Study Plans</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/cbse-simulator')}
                    >
                        <LinearGradient colors={['#39ff1430', '#39ff1410']} style={styles.actionGradient}>
                            <Ionicons name="school" size={32} color={Colors.dark.accent} />
                            <Text style={styles.actionText}>CBSE Simulator</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/(tabs)/lessons')}
                    >
                        <LinearGradient colors={['#00f3ff30', '#00f3ff10']} style={styles.actionGradient}>
                            <Ionicons name="play-circle" size={32} color={Colors.dark.primary} />
                            <Text style={styles.actionText}>Watch Lessons</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/(tabs)/chat')}
                    >
                        <LinearGradient colors={['#ff00ff30', '#ff00ff10']} style={styles.actionGradient}>
                            <Ionicons name="chatbubbles" size={32} color={Colors.dark.secondary} />
                            <Text style={styles.actionText}>Ask AI</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.md,
    },
    content: {
        paddingBottom: Spacing.xl,
    },
    header: {
        padding: Spacing.lg,
        // paddingTop is handled dynamically via inline style
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    profileButton: {
        padding: 4,
    },
    greeting: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    date: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    statGradient: {
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 16,
    },
    statValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginTop: Spacing.xs,
    },
    statLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
        textAlign: 'center',
    },
    section: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    taskCard: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    taskGradient: {
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 20,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    dayBadge: {
        backgroundColor: Colors.dark.primary + '30',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: 12,
    },
    dayText: {
        color: Colors.dark.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.dark.accent + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: 12,
    },
    completedText: {
        color: Colors.dark.accent,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    taskTopic: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    taskDescription: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    completeButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    completeButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    completeButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyText: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
    },
    createButton: {
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    createButtonText: {
        color: Colors.dark.primary,
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    actionCard: {
        width: '47%', // Fits 2 per row with gap
        borderRadius: 16,
        overflow: 'hidden',
    },
    actionGradient: {
        padding: Spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 16,
        height: 120, // Fixed height for consistency
        justifyContent: 'center',
    },
    actionText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.text,
        fontWeight: Typography.weights.semibold,
        marginTop: Spacing.sm,
    },
    backgroundGenerations: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    genCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(57, 255, 20, 0.2)',
    },
    genContent: {
        padding: Spacing.md,
    },
    genInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    genIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(57, 255, 20, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    genTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    genStep: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
    },
    progressContainer: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.dark.accent,
        shadowColor: Colors.dark.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
    },
});
