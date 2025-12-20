import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Animated,
    Dimensions,
    Vibration,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

interface Todo {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
}

export default function ToolsScreen() {
    const [activeTab, setActiveTab] = useState<'timer' | 'todo'>('timer');

    // Timer State
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState<'work' | 'break'>('work');
    const [sessionCount, setSessionCount] = useState(0);

    // Settings State
    const [workMinutes, setWorkMinutes] = useState('25');
    const [breakMinutes, setBreakMinutes] = useState('5');
    const [showSettings, setShowSettings] = useState(false);

    // Todo State
    const [todos, setTodos] = useState<Todo[]>([]);
    const [newTodo, setNewTodo] = useState('');
    const [priority, setPriority] = useState<Todo['priority']>('medium');

    const timerRef = useRef<any>(null);
    const progressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        saveData();
    }, [todos, sessionCount]);

    const loadData = async () => {
        try {
            const savedTodos = await AsyncStorage.getItem('studybud_todos');
            const savedSessions = await AsyncStorage.getItem('studybud_sessions');
            if (savedTodos) setTodos(JSON.parse(savedTodos));
            if (savedSessions) setSessionCount(parseInt(savedSessions));
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const saveData = async () => {
        try {
            await AsyncStorage.setItem('studybud_todos', JSON.stringify(todos));
            await AsyncStorage.setItem('studybud_sessions', sessionCount.toString());
        } catch (e) {
            console.error('Failed to save data', e);
        }
    };

    // Timer Logic
    useEffect(() => {
        if (isActive && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            handleComplete();
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, timeLeft]);

    const handleComplete = async () => {
        setIsActive(false);
        Vibration.vibrate([0, 500, 200, 500]);

        // Play sound
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
                { shouldPlay: true }
            );
            await sound.playAsync();
        } catch (e) {
            console.log('Sound error:', e);
        }

        if (mode === 'work') {
            setMode('break');
            setTimeLeft(parseInt(breakMinutes) * 60);
            setSessionCount(prev => prev + 1);
        } else {
            setMode('work');
            setTimeLeft(parseInt(workMinutes) * 60);
        }
    };

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(mode === 'work' ? parseInt(workMinutes) * 60 : parseInt(breakMinutes) * 60);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Todo Logic
    const addTodo = () => {
        if (!newTodo.trim()) return;
        const task: Todo = {
            id: Date.now().toString(),
            text: newTodo.trim(),
            completed: false,
            priority,
        };
        setTodos([task, ...todos]);
        setNewTodo('');
    };

    const toggleTodo = (id: string) => {
        setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTodo = (id: string) => {
        setTodos(todos.filter(t => t.id !== id));
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.dark.background, Colors.dark.backgroundSecondary]}
                style={StyleSheet.absoluteFill}
            />

            {/* Header Tabs */}
            <View style={styles.header}>
                <BlurView intensity={80} tint="dark" style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'timer' && styles.activeTab]}
                        onPress={() => setActiveTab('timer')}
                    >
                        <Ionicons name="timer" size={20} color={activeTab === 'timer' ? Colors.dark.primary : Colors.dark.textSecondary} />
                        <Text style={[styles.tabText, activeTab === 'timer' && styles.activeTabText]}>Timer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'todo' && styles.activeTab]}
                        onPress={() => setActiveTab('todo')}
                    >
                        <Ionicons name="list" size={20} color={activeTab === 'todo' ? Colors.dark.primary : Colors.dark.textSecondary} />
                        <Text style={[styles.tabText, activeTab === 'todo' && styles.activeTabText]}>Tasks</Text>
                    </TouchableOpacity>
                </BlurView>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {activeTab === 'timer' ? (
                    <View style={styles.timerCenter}>
                        <View style={styles.timerCircle}>
                            <View style={[styles.timerCircleInner, { borderColor: mode === 'work' ? Colors.dark.primary : Colors.dark.accent }]}>
                                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                                <Text style={styles.modeText}>{mode === 'work' ? 'FOCUS' : 'BREAK'}</Text>
                            </View>
                        </View>

                        <View style={styles.controls}>
                            <TouchableOpacity style={styles.controlBtn} onPress={resetTimer}>
                                <Ionicons name="refresh" size={28} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.playBtn} onPress={toggleTimer}>
                                <LinearGradient
                                    colors={isActive ? ['#ff4d4d', '#ff0000'] : [Colors.dark.primary, Colors.dark.secondary]}
                                    style={styles.playGradient}
                                >
                                    <Ionicons name={isActive ? "pause" : "play"} size={32} color="#fff" style={!isActive && { marginLeft: 4 }} />
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.controlBtn} onPress={() => setShowSettings(!showSettings)}>
                                <Ionicons name="settings" size={28} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {showSettings && (
                            <BlurView intensity={40} style={styles.settingsPanel}>
                                <Text style={styles.settingsTitle}>Custom Durations</Text>
                                <View style={styles.settingRow}>
                                    <View style={styles.settingItem}>
                                        <Text style={styles.settingLabel}>Focus (min)</Text>
                                        <TextInput
                                            style={styles.settingInput}
                                            value={workMinutes}
                                            onChangeText={setWorkMinutes}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.dark.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.settingItem}>
                                        <Text style={styles.settingLabel}>Break (min)</Text>
                                        <TextInput
                                            style={styles.settingInput}
                                            value={breakMinutes}
                                            onChangeText={setBreakMinutes}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.dark.textSecondary}
                                        />
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.applyBtn}
                                    onPress={() => {
                                        setShowSettings(false);
                                        resetTimer();
                                    }}
                                >
                                    <Text style={styles.applyBtnText}>Apply Settings</Text>
                                </TouchableOpacity>
                            </BlurView>
                        )}

                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{sessionCount}</Text>
                                <Text style={styles.statLabel}>Sessions</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{sessionCount * parseInt(workMinutes)}</Text>
                                <Text style={styles.statLabel}>Min Focused</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.todoContent}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.todoInput}
                                placeholder="Add a new task..."
                                placeholderTextColor={Colors.dark.textSecondary}
                                value={newTodo}
                                onChangeText={setNewTodo}
                            />
                            <TouchableOpacity style={styles.addButton} onPress={addTodo}>
                                <LinearGradient
                                    colors={[Colors.dark.primary, Colors.dark.secondary]}
                                    style={styles.addGradient}
                                >
                                    <Ionicons name="add" size={28} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.priorityRow}>
                            {(['low', 'medium', 'high'] as const).map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
                                    onPress={() => setPriority(p)}
                                >
                                    <Text style={[styles.priorityBtnText, priority === p && styles.priorityBtnTextActive]}>
                                        {p.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {todos.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="checkbox-outline" size={64} color={Colors.dark.border} />
                                <Text style={styles.emptyText}>No tasks yet</Text>
                            </View>
                        ) : (
                            todos.map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.todoItem}
                                    onPress={() => toggleTodo(item.id)}
                                >
                                    <BlurView intensity={20} style={styles.todoBlur}>
                                        <View style={styles.todoLeft}>
                                            <Ionicons
                                                name={item.completed ? "checkmark-circle" : "circle-outline"}
                                                size={24}
                                                color={item.completed ? Colors.dark.accent : Colors.dark.primary}
                                            />
                                            <Text style={[
                                                styles.todoText,
                                                item.completed && styles.todoTextCompleted,
                                                { borderLeftColor: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#3b82f6' }
                                            ]}>
                                                {item.text}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => deleteTodo(item.id)}>
                                            <Ionicons name="trash-outline" size={20} color={Colors.dark.textSecondary} />
                                        </TouchableOpacity>
                                    </BlurView>
                                </TouchableOpacity>
                            ))
                        )}
                    </KeyboardAvoidingView>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    tabContainer: {
        flexDirection: 'row',
        borderRadius: 20,
        overflow: 'hidden',
        padding: 5,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        borderRadius: 15,
    },
    activeTab: {
        backgroundColor: 'rgba(0, 243, 255, 0.15)',
    },
    tabText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    activeTabText: {
        color: Colors.dark.primary,
    },
    scrollContent: {
        paddingTop: 40,
        paddingBottom: 150,
    },
    timerCenter: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    timerCircle: {
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: (width * 0.7) / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    timerCircleInner: {
        width: width * 0.65,
        height: width * 0.65,
        borderRadius: (width * 0.65) / 2,
        borderWidth: 6,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        color: Colors.dark.text,
        fontSize: 64,
        fontWeight: Typography.weights.bold,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    modeText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.md,
        letterSpacing: 4,
        marginTop: 10,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
        marginBottom: 40,
    },
    controlBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtn: {
        width: 90,
        height: 90,
        borderRadius: 45,
        elevation: 10,
        shadowColor: Colors.dark.primary,
        shadowRadius: 15,
        shadowOpacity: 0.3,
    },
    playGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    settingsPanel: {
        width: '100%',
        padding: 20,
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 30,
    },
    settingsTitle: {
        color: Colors.dark.text,
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: 20,
    },
    settingRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 20,
    },
    settingItem: {
        flex: 1,
    },
    settingLabel: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.xs,
        marginBottom: 8,
    },
    settingInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        color: Colors.dark.text,
        fontSize: Typography.sizes.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    applyBtn: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 15,
        padding: 15,
        alignItems: 'center',
    },
    applyBtnText: {
        color: '#000',
        fontWeight: Typography.weights.bold,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statValue: {
        color: Colors.dark.primary,
        fontSize: 24,
        fontWeight: Typography.weights.bold,
    },
    statLabel: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        marginTop: 4,
    },
    todoContent: {
        paddingHorizontal: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 15,
    },
    todoInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 15,
        padding: 15,
        color: Colors.dark.text,
        fontSize: Typography.sizes.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    addButton: {
        width: 58,
        height: 58,
        borderRadius: 15,
    },
    addGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    priorityRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 25,
    },
    priorityBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    priorityBtnActive: {
        backgroundColor: 'rgba(0, 243, 255, 0.1)',
        borderColor: Colors.dark.primary,
    },
    priorityBtnText: {
        color: Colors.dark.textSecondary,
        fontSize: 10,
        fontWeight: Typography.weights.bold,
    },
    priorityBtnTextActive: {
        color: Colors.dark.primary,
    },
    todoItem: {
        marginBottom: 12,
        borderRadius: 18,
        overflow: 'hidden',
    },
    todoBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    todoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    todoText: {
        color: Colors.dark.text,
        fontSize: 15,
        borderLeftWidth: 3,
        paddingLeft: 10,
        flex: 1,
    },
    todoTextCompleted: {
        textDecorationLine: 'line-through',
        opacity: 0.5,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        opacity: 0.3,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        marginTop: 10,
        fontSize: Typography.sizes.md,
    },
});
