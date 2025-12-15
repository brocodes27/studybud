import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

interface StudyPlan {
    id: string;
    subject: string;
    plan_name?: string;
    exam_date: string;
    plan: {
        daily_schedule: Array<{
            day: number;
            date: string;
            topic: string;
            question_type: string;
            description: string;
            practice_questions?: string[];
        }>;
    };
}

export default function PlanDetailScreen() {
    const { planId } = useLocalSearchParams<{ planId: string }>();
    const [plan, setPlan] = useState<StudyPlan | null>(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlan();
        fetchCompletedTasks();
    }, [planId]);

    const fetchPlan = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('exam_plans')
                .select('*')
                .eq('id', planId)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            setPlan(data);
        } catch (error) {
            console.error('Error fetching plan:', error);
            Alert.alert('Error', 'Failed to load study plan');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const fetchCompletedTasks = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('task_completions')
                .select('day_number')
                .eq('plan_id', planId)
                .eq('user_id', user.id);

            if (error) throw error;

            const completed = new Set(data?.map(item => item.day_number) || []);
            setCompletedTasks(completed);
        } catch (error) {
            console.error('Error fetching completed tasks:', error);
        }
    };

    const completeTask = async () => {
        if (!plan) return;

        const currentTask = plan.plan.daily_schedule[currentDay];

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error: completionError } = await supabase
                .from('task_completions')
                .upsert(
                    {
                        user_id: user.id,
                        plan_id: planId,
                        day_number: currentTask.day,
                        task_type: 'study_session',
                    },
                    { onConflict: 'user_id,plan_id,day_number', ignoreDuplicates: true }
                );

            if (completionError) throw completionError;

            setCompletedTasks(prev => new Set([...prev, currentTask.day]));
            setNotes('');

            Alert.alert('Success!', 'Study session completed');

            if (currentDay < plan.plan.daily_schedule.length - 1) {
                setCurrentDay(currentDay + 1);
            }
        } catch (error) {
            console.error('Error completing task:', error);
            Alert.alert('Error', 'Failed to save study session');
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>Loading plan...</Text>
                </LinearGradient>
            </View>
        );
    }

    if (!plan) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Plan not found</Text>
            </View>
        );
    }

    const currentTask = plan.plan.daily_schedule[currentDay];
    const isCurrentTaskCompleted = completedTasks.has(currentTask.day);

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{plan.plan_name || plan.subject}</Text>
                    <View style={styles.headerMeta}>
                        <Ionicons name="calendar" size={14} color={Colors.dark.secondary} />
                        <Text style={styles.headerMetaText}>
                            Exam: {format(new Date(plan.exam_date), 'MMM d, yyyy')}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Daily Schedule Sidebar */}
                <View style={styles.scheduleContainer}>
                    <Text style={styles.sectionTitle}>Study Schedule</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleScroll}>
                        {plan.plan.daily_schedule.map((task, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => setCurrentDay(index)}
                                style={[
                                    styles.dayCard,
                                    index === currentDay && styles.dayCardActive,
                                    completedTasks.has(task.day) && styles.dayCardCompleted,
                                ]}
                            >
                                <View style={styles.dayCardHeader}>
                                    <Text style={[
                                        styles.dayNumber,
                                        index === currentDay && styles.dayNumberActive,
                                    ]}>
                                        Day {task.day}
                                    </Text>
                                    {completedTasks.has(task.day) && (
                                        <Ionicons name="checkmark-circle" size={16} color={Colors.dark.accent} />
                                    )}
                                </View>
                                <Text
                                    style={[
                                        styles.dayTopic,
                                        index === currentDay && styles.dayTopicActive,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {task.topic}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Current Task */}
                <View style={styles.taskContainer}>
                    <LinearGradient colors={['#00f3ff10', '#ff00ff10']} style={styles.taskGradient}>
                        <View style={styles.taskHeader}>
                            <View>
                                <Text style={styles.taskDay}>Day {currentTask.day}</Text>
                                <Text style={styles.taskDate}>
                                    {format(new Date(currentTask.date), 'MMMM d, yyyy')}
                                </Text>
                            </View>
                            {isCurrentTaskCompleted && (
                                <View style={styles.completedBadge}>
                                    <Ionicons name="checkmark-circle" size={20} color={Colors.dark.accent} />
                                    <Text style={styles.completedText}>Completed</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.taskTopic}>{currentTask.topic}</Text>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{currentTask.question_type}</Text>
                        </View>

                        <View style={styles.descriptionCard}>
                            <View style={styles.descriptionHeader}>
                                <Ionicons name="book" size={16} color={Colors.dark.secondary} />
                                <Text style={styles.descriptionHeaderText}>Study Focus</Text>
                            </View>
                            <Text style={styles.descriptionText}>{currentTask.description}</Text>
                        </View>

                        {currentTask.practice_questions && currentTask.practice_questions.length > 0 && (
                            <View style={styles.questionsCard}>
                                <Text style={styles.questionsTitle}>Practice Questions</Text>
                                {currentTask.practice_questions.map((question, index) => (
                                    <View key={index} style={styles.questionItem}>
                                        <Text style={styles.questionText}>{question}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </LinearGradient>
                </View>

                {/* Notes Section */}
                <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Study Notes (Optional)</Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="Add notes about your study session..."
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {/* Complete Button */}
                {!isCurrentTaskCompleted && (
                    <TouchableOpacity style={styles.completeButton} onPress={completeTask}>
                        <LinearGradient colors={['#39ff14', '#00ff88']} style={styles.completeButtonGradient}>
                            <Ionicons name="checkmark-circle" size={20} color="#000" />
                            <Text style={styles.completeButtonText}>Complete Task</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Navigation */}
                <View style={styles.navigation}>
                    <TouchableOpacity
                        style={[styles.navButton, currentDay === 0 && styles.navButtonDisabled]}
                        onPress={() => setCurrentDay(Math.max(0, currentDay - 1))}
                        disabled={currentDay === 0}
                    >
                        <Ionicons name="arrow-back" size={20} color={currentDay === 0 ? Colors.dark.textSecondary : Colors.dark.text} />
                        <Text style={[styles.navButtonText, currentDay === 0 && styles.navButtonTextDisabled]}>
                            Previous
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.navButton,
                            currentDay === plan.plan.daily_schedule.length - 1 && styles.navButtonDisabled,
                        ]}
                        onPress={() => setCurrentDay(Math.min(plan.plan.daily_schedule.length - 1, currentDay + 1))}
                        disabled={currentDay === plan.plan.daily_schedule.length - 1}
                    >
                        <Text style={[
                            styles.navButtonText,
                            currentDay === plan.plan.daily_schedule.length - 1 && styles.navButtonTextDisabled,
                        ]}>
                            Next
                        </Text>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color={currentDay === plan.plan.daily_schedule.length - 1 ? Colors.dark.textSecondary : Colors.dark.text}
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
    errorText: {
        color: Colors.dark.error,
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        marginTop: Spacing.xl,
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    headerMetaText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: Spacing.lg,
    },
    scheduleContainer: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    scheduleScroll: {
        marginHorizontal: -Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    dayCard: {
        width: 120,
        padding: Spacing.md,
        marginRight: Spacing.sm,
        borderRadius: 12,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    dayCardActive: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    dayCardCompleted: {
        backgroundColor: Colors.dark.accent + '10',
        borderColor: Colors.dark.accent + '30',
        opacity: 0.7,
    },
    dayCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    dayNumber: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.textSecondary,
    },
    dayNumberActive: {
        color: Colors.dark.text,
    },
    dayTopic: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
    },
    dayTopicActive: {
        color: Colors.dark.text,
    },
    taskContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
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
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    taskDay: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
    },
    taskDate: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.dark.accent + '20',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.dark.accent + '30',
    },
    completedText: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.accent,
        fontWeight: Typography.weights.semibold,
    },
    taskTopic: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.dark.primary + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.dark.primary + '30',
        marginBottom: Spacing.md,
    },
    typeBadgeText: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.primary,
        fontWeight: Typography.weights.semibold,
    },
    descriptionCard: {
        backgroundColor: '#00000066',
        padding: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: Spacing.md,
    },
    descriptionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    descriptionHeaderText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.text,
    },
    descriptionText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        lineHeight: 20,
    },
    questionsCard: {
        backgroundColor: Colors.dark.primary + '05',
        padding: Spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.primary + '20',
    },
    questionsTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.primary,
        marginBottom: Spacing.sm,
    },
    questionItem: {
        backgroundColor: '#00000040',
        padding: Spacing.sm,
        borderRadius: 8,
        marginBottom: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    questionText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        lineHeight: 18,
    },
    notesContainer: {
        marginBottom: Spacing.lg,
    },
    notesLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
    },
    notesInput: {
        backgroundColor: '#00000040',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 12,
        padding: Spacing.md,
        fontSize: Typography.sizes.sm,
        color: Colors.dark.text,
        minHeight: 100,
    },
    completeButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
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
        fontWeight: Typography.weights.bold,
        color: '#000',
    },
    navigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    navButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.dark.surface,
        paddingVertical: Spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.text,
        fontWeight: Typography.weights.semibold,
    },
    navButtonTextDisabled: {
        color: Colors.dark.textSecondary,
    },
});
