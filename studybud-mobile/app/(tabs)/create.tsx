import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface FormData {
    plan_name: string;
    class: string;
    subject: string;
    chapters: string;
    exam_date: string;
}

export default function CreateScreen() {
    const [formData, setFormData] = useState<FormData>({
        plan_name: '',
        class: '',
        subject: '',
        chapters: '',
        exam_date: '',
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Partial<FormData>>({});

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Partial<FormData> = {};

        if (!formData.plan_name.trim()) {
            newErrors.plan_name = 'Plan name is required';
        }
        if (!formData.subject.trim()) {
            newErrors.subject = 'Subject is required';
        }
        if (!formData.exam_date.trim()) {
            newErrors.exam_date = 'Exam date is required';
        }
        if (!formData.chapters.trim()) {
            newErrors.chapters = 'Chapters are required';
        }
        if (!formData.class.trim()) {
            newErrors.class = 'Class is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert('Error', 'Please log in to create a study plan');
                return;
            }

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/generate-study-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to generate study plan';
                try {
                    const errorData = await response.json();
                    if (errorData.details) {
                        errorMessage = `${errorData.error || errorMessage}: ${errorData.details}`;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch {
                    errorMessage = `${errorMessage} (Status: ${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const plan = await response.json();

            // Persist the custom plan name if it exists
            if (formData.plan_name && plan.id) {
                await supabase
                    .from('exam_plans')
                    .update({ plan_name: formData.plan_name })
                    .eq('id', plan.id);
            }

            Alert.alert(
                'Success!',
                'Your study plan has been created',
                [
                    {
                        text: 'View Plans',
                        onPress: () => router.push('/(tabs)/plans'),
                    },
                ]
            );

            // Reset form
            setFormData({
                plan_name: '',
                class: '',
                subject: '',
                chapters: '',
                exam_date: '',
            });
        } catch (error) {
            console.error('Error creating plan:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e']}
                style={styles.header}
            >
                <View style={styles.headerIcon}>
                    <Ionicons name="bulb" size={32} color={Colors.dark.primary} />
                </View>
                <Text style={styles.headerTitle}>Create Study Plan</Text>
                <Text style={styles.headerSubtitle}>
                    Generate an AI-powered study schedule tailored to your exam
                </Text>
            </LinearGradient>

            <View style={styles.form}>
                {/* Plan Name */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Plan Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.plan_name && styles.inputError]}
                        placeholder="e.g., Final Exam 2024"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={formData.plan_name}
                        onChangeText={(value) => handleInputChange('plan_name', value)}
                    />
                    {errors.plan_name && <Text style={styles.errorText}>{errors.plan_name}</Text>}
                </View>

                {/* Subject */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Subject <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.subject && styles.inputError]}
                        placeholder="e.g., Physics, Mathematics"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={formData.subject}
                        onChangeText={(value) => handleInputChange('subject', value)}
                    />
                    {errors.subject && <Text style={styles.errorText}>{errors.subject}</Text>}
                </View>

                {/* Class */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Class/Grade <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.class && styles.inputError]}
                        placeholder="e.g., 12th, Grade 10"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={formData.class}
                        onChangeText={(value) => handleInputChange('class', value)}
                    />
                    {errors.class && <Text style={styles.errorText}>{errors.class}</Text>}
                </View>

                {/* Chapters */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Chapters/Topics <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.textArea, errors.chapters && styles.inputError]}
                        placeholder="List the chapters or topics to cover"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={formData.chapters}
                        onChangeText={(value) => handleInputChange('chapters', value)}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                    {errors.chapters && <Text style={styles.errorText}>{errors.chapters}</Text>}
                    <Text style={styles.hint}>Separate chapters with commas or new lines</Text>
                </View>

                {/* Exam Date */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Exam Date <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[styles.input, errors.exam_date && styles.inputError]}
                        placeholder="YYYY-MM-DD (e.g., 2024-12-31)"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={formData.exam_date}
                        onChangeText={(value) => handleInputChange('exam_date', value)}
                    />
                    {errors.exam_date && <Text style={styles.errorText}>{errors.exam_date}</Text>}
                    <Text style={styles.hint}>Format: YYYY-MM-DD</Text>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={loading ? ['#666', '#666'] : ['#00f3ff', '#0080ff']}
                        style={styles.submitButtonGradient}
                    >
                        {loading ? (
                            <>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.submitButtonText}>Generating...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={20} color="#fff" />
                                <Text style={styles.submitButtonText}>Generate Study Plan</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        paddingBottom: Spacing.xl,
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    headerSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        maxWidth: 300,
    },
    form: {
        padding: Spacing.lg,
    },
    inputContainer: {
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    required: {
        color: Colors.dark.error,
    },
    input: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: Typography.sizes.md,
        color: Colors.dark.text,
    },
    inputError: {
        borderColor: Colors.dark.error,
    },
    textArea: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: Typography.sizes.md,
        color: Colors.dark.text,
        minHeight: 100,
    },
    errorText: {
        color: Colors.dark.error,
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs,
    },
    hint: {
        color: Colors.dark.textSecondary,
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs,
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: Spacing.md,
    },
    submitButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    submitButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        color: '#fff',
    },
});
