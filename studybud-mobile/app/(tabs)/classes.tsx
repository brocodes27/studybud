import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClassesScreen() {
    const router = useRouter();
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch classes where the user is a member
            const { data, error } = await supabase
                .from('class_members')
                .select('classes(*)')
                .eq('user_id', user.id);

            if (error) throw error;

            if (data) {
                const studentClasses = data.map((item: any) => item.classes).filter(Boolean);
                setClasses(studentClasses);
            }
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderClassItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                // Navigate to class details (if implemented on mobile) or show simple info
                // For now, simple alert or just opacity change
            }}
        >
            <LinearGradient
                colors={[Colors.dark.surface, Colors.dark.backgroundSecondary]}
                style={styles.cardGradient}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="school" size={24} color={Colors.dark.primary} />
                    </View>
                    <View style={styles.cardText}>
                        <Text style={styles.className}>{item.name || 'Unnamed Class'}</Text>
                        <Text style={styles.classInfo}>ID: {item.id.substring(0, 8)}...</Text>
                    </View>
                </View>
                {/* 
                <View style={styles.footer}>
                    <Text style={styles.footerText}>View Details <Ionicons name="arrow-forward" size={14} /></Text>
                </View>
                */}
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Classes</Text>
                {/* Add Join Button logic if needed later */}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            ) : classes.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="school-outline" size={64} color={Colors.dark.textSecondary} />
                    <Text style={styles.emptyText}>You haven't joined any classes yet.</Text>
                    <Text style={styles.emptySubText}>Ask your teacher for a Class ID to join.</Text>
                </View>
            ) : (
                <FlatList
                    data={classes}
                    renderItem={renderClassItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        padding: 20,
    },
    header: {
        marginBottom: 20,
        paddingTop: 40,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 100,
    },
    card: {
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    cardGradient: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: Colors.dark.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardText: {
        flex: 1,
    },
    className: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    classInfo: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
    emptyText: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    emptySubText: {
        marginTop: 8,
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
});
