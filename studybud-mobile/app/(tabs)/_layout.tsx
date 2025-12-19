import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 25,
                    left: 20,
                    right: 20,
                    elevation: 0,
                    backgroundColor: 'transparent',
                    borderRadius: 25,
                    height: 70,
                    borderTopWidth: 0,
                    shadowColor: '#000',
                    shadowOffset: {
                        width: 0,
                        height: 10,
                    },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.5,
                },
                tabBarBackground: () => (
                    <BlurView
                        tint="dark"
                        intensity={95}
                        style={[StyleSheet.absoluteFill, { borderRadius: 25, overflow: 'hidden', backgroundColor: 'rgba(26,26,46,0.85)' }]}
                    />
                ),
                tabBarShowLabel: false,
                tabBarActiveTintColor: Colors.dark.primary,
                tabBarInactiveTintColor: Colors.dark.textSecondary,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                            {focused && <View style={styles.glowDot} />}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="classes"
                options={{
                    title: 'Classes',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "school" : "school-outline"} size={24} color={color} />
                            {focused && <View style={styles.glowDot} />}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.createIconContainer]}>
                            <LinearGradient
                                colors={[Colors.dark.primary, Colors.dark.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.createGradient}
                            >
                                <Ionicons name="add" size={32} color="#fff" />
                            </LinearGradient>
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="plans"
                options={{
                    title: 'Plans',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "list" : "list-outline"} size={24} color={color} />
                            {focused && <View style={styles.glowDot} />}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="lessons"
                options={{
                    title: 'Lessons',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "play-circle" : "play-circle-outline"} size={24} color={color} />
                            {focused && <View style={styles.glowDot} />}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    href: null, // Hiding chat from tab bar if needed, or keeping it? User has 6 tabs.
                    // Tab bar fits 5 comfortably. 6 is crowded.
                    // 'home', 'classes', 'create', 'plans', 'lessons', 'chat', 'profile'. That's 7!
                    // I need to prioritize.
                    // 'home', 'classes', 'create', 'plans', 'profile'.
                    // 'lessons' and 'chat' can be in Quick Actions on Home.
                    // I will hide 'lessons' and 'chat' from the tab bar but keep the screens accessible.
                    tabBarButton: () => null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                            {focused && <View style={styles.glowDot} />}
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerActive: {
        backgroundColor: 'rgba(0, 243, 255, 0.1)',
    },
    glowDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.dark.primary,
        marginTop: 4,
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    createIconContainer: {
        top: -20, // Floating effect
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    createGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
});
