import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Typography } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entrance animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 20,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 20,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous rotation for accent elements
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 20000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            {/* Animated Background */}
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e', '#0a0a0f']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Rotating Accent Circles */}
            <Animated.View
                style={[
                    styles.accentCircle,
                    styles.accentCircle1,
                    { transform: [{ rotate: spin }] },
                ]}
            >
                <LinearGradient
                    colors={['#00f3ff40', '#ff00ff40']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientCircle}
                />
            </Animated.View>

            <Animated.View
                style={[
                    styles.accentCircle,
                    styles.accentCircle2,
                    { transform: [{ rotate: spin }] },
                ]}
            >
                <LinearGradient
                    colors={['#ff00ff40', '#39ff1440']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientCircle}
                />
            </Animated.View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <Animated.View
                    style={[
                        styles.hero,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Glowing Logo */}
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={['#00f3ff', '#ff00ff', '#39ff14']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoGradient}
                        >
                            <Text style={styles.logoEmoji}>📚</Text>
                        </LinearGradient>
                    </View>

                    <Text style={styles.title}>
                        Eleven<Text style={styles.titleAccent}>Folks</Text>
                    </Text>

                    <LinearGradient
                        colors={['#00f3ff', '#ff00ff']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.taglineGradient}
                    >
                        <Text style={styles.tagline}>Your AI-Powered Study Companion</Text>
                    </LinearGradient>

                    <Text style={styles.subtitle}>
                        Transform your study routine with intelligent planning, personalized schedules, and AI-driven insights
                    </Text>
                </Animated.View>

                {/* Animated Stats */}
                <View style={styles.statsContainer}>
                    {[
                        { icon: 'people', value: '10K+', label: 'Students' },
                        { icon: 'book', value: '50K+', label: 'Study Plans' },
                        { icon: 'trophy', value: '95%', label: 'Success Rate' },
                    ].map((stat, index) => (
                        <Animated.View
                            key={index}
                            style={[
                                styles.statCard,
                                {
                                    opacity: fadeAnim,
                                    transform: [
                                        {
                                            translateY: slideAnim.interpolate({
                                                inputRange: [0, 50],
                                                outputRange: [0, 50 + index * 20],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <BlurView intensity={20} style={styles.statBlur}>
                                <View style={styles.statIconContainer}>
                                    <Ionicons name={stat.icon as any} size={28} color={Colors.dark.primary} />
                                </View>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </BlurView>
                        </Animated.View>
                    ))}
                </View>

                {/* Premium Features */}
                <View style={styles.featuresSection}>
                    <Text style={styles.sectionTitle}>
                        Why <Text style={styles.sectionTitleAccent}>Choose Us?</Text>
                    </Text>

                    {[
                        {
                            icon: 'sparkles',
                            title: 'AI-Powered Planning',
                            description: 'Advanced algorithms create personalized study schedules tailored to your learning style and goals',
                            gradient: ['#00f3ff', '#0080ff'],
                        },
                        {
                            icon: 'trending-up',
                            title: 'Track Your Progress',
                            description: 'Real-time analytics and insights help you stay motivated and achieve your academic targets',
                            gradient: ['#ff00ff', '#ff0080'],
                        },
                        {
                            icon: 'bulb',
                            title: 'Smart Practice',
                            description: 'Get subject-specific questions with difficulty levels adapted to your current knowledge',
                            gradient: ['#39ff14', '#00ff80'],
                        },
                        {
                            icon: 'time',
                            title: 'Optimize Your Time',
                            description: 'Never miss a deadline with intelligent reminders and time management features',
                            gradient: ['#ffd700', '#ffaa00'],
                        },
                    ].map((feature, index) => (
                        <TouchableOpacity key={index} activeOpacity={0.9} style={styles.featureCard}>
                            <LinearGradient
                                colors={[...feature.gradient, feature.gradient[0] + '00']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.featureGradient}
                            >
                                <BlurView intensity={30} style={styles.featureContent}>
                                    <View style={[styles.featureIconContainer, { backgroundColor: feature.gradient[0] + '20' }]}>
                                        <Ionicons name={feature.icon as any} size={32} color={feature.gradient[0]} />
                                    </View>
                                    <View style={styles.featureText}>
                                        <Text style={styles.featureTitle}>{feature.title}</Text>
                                        <Text style={styles.featureDescription}>{feature.description}</Text>
                                    </View>
                                </BlurView>
                            </LinearGradient>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* CTA Section */}
                <View style={styles.ctaSection}>
                    <LinearGradient
                        colors={['#00f3ff20', '#ff00ff20']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaContainer}
                    >
                        <BlurView intensity={40} style={styles.ctaBlur}>
                            <Text style={styles.ctaTitle}>Ready to Excel?</Text>
                            <Text style={styles.ctaSubtitle}>Join thousands of successful students today</Text>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.push('/auth/signup')}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#00f3ff', '#0080ff']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.primaryButtonText}>Get Started Free</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => router.push('/auth/login')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.secondaryButtonText}>I Already Have an Account</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </LinearGradient>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        🚀 Powered by AI • 🔒 Secure & Private • 📱 Available Everywhere
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingBottom: Spacing.xxl,
    },
    accentCircle: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        opacity: 0.3,
    },
    accentCircle1: {
        top: -200,
        right: -100,
    },
    accentCircle2: {
        bottom: 100,
        left: -150,
    },
    gradientCircle: {
        flex: 1,
        borderRadius: 200,
    },
    hero: {
        alignItems: 'center',
        paddingTop: Spacing.xxl * 2,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
    },
    logoContainer: {
        marginBottom: Spacing.lg,
    },
    logoGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00f3ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 20,
    },
    logoEmoji: {
        fontSize: 60,
    },
    title: {
        fontSize: 56,
        fontWeight: '900',
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
        textShadowColor: 'rgba(0, 243, 255, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    titleAccent: {
        color: Colors.dark.primary,
    },
    taglineGradient: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: 20,
        marginBottom: Spacing.md,
    },
    tagline: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: '90%',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
    },
    statCard: {
        flex: 1,
        marginHorizontal: Spacing.xs,
    },
    statBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    statValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    statLabel: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    featuresSection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
    },
    sectionTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    sectionTitleAccent: {
        color: Colors.dark.primary,
    },
    featureCard: {
        marginBottom: Spacing.md,
        borderRadius: 20,
        overflow: 'hidden',
    },
    featureGradient: {
        padding: 2,
    },
    featureContent: {
        borderRadius: 18,
        overflow: 'hidden',
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    featureDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        lineHeight: 20,
    },
    ctaSection: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    ctaContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        padding: 2,
    },
    ctaBlur: {
        borderRadius: 22,
        overflow: 'hidden',
        padding: Spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    ctaTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    ctaSubtitle: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    primaryButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: Spacing.md,
        shadowColor: '#00f3ff',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 12,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        gap: Spacing.sm,
    },
    primaryButtonText: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
    secondaryButton: {
        paddingVertical: Spacing.md,
    },
    secondaryButtonText: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.primary,
        fontWeight: Typography.weights.semibold,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    footerText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
