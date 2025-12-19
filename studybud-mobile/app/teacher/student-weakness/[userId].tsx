import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../../lib/supabase';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StudentWeaknessDetailScreen() {
    const { userId, classId } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [student, setStudent] = useState<any>(null);
    const [attempts, setAttempts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [userId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch Student Profile
            const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
            setStudent(profile);

            // Fetch Attempts with weaknesses for this specific class
            const { data: attemptData } = await supabase
                .from('cbse_exam_attempts')
                .select('*')
                .eq('user_id', userId)
                .not('student_weaknesses', 'is', null)
                .order('exam_date', { ascending: false });

            setAttempts(attemptData || []);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loader]}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{student?.full_name || 'Student Detail'}</Text>
                    <Text style={styles.headerSub}>{student?.email}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statVal}>{attempts.length}</Text>
                        <Text style={styles.statLabel}>Assessments</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statVal}>
                            {attempts.length > 0
                                ? Math.round(attempts.reduce((acc, at) => acc + (at.total_score / at.max_score), 0) / attempts.length * 100)
                                : 0}%
                        </Text>
                        <Text style={styles.statLabel}>Avg Strength</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Performance Insights & Weaknesses</Text>

                {attempts.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name=" analytics-outline" size={48} color={Colors.dark.textSecondary} />
                        <Text style={styles.emptyText}>No weakness data recorded for this student yet.</Text>
                    </View>
                ) : (
                    attempts.map((at, i) => (
                        <View key={at.id || i} style={styles.weaknessCard}>
                            <LinearGradient
                                colors={['rgba(245, 158, 11, 0.15)', 'rgba(0,0,0,0)']}
                                style={styles.cardGlow}
                            />
                            <View style={styles.cardHeader}>
                                <Ionicons name="alert-circle" size={20} color={Colors.dark.warning} />
                                <Text style={styles.examTitle}>Mock Test • {new Date(at.exam_date).toLocaleDateString()}</Text>
                                <Text style={styles.scoreText}>{at.total_score}/{at.max_score}</Text>
                            </View>
                            <Text style={styles.weaknessText}>{at.student_weaknesses}</Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loader: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    backButton: { marginRight: 16 },
    headerContent: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    headerSub: { color: Colors.dark.textSecondary, fontSize: 14 },
    scrollContent: { padding: Spacing.lg },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    statVal: { color: Colors.dark.primary, fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 4 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    weaknessCard: { backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
    cardGlow: { ...StyleSheet.absoluteFillObject },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    examTitle: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: 'bold', flex: 1 },
    scoreText: { color: Colors.dark.primary, fontSize: 12, fontWeight: 'bold' },
    weaknessText: { color: '#eee', fontSize: 15, lineHeight: 22 },
    emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { color: Colors.dark.textSecondary, textAlign: 'center', fontSize: 14 }
});
