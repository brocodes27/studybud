import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Settings } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CLASSES = ["10", "12"];
const EXAM_TYPES = ["Board", "Pre-Board", "Practice"];
const STREAMS = ["Science", "Commerce", "Humanities"];

const SUBJECTS_10 = [
    "Mathematics", "Science", "English", "Social Science", "Hindi", "Information Technology"
];

const SUBJECTS_12 = {
    Science: ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"],
    Commerce: ["Accountancy", "Business Studies", "Economics", "Mathematics", "English"],
    Humanities: ["History", "Geography", "Political Science", "Economics", "English"]
};

export default function CBSESimulatorScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedStream, setSelectedStream] = useState("Science");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [examType, setExamType] = useState("");
    const [difficulty, setDifficulty] = useState("Medium");
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [syllabusLoading, setSyllabusLoading] = useState(false);

    // Step 1: Basic Details
    const renderStep1 = () => (
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom + 40 }]}>
            <Text style={styles.stepTitle}>Exam Details</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Class</Text>
                <View style={styles.chipContainer}>
                    {CLASSES.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.chip, selectedClass === c && styles.chipActive]}
                            onPress={() => { setSelectedClass(c); setSelectedSubject(""); }}
                        >
                            <Text style={[styles.chipText, selectedClass === c && styles.chipTextActive]}>Class {c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {selectedClass === "12" && (
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Stream</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {STREAMS.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.chip, selectedStream === s && styles.chipActive]}
                                onPress={() => { setSelectedStream(s); setSelectedSubject(""); }}
                            >
                                <Text style={[styles.chipText, selectedStream === s && styles.chipTextActive]}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Subject</Text>
                <View style={styles.gridContainer}>
                    {(selectedClass === "10" ? SUBJECTS_10 : (selectedClass === "12" ? SUBJECTS_12[selectedStream as keyof typeof SUBJECTS_12] : [])).map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.gridChip, selectedSubject === s && styles.gridChipActive]}
                            onPress={() => setSelectedSubject(s)}
                        >
                            <Text style={[styles.chipText, selectedSubject === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Exam Type</Text>
                <View style={styles.chipContainer}>
                    {EXAM_TYPES.map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.chip, examType === t && styles.chipActive]}
                            onPress={() => setExamType(t)}
                        >
                            <Text style={[styles.chipText, examType === t && styles.chipTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.nextButton, (!selectedClass || !selectedSubject || !examType) && styles.disabledButton]}
                disabled={!selectedClass || !selectedSubject || !examType}
                onPress={fetchSyllabusAndProceed}
            >
                <LinearGradient
                    colors={[Colors.dark.primary, Colors.dark.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={styles.buttonText}>Next: Select Chapters</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const fetchSyllabusAndProceed = async () => {
        setLoading(true);
        try {
            // First check if user is logged in?

            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('generate-cbse-paper', {
                body: {
                    action: 'syllabus',
                    classLevel: selectedClass,
                    subject: selectedSubject,
                    stream: selectedStream
                }
            });

            if (error) throw error;
            if (data && data.units) {
                // Flatten chapters
                const flatChapters = data.units.flatMap((u: any) => u.chapters.map((c: any) => ({ ...c, unit: u.unit })));
                setChapters(flatChapters);
                setSelectedChapters(flatChapters.map((c: any) => c.name)); // Select all by default
                setStep(2);
            } else {
                Alert.alert("Error", "Failed to load syllabus.");
            }
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message || "Failed to fetch syllabus.");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Select Chapters & Difficulty
    const renderStep2 = () => (
        <View style={[styles.stepContainer, { paddingBottom: insets.bottom + 40 }]}>
            <Text style={styles.stepTitle}>Configurations</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Difficulty</Text>
                <View style={styles.chipContainer}>
                    {["Easy", "Medium", "Hard"].map(d => (
                        <TouchableOpacity
                            key={d}
                            style={[styles.chip, difficulty === d && styles.chipActive]}
                            onPress={() => setDifficulty(d)}
                        >
                            <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <View style={styles.rowBetween}>
                    <Text style={styles.label}>Select Chapters</Text>
                    <TouchableOpacity onPress={() => setSelectedChapters(selectedChapters.length === chapters.length ? [] : chapters.map(c => c.name))}>
                        <Text style={styles.linkText}>{selectedChapters.length === chapters.length ? "Deselect All" : "Select All"}</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.chaptersList}>
                    {chapters.map((c, idx) => {
                        const isSelected = selectedChapters.includes(c.name);
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.chapterItem, isSelected && styles.chapterItemActive]}
                                onPress={() => {
                                    if (isSelected) setSelectedChapters(prev => prev.filter(x => x !== c.name));
                                    else setSelectedChapters(prev => [...prev, c.name]);
                                }}
                            >
                                <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? Colors.dark.primary : Colors.dark.textSecondary} />
                                <Text style={[styles.chapterText, isSelected && styles.chapterTextActive]}>{c.name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <TouchableOpacity
                style={[styles.nextButton, selectedChapters.length === 0 && styles.disabledButton]}
                disabled={selectedChapters.length === 0}
                onPress={generateExam}
            >
                <LinearGradient
                    colors={[Colors.dark.accent, '#00ff80']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={[styles.buttonText, { color: '#000' }]}>Generate Paper</Text>
                    <Ionicons name="flash" size={20} color="#000" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const generateExam = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-cbse-paper', {
                body: {
                    action: 'generate',
                    classLevel: selectedClass,
                    subject: selectedSubject,
                    stream: selectedStream,
                    chapters: selectedChapters,
                    difficulty,
                    totalMarks: 40, // Reduced for mobile for now? Or keep 80.
                    sections: ['mcq', 'short', 'long']
                }
            });

            if (error) throw error;
            if (data && data.questions) {
                router.push({
                    pathname: '/exam-session',
                    params: {
                        questions: JSON.stringify(data.questions),
                        subject: selectedSubject,
                        duration: 3 * 60 * 60 // 3 hours
                    }
                });
            } else {
                Alert.alert("Error", "Failed to generate exam.");
            }
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message || "Failed to generate exam.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[Colors.dark.surface, Colors.dark.background]}
                style={[styles.header, { paddingTop: insets.top + 20 }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>CBSE Simulator</Text>
                <View style={{ width: 24 }} />
            </LinearGradient>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.loadingText}>
                        {step === 1 ? "Analyzing Syllabus..." : "Generating Exam Paper..."}
                    </Text>
                </View>
            ) : (
                <ScrollView style={styles.content}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                </ScrollView>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    stepContainer: {
        gap: 24,
        paddingBottom: 40,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 8,
    },
    inputGroup: {
        gap: 12,
    },
    label: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
        fontWeight: '600',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    chipActive: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    chipText: {
        color: Colors.dark.text,
        fontWeight: '500',
    },
    chipTextActive: {
        color: Colors.dark.primary,
    },
    horizontalScroll: {
        flexGrow: 0,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    gridChip: {
        width: '48%',
        padding: 12,
        borderRadius: 12,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        alignItems: 'center',
    },
    gridChipActive: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    nextButton: {
        marginTop: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        marginTop: 16,
        fontSize: 16,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkText: {
        color: Colors.dark.primary,
        fontSize: 14,
    },
    chaptersList: {
        maxHeight: 400,
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        padding: 12,
    },
    chapterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border + '40',
    },
    chapterItemActive: {
        backgroundColor: Colors.dark.primary + '10',
    },
    chapterText: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 14,
    },
    chapterTextActive: {
        color: Colors.dark.primary,
        fontWeight: '500',
    },
});
