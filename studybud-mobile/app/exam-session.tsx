import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function ExamSessionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const questions = typeof params.questions === 'string' ? JSON.parse(params.questions) : [];
    const duration = params.duration ? parseInt(params.duration as string) : 3 * 60 * 60;

    // State
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [results, setResults] = useState<any[] | null>(null);

    // Timer
    useEffect(() => {
        if (isSubmitted || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isSubmitted, timeLeft]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const currentQuestion = questions[currentIndex];

    const handleSubmit = () => {
        setIsSubmitted(true);
        Alert.alert("Time's Up!", "Please upload your answer sheet for evaluation.");
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, // Full sheet often needs crop but let's keep it simple
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            // Auto trigger OCR?
            handleOCR(result.assets[0].base64);
        }
    };

    const takePhoto = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Permission Required", "Camera access is needed to capture answer sheets.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            handleOCR(result.assets[0].base64);
        }
    };

    const handleOCR = async (base64: string | undefined | null) => {
        if (!base64) return;
        setOcrLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-cbse-paper', {
                body: {
                    action: 'ocr',
                    images: [base64]
                }
            });

            if (error) throw error;
            if (data && data.text) {
                setExtractedText(data.text);
            }
        } catch (e: any) {
            Alert.alert("OCR Error", e.message || "Failed to read text.");
        } finally {
            setOcrLoading(false);
        }
    };

    const handleEvaluate = async () => {
        if (!extractedText) return;
        setEvalLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-cbse-paper', {
                body: {
                    action: 'evaluate',
                    questions: questions,
                    studentText: extractedText
                }
            });

            if (error) throw error;
            // Response is JSON string (from LLM) or Object (from invoke parser)
            // The edge function returns `text` which is the string content. 
            // Wait, inside edge function I returned `text` directly as body if raw, or JSON.
            // Edge function returns: new Response(text, ...) where text is the JSON string from GPT.
            // supabase-js parses JSON automatically if content-type is json.
            // But if GPT returned a string, it might be double parsed?
            // Let's assume data is the object (array of results).

            let parsed = data;
            if (typeof data === 'string') {
                try { parsed = JSON.parse(data); } catch { }
            } else if (data && data.choices) { // Direct OpenAI response structure usually not returned by my wrapper, unless I messed up.
                // My wrapper returns pure text/json from content.
            }

            // GPT returns { "question_number": ... } array.
            // If it returned { "questions": [...] } or list.
            if (Array.isArray(parsed)) {
                setResults(parsed);
            } else if (parsed && parsed.questions) {
                setResults(parsed.questions);
            } else {
                // If it's pure text, might need parsing.
                console.log("Raw Eval:", data);
            }

        } catch (e: any) {
            Alert.alert("Evaluation Error", e.message || "Failed to evaluate.");
        } finally {
            setEvalLoading(false);
        }
    };

    const getTotalScore = () => {
        if (!results) return 0;
        return results.reduce((acc: number, curr: any) => acc + (curr.marks_awarded || 0), 0);
    };

    const getMaxScore = () => questions.reduce((acc: number, curr: any) => acc + (curr.marks || 0), 0);

    if (isSubmitted) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
                <Text style={styles.headerTitle}>Exam Submission</Text>

                {!imageUri ? (
                    <View style={styles.uploadSection}>
                        <Ionicons name="document-text-outline" size={64} color={Colors.dark.textSecondary} />
                        <Text style={styles.instructionText}>Upload or Capture your Handwritten Answer Sheet</Text>

                        <View style={styles.row}>
                            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
                                <Ionicons name="camera" size={24} color="#fff" />
                                <Text style={styles.btnText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                                <Ionicons name="images" size={24} color="#fff" />
                                <Text style={styles.btnText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.previewSection}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />

                        {ocrLoading ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator color={Colors.dark.primary} />
                                <Text style={styles.loadingText}>Reading Handwriting...</Text>
                            </View>
                        ) : extractedText ? (
                            <View>
                                <Text style={styles.subTitle}>Extracted Text</Text>
                                <View style={styles.textBox}>
                                    <Text style={styles.extractedText}>{extractedText}</Text>
                                </View>

                                {evalLoading ? (
                                    <View style={styles.loadingBox}>
                                        <ActivityIndicator color={Colors.dark.accent} />
                                        <Text style={styles.loadingText}>AI Grading in progress...</Text>
                                    </View>
                                ) : results ? (
                                    <View style={styles.resultsContainer}>
                                        <View style={styles.scoreCard}>
                                            <Text style={styles.scoreLabel}>Total Score</Text>
                                            <Text style={styles.scoreValue}>{getTotalScore()} / {getMaxScore()}</Text>
                                        </View>

                                        {results.map((res: any, idx: number) => (
                                            <View key={idx} style={styles.resultItem}>
                                                <View style={styles.rowBetween}>
                                                    <Text style={styles.resQNum}>Q{res.question_number}</Text>
                                                    <Text style={styles.resMarks}>{res.marks_awarded} / {res.max_marks}</Text>
                                                </View>
                                                <Text style={styles.resFeedback}>{res.feedback}</Text>
                                            </View>
                                        ))}

                                        <TouchableOpacity
                                            style={styles.homeButton}
                                            onPress={() => router.push('/(tabs)/home')}
                                        >
                                            <Text style={styles.btnText}>Return Home</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.evaluateButton} onPress={handleEvaluate}>
                                        <LinearGradient
                                            colors={[Colors.dark.primary, Colors.dark.secondary]}
                                            style={styles.gradientBtn}
                                        >
                                            <Text style={styles.btnText}>Evaluate with AI</Text>
                                            <Ionicons name="sparkles" size={20} color="#fff" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <Text style={styles.errorText}>Failed to read text. Try again clearly.</Text>
                        )}

                        {!results && !evalLoading && (
                            <TouchableOpacity onPress={() => { setImageUri(null); setExtractedText(null); }}>
                                <Text style={styles.retryText}>Retake Photo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.dark.surface, Colors.dark.background]}
                style={styles.header}
            >
                <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={20} color={Colors.dark.accent} />
                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsSubmitted(true)} style={styles.submitBtnHeader}>
                    <Text style={styles.submitText}>End Test</Text>
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.content}>
                <View style={styles.questionCard}>
                    <View style={styles.qHeader}>
                        <Text style={styles.qTags}>Q{currentIndex + 1} • {currentQuestion.type?.toUpperCase()} • {currentQuestion.marks} Marks</Text>
                    </View>
                    <Text style={styles.questionText}>{currentQuestion.question}</Text>

                    {currentQuestion.options && (
                        <View style={styles.optionsContainer}>
                            {currentQuestion.options.map((opt: string, idx: number) => (
                                <View key={idx} style={styles.optionRow}>
                                    <View style={styles.optionBadge}><Text style={styles.optionLabel}>{String.fromCharCode(65 + idx)}</Text></View>
                                    <Text style={styles.optionText}>{opt}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    disabled={currentIndex === 0}
                    onPress={() => setCurrentIndex(prev => prev - 1)}
                    style={[styles.navBtn, currentIndex === 0 && styles.disabledBtn]}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.progressText}>{currentIndex + 1} / {questions.length}</Text>
                <TouchableOpacity
                    disabled={currentIndex === questions.length - 1}
                    onPress={() => setCurrentIndex(prev => prev + 1)}
                    style={[styles.navBtn, currentIndex === questions.length - 1 && styles.disabledBtn]}
                >
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 24,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.dark.accent,
    },
    timerText: {
        color: Colors.dark.accent,
        fontWeight: 'bold',
        fontSize: 16,
        fontVariant: ['tabular-nums'],
    },
    submitBtnHeader: {
        padding: 8,
    },
    submitText: {
        color: 'red',
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    questionCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 100,
    },
    qHeader: {
        marginBottom: 16,
    },
    qTags: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    questionText: {
        color: Colors.dark.text,
        fontSize: 18,
        lineHeight: 28,
        fontWeight: '500',
        marginBottom: 24,
    },
    optionsContainer: {
        gap: 12,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
    },
    optionBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionLabel: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
    },
    optionText: {
        color: Colors.dark.text,
        flex: 1,
        fontSize: 16,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: Colors.dark.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    navBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledBtn: {
        backgroundColor: Colors.dark.border,
        opacity: 0.5,
    },
    progressText: {
        color: Colors.dark.textSecondary,
        fontSize: 16,
    },
    // Submission Styles
    uplodeSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 20,
    },
    uploadSection: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: Colors.dark.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderStyle: 'dashed',
    },
    instructionText: {
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 30,
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        gap: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    btnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    previewSection: {
        gap: 20,
    },
    previewImage: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        marginBottom: 20,
    },
    loadingBox: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        marginTop: 10,
    },
    subTitle: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    textBox: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 16,
        borderRadius: 12,
        maxHeight: 200,
    },
    extractedText: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        fontFamily: 'monospace',
    },
    evaluateButton: {
        marginTop: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
    },
    retryText: {
        color: Colors.dark.primary,
        textAlign: 'center',
        marginTop: 20,
        textDecorationLine: 'underline',
    },
    resultsContainer: {
        marginTop: 20,
        gap: 16,
    },
    scoreCard: {
        backgroundColor: Colors.dark.surface,
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(57, 255, 20, 0.3)',
    },
    scoreLabel: {
        color: Colors.dark.textSecondary,
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 1,
    },
    scoreValue: {
        color: Colors.dark.accent,
        fontSize: 36,
        fontWeight: 'bold',
        marginTop: 8,
    },
    resultItem: {
        backgroundColor: Colors.dark.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    resQNum: {
        color: Colors.dark.text,
        fontWeight: 'bold',
    },
    resMarks: {
        color: Colors.dark.accent,
        fontWeight: 'bold',
    },
    resFeedback: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    homeButton: {
        backgroundColor: Colors.dark.surface,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginTop: 20,
    },
});
