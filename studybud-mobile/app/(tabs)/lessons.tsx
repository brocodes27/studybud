import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Lesson {
    day: number;
    date: string;
    topic: string;
    description: string;
    subject: string;
    plan_id: string;
    plan_name?: string;
    chapter?: string;
    question_type: string;
}

interface PlanFolder {
    id: string;
    name: string;
    subject: string;
    lessonCount: number;
}

interface ChapterFolder {
    name: string;
    lessonCount: number;
}

export default function LessonsScreen() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'plans' | 'chapters' | 'lessons'>('plans');
    const [selectedPlan, setSelectedPlan] = useState<PlanFolder | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

    useEffect(() => {
        fetchLessons();
    }, []);

    const fetchLessons = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: plans, error } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const allLessons: Lesson[] = [];

            plans?.forEach((plan: any) => {
                if (plan.plan?.daily_schedule) {
                    plan.plan.daily_schedule.forEach((day: any) => {
                        // Smart chapter extraction from topic
                        let finalChapter = day.chapter;
                        let finalTopic = day.topic;

                        if (!finalChapter && day.topic.includes(':')) {
                            const parts = day.topic.split(':');
                            if (parts.length > 1) {
                                finalChapter = parts[0].trim();
                                finalTopic = parts.slice(1).join(':').trim();
                            }
                        }

                        allLessons.push({
                            day: day.day,
                            date: day.date,
                            topic: finalTopic,
                            description: day.description || '',
                            subject: plan.subject,
                            plan_id: plan.id,
                            plan_name: plan.plan_name || `${plan.subject} Plan`,
                            chapter: finalChapter || 'General Topics',
                            question_type: day.question_type || 'Lesson',
                        });
                    });
                }
            });

            setLessons(allLessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const plans: PlanFolder[] = Array.from(new Set(lessons.map(l => l.plan_id))).map(id => {
        const planLessons = lessons.filter(l => l.plan_id === id);
        return {
            id,
            name: planLessons[0]?.plan_name || 'Unknown Plan',
            subject: planLessons[0]?.subject || 'Unknown',
            lessonCount: planLessons.length,
        };
    });

    const chapters: ChapterFolder[] = selectedPlan
        ? Array.from(new Set(lessons.filter(l => l.plan_id === selectedPlan.id).map(l => l.chapter!))).map(name => ({
            name,
            lessonCount: lessons.filter(l => l.plan_id === selectedPlan.id && l.chapter === name).length,
        }))
        : [];

    const currentLessons = selectedPlan && selectedChapter
        ? lessons.filter(l => l.plan_id === selectedPlan.id && l.chapter === selectedChapter)
        : [];

    const renderPlan = ({ item }: { item: PlanFolder }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                setSelectedPlan(item);
                const planChapters = Array.from(new Set(lessons.filter(l => l.plan_id === item.id).map(l => l.chapter!)));
                if (planChapters.length === 1) {
                    setSelectedChapter(planChapters[0]);
                    setViewMode('lessons');
                } else {
                    setViewMode('chapters');
                }
            }}
        >
            <LinearGradient colors={['#00f3ff20', '#ff00ff20']} style={styles.cardGradient}>
                <View style={styles.cardIcon}>
                    <Ionicons name="book" size={24} color={Colors.dark.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>{item.subject}</Text>
                </View>
                <View style={styles.cardMeta}>
                    <Text style={styles.cardCount}>{item.lessonCount} Lessons</Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    const renderChapter = ({ item }: { item: ChapterFolder }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                setSelectedChapter(item.name);
                setViewMode('lessons');
            }}
        >
            <LinearGradient colors={['#ff00ff20', '#00f3ff20']} style={styles.cardGradient}>
                <View style={[styles.cardIcon, { backgroundColor: Colors.dark.secondary + '20' }]}>
                    <Ionicons name="folder" size={24} color={Colors.dark.secondary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                </View>
                <View style={styles.cardMeta}>
                    <Text style={styles.cardCount}>{item.lessonCount} Topics</Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    const renderLesson = ({ item }: { item: Lesson }) => (
        <TouchableOpacity style={styles.lessonCard} activeOpacity={0.8}>
            <LinearGradient colors={[' #39ff1420', '#00f3ff20']} style={styles.lessonGradient}>
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonBadges}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.subject}</Text>
                        </View>
                        {item.question_type && (
                            <View style={[styles.badge, styles.typeBadge]}>
                                <Text style={styles.badgeText}>{item.question_type}</Text>
                            </View>
                        )}
                    </View>
                    <Ionicons name="play-circle" size={32} color={Colors.dark.accent} />
                </View>

                <Text style={styles.lessonTitle} numberOfLines={2}>
                    {item.topic}
                </Text>
                <Text style={styles.lessonDescription} numberOfLines={3}>
                    {item.description}
                </Text>

                <TouchableOpacity style={styles.watchButton}>
                    <LinearGradient colors={['#39ff14', '#00ff88']} style={styles.watchButtonGradient}>
                        <Ionicons name="play" size={16} color={Colors.dark.background} />
                        <Text style={styles.watchButtonText}>Watch Lesson</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </LinearGradient>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>Loading lessons...</Text>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.header}>
                <View style={styles.headerContent}>
                    {viewMode !== 'plans' && (
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => {
                                if (viewMode === 'lessons') {
                                    if (chapters.length <= 1) {
                                        setViewMode('plans');
                                        setSelectedPlan(null);
                                        setSelectedChapter(null);
                                    } else {
                                        setViewMode('chapters');
                                        setSelectedChapter(null);
                                    }
                                } else {
                                    setViewMode('plans');
                                    setSelectedPlan(null);
                                }
                            }}
                        >
                            <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    )}
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle}>
                            {viewMode === 'plans' ? 'Video Library' :
                                viewMode === 'chapters' ? selectedPlan?.name :
                                    selectedChapter}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                            {viewMode === 'plans' ? 'Select a study plan' :
                                viewMode === 'chapters' ? 'Choose a chapter' :
                                    `${currentLessons.length} lessons`}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {lessons.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="videocam-outline" size={64} color={Colors.dark.textSecondary} />
                    <Text style={styles.emptyText}>No lessons yet</Text>
                    <Text style={styles.emptySubtext}>Create a study plan to generate video lessons</Text>
                    <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(tabs)/plans')}>
                        <LinearGradient colors={['#00f3ff', '#0080ff']} style={styles.createButtonGradient}>
                            <Text style={styles.createButtonText}>View Plans</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={viewMode === 'plans' ? plans : viewMode === 'chapters' ? chapters : currentLessons}
                    renderItem={viewMode === 'plans' ? renderPlan : viewMode === 'chapters' ? renderChapter : renderLesson}
                    keyExtractor={(item, index) => `${index}-${viewMode}`}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    numColumns={viewMode === 'lessons' ? 1 : 1}
                    key={viewMode}
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
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
    listContent: {
        padding: Spacing.lg,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    cardGradient: {
        flexDirection: 'row',
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 16,
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    cardSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    cardMeta: {
        marginLeft: Spacing.sm,
    },
    cardCount: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
    },
    lessonCard: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    lessonGradient: {
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 16,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    lessonBadges: {
        flexDirection: 'row',
        gap: Spacing.xs,
        flex: 1,
        flexWrap: 'wrap',
    },
    badge: {
        backgroundColor: Colors.dark.primary + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.dark.primary + '40',
    },
    typeBadge: {
        backgroundColor: Colors.dark.secondary + '20',
        borderColor: Colors.dark.secondary + '40',
    },
    badgeText: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.text,
        fontWeight: Typography.weights.semibold,
    },
    lessonTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    lessonDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.lg,
    },
    watchButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    watchButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.xs,
    },
    watchButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.background,
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
        marginBottom: Spacing.xl,
    },
    createButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    createButtonGradient: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
    },
    createButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
});
