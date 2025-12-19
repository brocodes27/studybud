import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';

interface StudyPlan {
    id: string;
    plan_name?: string;
    class: string;
    subject: string;
    chapters: string;
    exam_date: string;
    plan: {
        days_until_exam: number;
        daily_schedule: Array<{
            day: number;
            date: string;
            topic: string;
            completed?: boolean;
        }>;
    };
    created_at: string;
}

export default function PlansScreen() {
    const [plans, setPlans] = useState<StudyPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        thisWeek: 0,
        completed: 0,
    });

    useEffect(() => {
        fetchPlans();

        // Setup realtime subscription with user filter
        const setupRealtimeSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const channel = supabase
                .channel('exam_plans_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'exam_plans',
                        filter: `user_id=eq.${user.id}`
                    },
                    () => {
                        fetchPlans();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        const cleanup = setupRealtimeSubscription();
        return () => {
            cleanup.then(fn => fn && fn());
        };
    }, []);

    const fetchPlans = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch all plans for the user
            const { data, error } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setPlans(data || []);
            calculateStats(data || []);
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateStats = (plansList: StudyPlan[]) => {
        const today = new Date();

        const active = plansList.filter(plan => new Date(plan.exam_date) > today).length;

        const thisWeek = plansList.filter(plan => {
            const daysUntil = differenceInDays(new Date(plan.exam_date), today);
            return daysUntil <= 7 && daysUntil >= 0;
        }).length;

        const completed = plansList.filter(plan => new Date(plan.exam_date) < today).length;

        setStats({
            total: plansList.length,
            active,
            thisWeek,
            completed,
        });
    };

    const getPlanProgress = (plan: StudyPlan) => {
        const today = new Date();
        const examDate = new Date(plan.exam_date);
        const totalDays = plan.plan.days_until_exam;
        const daysElapsed = Math.max(0, totalDays - differenceInDays(examDate, today));
        return Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    };

    const getPlanStatus = (plan: StudyPlan) => {
        const today = new Date();
        const examDate = new Date(plan.exam_date);
        const daysUntil = differenceInDays(examDate, today);

        if (daysUntil < 0) return { status: 'completed', color: Colors.dark.accent, text: 'Completed' };
        if (daysUntil <= 7) return { status: 'urgent', color: '#ff9800', text: 'This Week' };
        if (daysUntil <= 30) return { status: 'upcoming', color: Colors.dark.primary, text: 'Upcoming' };
        return { status: 'future', color: Colors.dark.textSecondary, text: 'Future' };
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPlans();
    };

    const renderPlan = ({ item }: { item: StudyPlan }) => {
        const progress = getPlanProgress(item);
        const status = getPlanStatus(item);
        const daysUntil = differenceInDays(new Date(item.exam_date), new Date());
        const examDate = new Date(item.exam_date);

        return (
            <TouchableOpacity style={styles.planCard} activeOpacity={0.8}>
                <LinearGradient
                    colors={['#00f3ff15', '#ff00ff15']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planGradient}
                >
                    {/* Header */}
                    <View style={styles.planHeader}>
                        <View style={styles.planTitleContainer}>
                            <Text style={styles.planTitle} numberOfLines={1}>
                                {item.plan_name || `${item.subject} Study Plan`}
                            </Text>
                        </View>
                    </View>

                    {/* Plan Details */}
                    <View style={styles.planDetails}>
                        <View style={styles.detailRow}>
                            <Ionicons name="book-outline" size={16} color={Colors.dark.secondary} />
                            <Text style={styles.detailText}>{item.subject}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="calendar-outline" size={16} color={Colors.dark.primary} />
                            <Text style={styles.detailText}>
                                Exam: {examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="time-outline" size={16} color={Colors.dark.accent} />
                            <Text style={styles.detailText}>{item.plan.daily_schedule?.length || 0} study sessions</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressLabel}>Progress</Text>
                            <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <LinearGradient
                                colors={status.status === 'completed'
                                    ? ['#39ff14', '#00ff88']
                                    : status.status === 'urgent'
                                        ? ['#ff9800', '#ff5722']
                                        : ['#00f3ff', '#0080ff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.progressFill, { width: `${progress}%` }]}
                            />
                        </View>
                    </View>

                    {/* Status and Action */}
                    <View style={styles.planFooter}>
                        <View style={[styles.statusBadge, { backgroundColor: status.color + '20', borderColor: status.color + '40' }]}>
                            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                        </View>
                        {daysUntil >= 0 && (
                            <Text style={styles.daysLeft}>
                                {daysUntil === 0 ? 'Today' : `${daysUntil} days left`}
                            </Text>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => {
                                router.push(`/plan/${item.id}`);
                            }}
                        >
                            <LinearGradient
                                colors={['#00f3ff', '#0080ff']}
                                style={styles.viewButtonGradient}
                            >
                                <Ionicons name="eye" size={16} color="#fff" />
                                <Text style={styles.viewButtonText}>View Plan</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.startButton}
                            onPress={() => {
                                // Navigate to today's task in home screen
                                router.push('/(tabs)/home');
                            }}
                        >
                            <View style={styles.startButtonContainer}>
                                <Text style={styles.startButtonText}>Start Study</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>Loading your plans...</Text>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>My Study Plans</Text>
                <Text style={styles.headerSubtitle}>Manage and track your personalized schedules</Text>
            </LinearGradient>

            {/* Stats Overview */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <LinearGradient colors={['#00f3ff20', '#00f3ff10']} style={styles.statGradient}>
                        <Ionicons name="book" size={24} color={Colors.dark.primary} />
                        <Text style={styles.statValue}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Total Plans</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient colors={['#39ff1420', '#39ff1410']} style={styles.statGradient}>
                        <Ionicons name="globe-outline" size={24} color={Colors.dark.accent} />
                        <Text style={styles.statValue}>{stats.active}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient colors={['#ff980020', '#ff980010']} style={styles.statGradient}>
                        <Ionicons name="alert-circle" size={24} color="#ff9800" />
                        <Text style={styles.statValue}>{stats.thisWeek}</Text>
                        <Text style={styles.statLabel}>This Week</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient colors={['#ff00ff20', '#ff00ff10']} style={styles.statGradient}>
                        <Ionicons name="trending-up" size={24} color={Colors.dark.secondary} />
                        <Text style={styles.statValue}>{stats.completed}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </LinearGradient>
                </View>
            </View>

            {/* Create New Button */}
            <View style={styles.createContainer}>
                <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(tabs)/home')}>
                    <LinearGradient
                        colors={['#00f3ff', '#0080ff']}
                        style={styles.createButtonGradient}
                    >
                        <Ionicons name="add-circle" size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Create New Study Plan</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Plans List */}
            {plans.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={64} color={Colors.dark.textSecondary} />
                    <Text style={styles.emptyText}>No study plans yet</Text>
                    <Text style={styles.emptySubtext}>Create your first plan to get started!</Text>
                </View>
            ) : (
                <FlatList
                    data={plans}
                    renderItem={renderPlan}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />
                    }
                />
            )}
        </View>
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
        gap: Spacing.md,
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.md,
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    headerSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    statsContainer: {
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    statGradient: {
        padding: Spacing.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 12,
    },
    statValue: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginTop: Spacing.xs,
    },
    statLabel: {
        fontSize: 10,
        color: Colors.dark.textSecondary,
        marginTop: 2,
        textAlign: 'center',
    },
    createContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    createButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    createButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    createButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: 0,
    },
    planCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    planGradient: {
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 20,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    planTitleContainer: {
        flex: 1,
    },
    planTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
    },
    planDetails: {
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    detailText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    progressContainer: {
        marginBottom: Spacing.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    progressLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
    },
    progressValue: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.text,
        fontWeight: Typography.weights.semibold,
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.dark.surface,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    planFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
    },
    daysLeft: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        fontWeight: Typography.weights.medium,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    viewButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    viewButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        gap: Spacing.xs,
    },
    viewButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: '#fff',
    },
    startButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    startButtonContainer: {
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
    },
    startButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.text,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    emptyText: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    emptySubtext: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
});
