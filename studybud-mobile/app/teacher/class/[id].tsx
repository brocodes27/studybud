import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Alert, Modal, TextInput, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../../lib/supabase';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = ['Students', 'Assignments', 'Announcements', 'Mock Test', 'Responses', 'Weaknesses', 'Resources'];

export default function TeacherClassDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [classDetails, setClassDetails] = useState<any>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [attempts, setAttempts] = useState<any[]>([]);
    const [attemptProfiles, setAttemptProfiles] = useState<Record<string, any>>({});

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Students');
    const [showActionModal, setShowActionModal] = useState(false);
    const [responseGroupMode, setResponseGroupMode] = useState<'assignment' | 'student'>('assignment');

    // Form Modals
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [showMockModal, setShowMockModal] = useState(false);
    const [showResourceModal, setShowResourceModal] = useState(false);

    // Form inputs
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newMessage, setNewMessage] = useState('');

    // Mock Test inputs
    const [dailyTopics, setDailyTopics] = useState('');
    const [mockQCount, setMockQCount] = useState('8');
    const [generatingMock, setGeneratingMock] = useState(false);

    useEffect(() => {
        if (id) {
            fetchClassDetails();
        }
    }, [id]);

    const fetchClassDetails = async () => {
        try {
            setLoading(true);

            // Fetch Class Info
            const { data: cls, error: clsError } = await supabase
                .from('classes')
                .select('*')
                .eq('id', id)
                .single();
            if (clsError) throw clsError;
            setClassDetails(cls);

            // Fetch Students
            const { data: members, error: memError } = await supabase
                .from('class_members')
                .select('user_id')
                .eq('class_id', id);
            if (memError) throw memError;

            let userIds: string[] = [];
            if (members && members.length > 0) {
                userIds = members.map(m => m.user_id);
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .in('id', userIds);

                if (profiles) {
                    const combined = members.map(m => {
                        const profile = profiles.find(p => p.id === m.user_id);
                        return { ...m, ...profile };
                    });
                    setStudents(combined);

                    // Create map for attempts
                    const map: Record<string, any> = {};
                    profiles.forEach(p => map[p.id] = p);
                    setAttemptProfiles(map);
                }
            } else {
                setStudents([]);
            }

            // Fetch Assignments
            const { data: assign } = await supabase.from('assignments').select('*').eq('class_id', id).order('created_at', { ascending: false });
            setAssignments(assign || []);

            // Fetch Announcements
            const { data: announce } = await supabase.from('class_announcements').select('*').eq('class_id', id).order('created_at', { ascending: false });
            setAnnouncements(announce || []);

            // Fetch Resources
            const { data: res } = await supabase.from('class_resources').select('*').eq('class_id', id).order('created_at', { ascending: false });
            setResources(res || []);

            // Fetch Attempts
            if (userIds.length > 0) {
                const { data: attemptData } = await supabase
                    .from('cbse_exam_attempts')
                    .select('*')
                    .in('user_id', userIds)
                    .order('exam_date', { ascending: false })
                    .limit(50);
                setAttempts(attemptData || []);
            }

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnnouncement = async () => {
        if (!newMessage.trim()) return Alert.alert('Error', 'Message required');
        try {
            const { error } = await supabase.from('class_announcements').insert({
                class_id: id,
                message: newMessage.trim()
            });
            if (error) throw error;
            Alert.alert('Success', 'Announcement posted');
            setNewMessage('');
            setShowAnnouncementModal(false);
            fetchClassDetails();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleCreateAssignment = async () => {
        if (!newTitle.trim()) return Alert.alert('Error', 'Title required');
        try {
            const { error } = await supabase.from('assignments').insert({
                class_id: id,
                title: newTitle.trim(),
                description: newDesc.trim(),
                due_date: newDueDate || null,
                file_url: newUrl || null
            });
            if (error) throw error;
            Alert.alert('Success', 'Assignment created');
            setNewTitle(''); setNewDesc(''); setNewDueDate(''); setNewUrl('');
            setShowAssignmentModal(false);
            fetchClassDetails();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleGenerateMock = async () => {
        if (!dailyTopics.trim()) return Alert.alert('Error', 'Topics required');
        setGeneratingMock(true);
        try {
            const { data: funcData, error: funcError } = await supabase.functions.invoke('teacher-generate-mock', {
                body: { dailyTopics, mockQuestionCount: parseInt(mockQCount) || 8 }
            });
            if (funcError) throw new Error(funcError.message);

            // Clean content similar to web app logic
            const clean = funcData.content || funcData;

            // For MVP mobile: Create assignment with the text.
            let preview = typeof clean === 'string' ? clean : JSON.stringify(clean);
            if (typeof clean === 'object' && clean.questions) {
                preview = clean.questions.map((q: any, i: number) => `${i + 1}. ${q.question} (${q.marks} marks)`).join('\n');
            }

            // Create assignment
            const today = new Date();
            await supabase.from('assignments').insert({
                class_id: id,
                title: `Mock Test - ${today.toLocaleDateString()}`,
                description: `Topics: ${dailyTopics}\n\n${preview}`,
                is_mock: true,
            });

            // Announcement
            await supabase.from('class_announcements').insert({
                class_id: id,
                message: `New Mock Test generated based on: ${dailyTopics}`
            });

            Alert.alert('Success', 'Mock Test Generated & Posted!');
            setDailyTopics('');
            setShowMockModal(false);
            fetchClassDetails();

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setGeneratingMock(false);
        }
    };

    const handleAddResource = async () => {
        if (!newTitle.trim() || !newUrl.trim()) return Alert.alert('Error', 'Title & URL required');
        try {
            const { error } = await supabase.from('class_resources').insert({
                class_id: id,
                title: newTitle,
                url: newUrl,
                type: 'link'
            });
            if (error) throw error;
            Alert.alert('Success', 'Resource added');
            setNewTitle(''); setNewUrl('');
            setShowResourceModal(false);
            fetchClassDetails();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const renderHeader = () => (
        <LinearGradient
            colors={[Colors.dark.surface, Colors.dark.background]}
            style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
        >
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Class Details</Text>
                <TouchableOpacity style={styles.settingsButton} onPress={() => setShowActionModal(true)}>
                    <Ionicons name="add-circle" size={28} color={Colors.dark.accent} />
                </TouchableOpacity>
            </View>

            {classDetails && (
                <View style={styles.classBanner}>
                    <View style={styles.bannerIcon}>
                        <Ionicons name="school" size={32} color={Colors.dark.accent} />
                    </View>
                    <View style={styles.bannerContent}>
                        <Text style={styles.className}>{classDetails.name}</Text>
                        <Text style={styles.classSubject}>{classDetails.subject} • {classDetails.class_code}</Text>
                    </View>
                </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </LinearGradient>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Students':
                return (
                    <FlatList
                        data={students}
                        keyExtractor={item => item.user_id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No students</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.card}>
                                <View style={styles.avatar}><Text style={styles.avatarText}>{item.full_name?.[0] || 'S'}</Text></View>
                                <View>
                                    <Text style={styles.cardTitle}>{item.full_name || 'Student'}</Text>
                                    <Text style={styles.cardSub}>{item.email}</Text>
                                </View>
                            </View>
                        )}
                    />
                );
            case 'Assignments':
                return (
                    <FlatList
                        data={assignments}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No assignments</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.card}>
                                <Ionicons name="document-text" size={24} color={Colors.dark.primary} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text>
                                    {item.due_date && <Text style={styles.metaText}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>}
                                </View>
                            </View>
                        )}
                    />
                );
            case 'Announcements':
                return (
                    <FlatList
                        data={announcements}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No announcements</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.card}>
                                <Ionicons name="megaphone" size={24} color={Colors.dark.accent} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardSub}>{item.message || item.content}</Text>
                                    <Text style={styles.metaText}>{new Date(item.created_at).toLocaleString()}</Text>
                                </View>
                            </View>
                        )}
                    />
                );
            case 'Resources':
                return (
                    <FlatList
                        data={resources}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No resources</Text>}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.card} onPress={() => item.url && Linking.openURL(item.url)}>
                                <Ionicons name="link" size={24} color={Colors.dark.secondary} style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <Text style={styles.cardSub} numberOfLines={1}>{item.url}</Text>
                                </View>
                                <Ionicons name="open-outline" size={20} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        )}
                    />
                );
            case 'Responses':
                return (
                    <View style={{ flex: 1 }}>
                        <View style={styles.groupToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, responseGroupMode === 'assignment' && styles.toggleBtnActive]}
                                onPress={() => setResponseGroupMode('assignment')}
                            >
                                <Text style={[styles.toggleText, responseGroupMode === 'assignment' && styles.toggleTextActive]}>By Exam</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, responseGroupMode === 'student' && styles.toggleBtnActive]}
                                onPress={() => setResponseGroupMode('student')}
                            >
                                <Text style={[styles.toggleText, responseGroupMode === 'student' && styles.toggleTextActive]}>By Student</Text>
                            </TouchableOpacity>
                        </View>
                        {responseGroupMode === 'assignment' ? (
                            <FlatList
                                data={assignments.filter(as => attempts.some(at => at.assignment_id === as.id))}
                                keyExtractor={item => item.id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={<Text style={styles.emptyText}>No responses yet</Text>}
                                renderItem={({ item: assn }) => (
                                    <View style={styles.groupSection}>
                                        <Text style={styles.groupHeader}>{assn.title}</Text>
                                        {attempts.filter(at => at.assignment_id === assn.id).map(at => {
                                            const student = attemptProfiles[at.user_id];
                                            return (
                                                <TouchableOpacity
                                                    key={at.id}
                                                    style={styles.nestedCard}
                                                    onPress={() => router.push({ pathname: '/teacher/student-weakness/[userId]', params: { userId: at.user_id, classId: id } })}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.cardTitle}>{student?.full_name || 'Student'}</Text>
                                                        <Text style={styles.cardSub}>Score: {at.total_score !== null ? at.total_score : 'Pending'} / {at.max_score || '?'}</Text>
                                                    </View>
                                                    <View style={[styles.badge, { backgroundColor: at.total_score !== null ? Colors.dark.success + '20' : Colors.dark.warning + '20' }]}>
                                                        <Text style={[styles.badgeText, { color: at.total_score !== null ? Colors.dark.success : Colors.dark.warning }]}>{at.total_score !== null ? 'Graded' : 'Pending'}</Text>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={14} color={Colors.dark.textSecondary} style={{ marginLeft: 8 }} />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            />
                        ) : (
                            <FlatList
                                data={students.filter(s => attempts.some(at => at.user_id === s.id || at.user_id === s.user_id))}
                                keyExtractor={item => item.id || item.user_id}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={<Text style={styles.emptyText}>No responses yet</Text>}
                                renderItem={({ item: s }) => (
                                    <TouchableOpacity
                                        style={styles.card}
                                        onPress={() => router.push({ pathname: '/teacher/student-weakness/[userId]', params: { userId: s.id || s.user_id, classId: id } })}
                                    >
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>{s.full_name?.[0] || '?'}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardTitle}>{s.full_name || s.email}</Text>
                                            <Text style={styles.cardSub}>
                                                {(attempts || []).filter(at => at.user_id === s.id || at.user_id === s.user_id).length} assessments completed
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                );
            case 'Weaknesses':
                return (
                    <FlatList
                        data={students.filter(s => attempts.some(at => (at.user_id === s.id || at.user_id === s.user_id) && at.student_weaknesses))}
                        keyExtractor={item => item.id || item.user_id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No weakness data found</Text>}
                        renderItem={({ item: s }) => (
                            <TouchableOpacity
                                style={[styles.card, { borderLeftWidth: 4, borderLeftColor: Colors.dark.warning }]}
                                onPress={() => router.push({ pathname: '/teacher/student-weakness/[userId]', params: { userId: s.id || s.user_id, classId: id } })}
                            >
                                <View style={[styles.avatar, { backgroundColor: Colors.dark.warning + '20' }]}>
                                    <Text style={[styles.avatarText, { color: Colors.dark.warning }]}>{s.full_name?.[0] || '?'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>{s.full_name || s.email}</Text>
                                    <Text style={styles.cardSub}>
                                        {(attempts || []).filter(at => (at.user_id === s.id || at.user_id === s.user_id) && at.student_weaknesses).length} AI insights available
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        )}
                    />
                );
            case 'Mock Test':
                return (
                    <View style={styles.centerTab}>
                        <Ionicons name="flash" size={48} color={Colors.dark.accent} />
                        <Text style={styles.centerTitle}>Generate AI Mock Test</Text>
                        <Text style={styles.centerText}>Create a customized test based on topics taught today.</Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowMockModal(true)}>
                            <Text style={styles.btnText}>Configure & Generate</Text>
                        </TouchableOpacity>
                    </View>
                );
            default: return null;
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={Colors.dark.primary} style={styles.loader} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderHeader()}
            <View style={styles.content}>{renderTabContent()}</View>

            {/* Main Action Modal */}
            <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionModal(false)}>
                    <BlurView intensity={20} style={styles.actionSheet}>
                        <Text style={styles.sheetTitle}>Quick Actions</Text>
                        <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowActionModal(false); setShowAssignmentModal(true); }}>
                            <Ionicons name="document-text" size={24} color={Colors.dark.primary} />
                            <Text style={styles.sheetBtnText}>Create Assignment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowActionModal(false); setShowAnnouncementModal(true); }}>
                            <Ionicons name="megaphone" size={24} color={Colors.dark.accent} />
                            <Text style={styles.sheetBtnText}>Post Announcement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowActionModal(false); setShowMockModal(true); }}>
                            <Ionicons name="flash" size={24} color={Colors.dark.secondary} />
                            <Text style={styles.sheetBtnText}>Generate Mock Test</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowActionModal(false); setShowResourceModal(true); }}>
                            <Ionicons name="link" size={24} color="#fff" />
                            <Text style={styles.sheetBtnText}>Add Resource</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowActionModal(false)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </BlurView>
                </TouchableOpacity>
            </Modal>

            {/* Announcement Modal */}
            <Modal visible={showAnnouncementModal} transparent animationType="slide" onRequestClose={() => setShowAnnouncementModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>New Announcement</Text>
                        <TextInput style={styles.inputArea} placeholder="Message..." placeholderTextColor="#666" multiline value={newMessage} onChangeText={setNewMessage} />
                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAnnouncement}><Text style={styles.btnText}>Post</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Assignment Modal */}
            <Modal visible={showAssignmentModal} transparent animationType="slide" onRequestClose={() => setShowAssignmentModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>New Assignment</Text>
                        <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#666" value={newTitle} onChangeText={setNewTitle} />
                        <TextInput style={styles.inputArea} placeholder="Description..." placeholderTextColor="#666" multiline value={newDesc} onChangeText={setNewDesc} />
                        <TextInput style={styles.input} placeholder="Due Date (YYYY-MM-DD)" placeholderTextColor="#666" value={newDueDate} onChangeText={setNewDueDate} />
                        <TextInput style={styles.input} placeholder="File URL (Optional)" placeholderTextColor="#666" value={newUrl} onChangeText={setNewUrl} />
                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={() => setShowAssignmentModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAssignment}><Text style={styles.btnText}>Create</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Resource Modal */}
            <Modal visible={showResourceModal} transparent animationType="slide" onRequestClose={() => setShowResourceModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Add Resource</Text>
                        <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#666" value={newTitle} onChangeText={setNewTitle} />
                        <TextInput style={styles.input} placeholder="URL" placeholderTextColor="#666" value={newUrl} onChangeText={setNewUrl} />
                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={() => setShowResourceModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleAddResource}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Mock Test Modal */}
            <Modal visible={showMockModal} transparent animationType="slide" onRequestClose={() => setShowMockModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Generate Mock Test</Text>
                        <Text style={styles.label}>What topics were taught today?</Text>
                        <TextInput style={styles.inputArea} placeholder="e.g. Thermodynamics, Laws of Motion..." placeholderTextColor="#666" multiline value={dailyTopics} onChangeText={setDailyTopics} />
                        <Text style={styles.label}>Number of Questions</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={mockQCount} onChangeText={setMockQCount} />

                        <TouchableOpacity style={styles.magicBtn} onPress={handleGenerateMock} disabled={generatingMock}>
                            {generatingMock ? <ActivityIndicator color="#000" /> : (
                                <LinearGradient colors={['#00f3ff', '#00ff80']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientBtn}>
                                    <Ionicons name="sparkles" size={20} color="#000" style={{ marginRight: 8 }} />
                                    <Text style={styles.magicBtnText}>Generate with AI</Text>
                                </LinearGradient>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowMockModal(false)} style={{ marginTop: 16, alignSelf: 'center' }}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    backButton: { padding: 4 },
    headerTitle: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, color: Colors.dark.text },
    settingsButton: { padding: 4 },
    classBanner: { paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    bannerIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(57, 255, 20, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
    bannerContent: { flex: 1 },
    className: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, color: '#fff' },
    classSubject: { fontSize: Typography.sizes.sm, color: Colors.dark.textSecondary },
    tabsScroll: { maxHeight: 50 },
    tabsContent: { paddingHorizontal: Spacing.md, gap: 8 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    activeTab: { backgroundColor: Colors.dark.primary + '20', borderColor: Colors.dark.primary },
    tabText: { color: Colors.dark.textSecondary, fontWeight: '600' },
    activeTabText: { color: Colors.dark.primary },
    content: { flex: 1 },
    listContent: { padding: Spacing.lg, gap: 12 },
    card: { backgroundColor: Colors.dark.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
    cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.dark.text, marginBottom: 4 },
    cardSub: { fontSize: 14, color: Colors.dark.textSecondary },
    metaText: { fontSize: 12, color: Colors.dark.accent, marginTop: 4 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontWeight: 'bold' },
    emptyText: { color: Colors.dark.textSecondary, textAlign: 'center', marginTop: 40 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    actionSheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
    sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    sheetBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.dark.surface, borderRadius: 12, gap: 12 },
    sheetBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
    cancelBtnText: { color: Colors.dark.error, fontSize: 16, fontWeight: '600' },
    formCard: { backgroundColor: '#1a1a2e', margin: 20, padding: 20, borderRadius: 20, alignSelf: 'center', width: '90%', maxWidth: 400, marginTop: 100 },
    formTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    inputArea: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', height: 100, textAlignVertical: 'top' },
    formActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    submitBtn: { backgroundColor: Colors.dark.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    btnText: { color: '#fff', fontWeight: 'bold' },
    cancelText: { color: Colors.dark.textSecondary },
    centerTab: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    centerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    centerText: { color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 24 },
    primaryBtn: { backgroundColor: Colors.dark.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    label: { color: Colors.dark.textSecondary, marginBottom: 8, fontSize: 14 },
    magicBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
    gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
    magicBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    groupToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', margin: 16, borderRadius: 12, padding: 4 },
    toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    toggleBtnActive: { backgroundColor: Colors.dark.primary },
    toggleText: { color: Colors.dark.textSecondary, fontWeight: '600' },
    toggleTextActive: { color: '#000' },
    groupSection: { marginBottom: 20 },
    groupHeader: { color: Colors.dark.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 4 },
    nestedCard: { backgroundColor: Colors.dark.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    cardColumn: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.dark.border },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    weaknessList: { gap: 12 },
    weaknessItem: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: Colors.dark.warning },
    weaknessDate: { fontSize: 10, color: Colors.dark.textSecondary, marginBottom: 4, fontWeight: 'bold' },
    weaknessText: { fontSize: 13, color: Colors.dark.text, lineHeight: 18 }
});
