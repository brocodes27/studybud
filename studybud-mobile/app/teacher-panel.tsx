import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Typography } from '../constants/theme';

interface Class {
    id: string;
    name: string;
    subject: string;
    teacher_id: string;
    student_count?: number;
}

export default function TeacherPanelScreen() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [newClassSubject, setNewClassSubject] = useState('');
    const [creating, setCreating] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (user) {
            fetchClasses();
        }
    }, [user]);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.replace('/auth/login');
            return;
        }

        // Check if user is a teacher
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (profile?.role !== 'teacher') {
            Alert.alert('Access Denied', 'You must be a teacher to access this panel.');
            router.replace('/');
            return;
        }

        setUser(session.user);
    };

    const fetchClasses = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('teacher_id', user.id);

        if (error) {
            console.error('Error fetching classes:', error);
            setLoading(false);
            return;
        }

        // Fetch student count for each class
        const classesWithCounts = await Promise.all(
            (data || []).map(async (cls) => {
                const { count } = await supabase
                    .from('class_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_id', cls.id);

                return {
                    ...cls,
                    student_count: count || 0,
                };
            })
        );

        setClasses(classesWithCounts);
        setLoading(false);
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim() || !newClassSubject.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setCreating(true);
        const { data, error } = await supabase
            .from('classes')
            .insert([{
                name: newClassName.trim(),
                teacher_id: user.id,
                subject: newClassSubject.trim(),
                class_code: generateClassCode(),
            }])
            .select();

        setCreating(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else if (data && data.length > 0) {
            setShowCreateModal(false);
            setNewClassName('');
            setNewClassSubject('');
            fetchClasses();
            Alert.alert('Success', 'Class created successfully!');
        }
    };

    const generateClassCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={Colors.dark.accent} />
                    <Text style={styles.loadingText}>Loading your classes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.gradient}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Teacher Panel</Text>
                        <Text style={styles.subtitle}>Manage your classes and students</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => setShowCreateModal(true)}
                    >
                        <LinearGradient
                            colors={[Colors.dark.accent, '#00ff80']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.createButtonGradient}
                        >
                            <Ionicons name="add" size={24} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Classes List */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {classes.length === 0 ? (
                        <View style={styles.emptyState}>
                            <BlurView intensity={20} style={styles.emptyBlur}>
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="school-outline" size={64} color={Colors.dark.textSecondary} />
                                </View>
                                <Text style={styles.emptyTitle}>No classes yet</Text>
                                <Text style={styles.emptyText}>Create your first class to start managing students</Text>
                                <TouchableOpacity
                                    style={styles.emptyButton}
                                    onPress={() => setShowCreateModal(true)}
                                >
                                    <LinearGradient
                                        colors={[Colors.dark.accent, '#00ff80']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.emptyButtonGradient}
                                    >
                                        <Ionicons name="add" size={20} color="#000" />
                                        <Text style={styles.emptyButtonText}>Create Class</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    ) : (
                        <View style={styles.classesGrid}>
                            {classes.map((cls) => (
                                <TouchableOpacity
                                    key={cls.id}
                                    style={styles.classCard}
                                    onPress={() => router.push(`/teacher/class/${cls.id}`)}
                                    activeOpacity={0.8}
                                >
                                    <BlurView intensity={20} style={styles.classBlur}>
                                        <View style={styles.classHeader}>
                                            <View style={styles.classIconContainer}>
                                                <Ionicons name="book" size={24} color={Colors.dark.accent} />
                                            </View>
                                            <View style={styles.classInfo}>
                                                <Text style={styles.className} numberOfLines={1}>{cls.name}</Text>
                                                <Text style={styles.classSubject}>{cls.subject}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.classFooter}>
                                            <View style={styles.studentCount}>
                                                <Ionicons name="people" size={16} color={Colors.dark.textSecondary} />
                                                <Text style={styles.studentCountText}>{cls.student_count} Students</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
                                        </View>
                                    </BlurView>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Create Class Modal */}
                <Modal
                    visible={showCreateModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowCreateModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <BlurView intensity={40} style={styles.modalBlur}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Create New Class</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowCreateModal(false)}
                                        style={styles.modalClose}
                                    >
                                        <Ionicons name="close" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Class Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., Class 10 - Section A"
                                            placeholderTextColor={Colors.dark.textSecondary}
                                            value={newClassName}
                                            onChangeText={setNewClassName}
                                            editable={!creating}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Subject</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., Mathematics, Physics"
                                            placeholderTextColor={Colors.dark.textSecondary}
                                            value={newClassSubject}
                                            onChangeText={setNewClassSubject}
                                            editable={!creating}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={styles.createClassButton}
                                        onPress={handleCreateClass}
                                        disabled={creating}
                                    >
                                        <LinearGradient
                                            colors={creating ? ['#666', '#666'] : [Colors.dark.accent, '#00ff80']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.createClassGradient}
                                        >
                                            {creating ? (
                                                <ActivityIndicator color="#000" />
                                            ) : (
                                                <Text style={styles.createClassText}>Create Class</Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </BlurView>
                    </View>
                </Modal>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    gradient: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#fff',
        marginTop: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
    subtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    createButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    createButtonGradient: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: Spacing.lg,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xxl * 2,
    },
    emptyBlur: {
        padding: Spacing.xxl,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        maxWidth: 400,
    },
    emptyIconContainer: {
        marginBottom: Spacing.lg,
    },
    emptyTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: '#fff',
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    emptyButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    emptyButtonGradient: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    emptyButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#000',
    },
    classesGrid: {
        gap: Spacing.md,
    },
    classCard: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    classBlur: {
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
    },
    classHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    classIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(57, 255, 20, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    classInfo: {
        flex: 1,
    },
    className: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: '#fff',
        marginBottom: 4,
    },
    classSubject: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    classFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    studentCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    studentCountText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalBlur: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        overflow: 'hidden',
    },
    modalContent: {
        padding: Spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
    modalClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalForm: {
        gap: Spacing.lg,
    },
    inputGroup: {
        gap: Spacing.xs,
    },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.textSecondary,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        color: '#fff',
    },
    createClassButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: Spacing.md,
    },
    createClassGradient: {
        padding: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createClassText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#000',
    },
});
