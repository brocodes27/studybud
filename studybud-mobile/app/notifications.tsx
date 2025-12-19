import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleNotificationPress = async (item: any) => {
        // Mark as read
        if (!item.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
            setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
        }

        // Handle navigation based on notification type/action_url
        if (item.action_url) {
            // Simple parsing to match mobile routes, assuming action_url is web-style
            if (item.action_url.includes('/teacher/class/')) {
                // Extract class ID and attempt ID if present
                const parts = item.action_url.split('/teacher/class/')[1].split('?');
                const classId = parts[0];
                router.push({ pathname: `/teacher/class/${classId}` });
            } else if (item.action_url.includes('/classes/')) {
                // Student class link
                const classId = item.action_url.split('/classes/')[1];
                router.push({ pathname: '/class-details', params: { id: classId } });
            } else {
                // Fallback or generic handling
                Alert.alert("Notification", item.message);
            }
        } else {
            Alert.alert("Notification", item.message);
        }
    };

    const markAllRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.dark.surface, Colors.dark.background]}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={styles.markReadText}>Mark all read</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.dark.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={64} color={Colors.dark.textSecondary} />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.notificationItem,
                                !item.is_read && styles.unreadItem
                            ]}
                            onPress={() => handleNotificationPress(item)}
                        >
                            <View style={styles.iconContainer}>
                                {item.title.includes('Video') ? (
                                    <View style={[styles.iconCircle, { backgroundColor: '#10B98120' }]}>
                                        <Ionicons name="videocam" size={20} color="#10B981" />
                                    </View>
                                ) : item.title.includes('Weakness') || item.title.includes('Exam') ? (
                                    <View style={[styles.iconCircle, { backgroundColor: '#F59E0B20' }]}>
                                        <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                                    </View>
                                ) : (
                                    <View style={[styles.iconCircle, { backgroundColor: '#3B82F620' }]}>
                                        <Ionicons name="notifications" size={20} color="#3B82F6" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.contentContainer}>
                                <Text style={[styles.itemTitle, !item.is_read && styles.unreadText]}>{item.title}</Text>
                                <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
                                <Text style={styles.itemTime}>{new Date(item.created_at).toLocaleString()}</Text>
                            </View>
                            {!item.is_read && <View style={styles.dot} />}
                        </TouchableOpacity>
                    )}
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
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    markReadText: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        fontSize: 16,
        marginTop: 16,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
        backgroundColor: Colors.dark.surface,
    },
    unreadItem: {
        backgroundColor: Colors.dark.backgroundSecondary, // Slightly lighter/diff bg for unread
    },
    iconContainer: {
        marginRight: 16,
        justifyContent: 'center',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    unreadText: {
        color: Colors.dark.primary, // Highlight unread title
    },
    itemMessage: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 8,
    },
    itemTime: {
        fontSize: 12,
        color: Colors.dark.accent,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.primary,
        alignSelf: 'center',
        marginLeft: 8,
    },
});
