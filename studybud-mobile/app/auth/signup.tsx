import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignupScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            Alert.alert('Signup Failed', error.message);
        } else {
            Alert.alert('Success', 'Account created! Please check your email to verify.', [
                { text: 'OK', onPress: () => router.push('/auth/login') }
            ]);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                {/* Header */}
                <LinearGradient
                    colors={['#ff00ff20', '#00f3ff20']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Start your journey to academic success</Text>
                </LinearGradient>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Choose a password (min 6 characters)"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Re-enter your password"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#ff00ff', '#00f3ff']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Create Account</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/auth/login')}>
                            <Text style={styles.link}>Login</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backText}>← Back to Landing</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        flex: 1,
    },
    header: {
        paddingTop: Spacing.xxl * 2,
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    form: {
        flex: 1,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    inputGroup: {
        gap: Spacing.sm,
    },
    label: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.text,
    },
    input: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        color: Colors.dark.text,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    button: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 12,
        padding: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.md,
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
    buttonGradient: {
        width: '100%',
        paddingVertical: Spacing.md,
        alignItems: 'center',
        borderRadius: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    footerText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.sm,
    },
    link: {
        color: Colors.dark.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    backButton: {
        marginTop: Spacing.lg,
        alignItems: 'center',
    },
    backText: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.sm,
    },
});
