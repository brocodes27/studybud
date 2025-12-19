import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Linking, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TABS = ['Overview', 'Assignments', 'Announcements'];

export default function ClassDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [classInfo, setClassInfo] = useState<any>(null);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        if (id) fetchClassData();
    }, [id]);

    const fetchClassData = async () => {
        try {
            setLoading(true);

            // Fetch class details
            const { data: classData, error: classError } = await supabase
                .from('classes')
                .select('*')
                .eq('id', id)
                .single();

            if (classError) throw classError;
            setClassInfo(classData);

            // Fetch assignments
            const { data: assignmentData } = await supabase
                .from('assignments')
                .select('*')
                .eq('class_id', id)
                .order('created_at', { ascending: false });

            setAssignments(assignmentData || []);

            // Fetch announcements
            const { data: announcementData } = await supabase
                .from('class_announcements')
                .select('*')
                .eq('class_id', id)
                .order('created_at', { ascending: false });

            setAnnouncements(announcementData || []);

        } catch (error) {
            console.error('Error fetching class details:', error);
            Alert.alert('Error', 'Failed to load class details');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLink = async (url: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert("Error", "Cannot open this link: " + url);
            }
        } catch (err) {
            console.error("Link err", err);
        }
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            );
        }

        switch (activeTab) {
            case 'Overview':
                return (
                    <ScrollView style={styles.tabContent}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Latest Updates</Text>
                        </View>

                        {/* Latest Announcement */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="notifications" size={20} color={Colors.dark.accent} />
                                <Text style={styles.cardTitle}>Latest Announcement</Text>
                            </View>
                            {announcements.length > 0 ? (
                                <Text style={styles.cardBody} numberOfLines={3}>
                                    {announcements[0].message || announcements[0].content}
                                </Text>
                            ) : (
                                <Text style={styles.emptyText}>No announcements yet.</Text>
                            )}
                        </View>

                        {/* Latest Assignment */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Ionicons name="document-text" size={20} color={Colors.dark.primary} />
                                <Text style={styles.cardTitle}>Latest Assignment</Text>
                            </View>
                            {assignments.length > 0 ? (
                                <View>
                                    <Text style={styles.cardBody} numberOfLines={2}>
                                        {assignments[0].title}
                                    </Text>
                                    {assignments[0].due_date && (
                                        <Text style={styles.dateText}>Due: {new Date(assignments[0].due_date).toLocaleDateString()}</Text>
                                    )}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>No assignments yet.</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.leaveButton}
                            onPress={() => {
                                Alert.alert("Leave Class", "Are you sure you want to leave?", [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Leave", style: "destructive", onPress: async () => {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (user) {
                                                await supabase.from('class_members').delete().eq('class_id', id).eq('user_id', user.id);
                                                router.back();
                                            }
                                        }
                                    }
                                ])
                            }}
                        >
                            <Text style={styles.leaveButtonText}>Leave Class</Text>
                        </TouchableOpacity>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                );
            case 'Assignments':
                return (
                    <FlatList
                        data={assignments}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No assignments found.</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.assignmentCard}>
                                <View style={styles.assignmentHeader}>
                                    <Text style={styles.assignmentTitle}>{item.title}</Text>
                                    {item.due_date && (
                                        <Text style={styles.dueDate}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
                                    )}
                                </View>
                                <Text style={styles.assignmentDesc}>{item.description}</Text>

                                <View style={styles.actionsRow}>
                                    {item.file_url && (
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleOpenLink(item.file_url)}
                                        >
                                            <Ionicons name="download-outline" size={16} color={Colors.dark.primary} />
                                            <Text style={styles.actionButtonText}>Attachment</Text>
                                        </TouchableOpacity>
                                    )}
                                    {item.file_url && /\.json(\?|$)/i.test(item.file_url) && (
                                        <TouchableOpacity
                                            style={[styles.actionButton, { borderColor: Colors.dark.success, backgroundColor: Colors.dark.success + '10' }]}
                                            onPress={async () => {
                                                try {
                                                    const res = await fetch(item.file_url);
                                                    if (!res.ok) throw new Error('Failed to fetch test');
                                                    const json = await res.json();
                                                    const qData = json.questions || json;

                                                    router.push({
                                                        pathname: '/exam-session',
                                                        params: {
                                                            questions: JSON.stringify(qData),
                                                            subject: classInfo?.class_name || 'Mock Test',
                                                            duration: 3 * 60 * 60
                                                        }
                                                    });
                                                } catch (err) {
                                                    Alert.alert("Error", "Could not load test content.");
                                                }
                                            }}
                                        >
                                            <Ionicons name="clipboard-outline" size={16} color={Colors.dark.success} />
                                            <Text style={[styles.actionButtonText, { color: Colors.dark.success }]}>Take Test</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    />
                );
            case 'Announcements':
                return (
                    <FlatList
                        data={announcements}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No announcements found.</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.announcementCard}>
                                <Text style={styles.announcementText}>{item.message || item.content}</Text>
                                <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleString()}</Text>
                            </View>
                        )}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.dark.backgroundSecondary, Colors.dark.background]}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>{classInfo?.class_name || 'Class Details'}</Text>
                    <Text style={styles.headerSubTitle}>Code: {classInfo?.class_code || '...'}</Text>
                </View>
            </LinearGradient>

            <View style={styles.tabsContainer}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {renderTabContent()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    headerSubTitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
    tabsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    activeTab: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    tabText: {
        color: Colors.dark.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: Colors.dark.primary,
    },
    tabContent: {
        flex: 1,
        padding: 16,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    card: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    cardBody: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        lineHeight: 20,
    },
    dateText: {
        fontSize: 12,
        color: Colors.dark.accent,
        marginTop: 4,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        fontStyle: 'italic',
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 40,
        color: Colors.dark.textSecondary,
        fontSize: 16,
    },
    leaveButton: {
        marginTop: 20,
        alignSelf: 'center',
        padding: 12,
    },
    leaveButtonText: {
        color: Colors.dark.error,
        fontWeight: '600',
    },
    assignmentCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    assignmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    assignmentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
        flex: 1,
        marginRight: 8,
    },
    dueDate: {
        fontSize: 12,
        color: Colors.dark.accent,
        backgroundColor: Colors.dark.accent + '10',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    assignmentDesc: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primary + '10',
        gap: 6,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    announcementCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.dark.accent,
    },
    announcementText: {
        fontSize: 14,
        color: Colors.dark.text,
        lineHeight: 20,
        marginBottom: 8,
    },
    timestamp: {
        fontSize: 11,
        color: Colors.dark.textSecondary,
        textAlign: 'right',
    },
});
