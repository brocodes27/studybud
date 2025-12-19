import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerStyle: {
                    backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
                tabBarStyle: {
                    backgroundColor: Colors.dark.backgroundSecondary,
                    borderTopColor: Colors.dark.border,
                    borderTopWidth: 1,
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 5,
                },
                tabBarActiveTintColor: Colors.dark.primary,
                tabBarInactiveTintColor: Colors.dark.textSecondary,
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: 'Create',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={24} color={color} />
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
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'AI Chat',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
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
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerActive: {
        backgroundColor: Colors.dark.primary + '20',
    },
});
