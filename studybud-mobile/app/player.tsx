import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { useVideoGeneration, ActiveGeneration } from '../lib/VideoGenerationContext';
import { Colors, Spacing, Typography } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Log {
    time: string;
    msg: string;
}

export default function PlayerScreen() {
    const { topic, planId, subject } = useLocalSearchParams<{ topic: string, planId: string, subject: string }>();
    const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [generationId, setGenerationId] = useState<string | null>(null);
    const [logs, setLogs] = useState<Log[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { trackGeneration, activeGenerations } = useVideoGeneration();
    const videoRef = useRef<Video>(null);

    useEffect(() => {
        checkExistingVideo();
    }, []);

    const checkExistingVideo = async () => {
        try {
            setStatus('idle');

            // 1. Check if we already have an active generation for this topic in context
            const activeGen = Array.from(activeGenerations.values()).find((g: ActiveGeneration) => g.topic === topic);
            if (activeGen) {
                setGenerationId(activeGen.id);
                setStatus('generating');
                subscribeToGeneration(activeGen.id);
                return;
            }

            // 2. Check if video already exists in completions or generations
            const { data, error } = await supabase
                .from('video_generations')
                .select('*')
                .eq('topic', topic)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                const latest = data[0];
                if (latest.status === 'completed' && latest.video_url) {
                    setVideoUrl(latest.video_url);
                    setStatus('ready');
                    return;
                } else if (latest.status === 'generating' || (latest.status === 'idle' && new Date().getTime() - new Date(latest.created_at).getTime() < 300000)) {
                    // If it's currently generating or was started recently (within 5 mins), attach to it
                    setGenerationId(latest.id);
                    trackGeneration(latest.id, topic);
                    setStatus('generating');
                    subscribeToGeneration(latest.id);
                    return;
                }
            }

            // If not found or stale, start generation
            startGeneration();
        } catch (err) {
            console.log('Error checking video:', err);
            startGeneration();
        }
    };

    const startGeneration = async () => {
        setStatus('generating');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // Call the video generation server
            // Note: This URL should be configured in your environment
            const serverUrl = process.env.EXPO_PUBLIC_VIDEO_SERVER_URL || 'http://localhost:3001';

            const response = await fetch(`${serverUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic,
                    userId: session.user.id,
                }),
            });

            const result = await response.json();
            if (result.success && result.generationId) {
                setGenerationId(result.generationId);
                trackGeneration(result.generationId, topic);
                subscribeToGeneration(result.generationId);
            } else {
                throw new Error(result.error || 'Failed to start generation');
            }
        } catch (err: any) {
            console.error('Error starting generation:', err);
            setError(err.message || 'Failed to start video generation. Make sure the generation server is running.');
            setStatus('error');
        }
    };

    const subscribeToGeneration = (id: string) => {
        const channel = supabase
            .channel(`generation-${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'video_generations', filter: `id=eq.${id}` },
                (payload) => {
                    const newItem = payload.new as any;

                    if (newItem.current_step) {
                        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: newItem.current_step }]);
                    }

                    if (newItem.status === 'completed' && newItem.video_url) {
                        setVideoUrl(newItem.video_url);
                        setStatus('ready');
                        supabase.removeChannel(channel);
                    }

                    if (newItem.status === 'failed') {
                        setError('Generation failed');
                        setStatus('error');
                        supabase.removeChannel(channel);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    if (status === 'error') {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.centerContent}>
                    <Ionicons name="alert-circle" size={64} color={Colors.dark.error} />
                    <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={checkExistingVideo}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    if (status === 'generating') {
        const activeGen = Array.from(activeGenerations.values()).find((g: ActiveGeneration) => g.topic === topic);
        const currentProgress = activeGen?.progress || 0;

        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0a0a0f', '#1a1a2e']} style={styles.centerContent}>
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.dark.accent} />
                        <View style={styles.sparkleContainer}>
                            <Ionicons name="sparkles" size={24} color={Colors.dark.accent} />
                        </View>
                    </View>
                    <Text style={styles.generatingTitle}>Creating Premium Lesson</Text>
                    <Text style={styles.generatingSubtitle}>{topic}</Text>

                    <View style={styles.progressMeterContainer}>
                        <View style={[styles.progressMeterFill, { width: `${currentProgress * 100}%` }]} />
                        <Text style={styles.progressPercentage}>{Math.round(currentProgress * 100)}%</Text>
                    </View>

                    <View style={styles.logContainer}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {(activeGen?.logs || logs).map((log, index) => (
                                <Text key={index} style={styles.logText}>
                                    <Text style={styles.logTime}>[{log.time}]</Text> {log.msg}
                                </Text>
                            ))}
                            {(activeGen?.logs || logs).length === 0 && (
                                <Text style={styles.logText}>[System] Initializing engine...</Text>
                            )}
                        </ScrollView>
                    </View>

                    <TouchableOpacity style={styles.backgroundButton} onPress={() => router.back()}>
                        <Text style={styles.backgroundButtonText}>Continue in Background</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000', '#0a0a0f']} style={styles.playerWrapper}>
                {/* Header Overlay */}
                <BlurView intensity={20} style={styles.playerHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTopic} numberOfLines={1}>{topic}</Text>
                        <Text style={styles.headerSubject}>{subject}</Text>
                    </View>
                </BlurView>

                {videoUrl ? (
                    <Video
                        ref={videoRef}
                        source={{ uri: videoUrl }}
                        style={styles.video}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        isLooping={false}
                        onError={(e) => {
                            console.error('Video error:', e);
                            setError('Problem playing the video.');
                            setStatus('error');
                        }}
                    />
                ) : (
                    <View style={styles.centerContent}>
                        <ActivityIndicator size="large" color={Colors.dark.primary} />
                        <Text style={styles.loadingText}>Fetching video...</Text>
                    </View>
                )}

                {/* Bottom Info Overlay */}
                <View style={styles.playerFooter}>
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.footerGradient}
                    >
                        <View style={styles.footerBadge}>
                            <Ionicons name="shield-checkmark" size={14} color={Colors.dark.accent} />
                            <Text style={styles.footerBadgeText}>AI Verified Lesson</Text>
                        </View>
                        <Text style={styles.footerTagline}>Generated with ElevenFolks Engine</Text>
                    </LinearGradient>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    loaderContainer: {
        position: 'relative',
        marginBottom: Spacing.xl,
    },
    sparkleContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
    },
    generatingTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: '#fff',
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    generatingSubtitle: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xxl,
    },
    logContainer: {
        width: '100%',
        height: 150,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: Spacing.xl,
    },
    logText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 4,
    },
    logTime: {
        color: Colors.dark.accent,
    },
    backgroundButton: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    backgroundButtonText: {
        color: '#fff',
        fontWeight: Typography.weights.semibold,
    },
    playerWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    video: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    playerHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 50,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    headerInfo: {
        flex: 1,
    },
    headerTopic: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    headerSubject: {
        color: Colors.dark.accent,
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: Typography.weights.bold,
        letterSpacing: 1,
    },
    playerFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    footerGradient: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    footerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(57, 255, 20, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(57, 255, 20, 0.2)',
        marginBottom: 8,
    },
    footerBadgeText: {
        color: Colors.dark.accent,
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    footerTagline: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
    },
    loadingText: {
        color: '#fff',
        marginTop: Spacing.md,
    },
    progressMeterContainer: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        marginBottom: Spacing.xl,
        position: 'relative',
        overflow: 'hidden',
    },
    progressMeterFill: {
        height: '100%',
        backgroundColor: Colors.dark.accent,
        borderRadius: 4,
    },
    progressPercentage: {
        position: 'absolute',
        right: 0,
        top: -20,
        color: Colors.dark.accent,
        fontSize: 12,
        fontWeight: 'bold',
    },
    errorTitle: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginTop: Spacing.md,
    },
    errorText: {
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    retryButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 12,
        marginBottom: Spacing.md,
    },
    retryButtonText: {
        color: '#000',
        fontWeight: 'bold',
    },
    backButton: {
        paddingVertical: 12,
    },
    backButtonText: {
        color: Colors.dark.textSecondary,
    },
});
