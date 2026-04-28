import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    image?: string;
}

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hello! I\'m your AI study assistant. Ask me anything about your subjects, study techniques, or homework help!',
            isUser: false,
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [messages]);

    const handleSend = async () => {
        if ((!inputText.trim() && !selectedImage) || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            isUser: true,
            timestamp: new Date(),
            image: selectedImage?.uri
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputText;
        const currentImage = selectedImage;
        setInputText('');
        setSelectedImage(null);
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

            // Multimodal content structure
            const userContent: any[] = [{ type: 'text', text: currentInput || "Analyze this image." }];
            if (currentImage?.base64) {
                userContent.push({
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${currentImage.base64}` }
                });
            }

            // We no longer use OpenAI. Route all chat to ai-proxy (Gemini backend).
            const response = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: currentImage?.base64 ? 'analyze_images' : 'generate_chat_completion',
                    payload: currentImage?.base64
                      ? {
                          systemPrompt:
                            'You are a helpful AI study assistant. Help students with their studies, provide explanations, and answer questions about various subjects. You can analyze images of handwritten notes, diagrams, or textbook questions. Be encouraging and educational.',
                          prompt: currentInput || 'Analyze this image and help the student.',
                          images: [`data:image/jpeg;base64,${currentImage.base64}`],
                        }
                      : {
                          systemPrompt:
                            'You are a helpful AI study assistant. Help students with their studies, provide explanations, and answer questions about various subjects. Be encouraging and educational.',
                          prompt: currentInput,
                          temperature: 0.7,
                        },
                }),
            });

            if (!response.ok) {
                const errTxt = await response.text();
                console.error('Proxy Response Error:', errTxt);
                throw new Error('Failed to get AI response');
            }

            const data = await response.json();
            const aiText = data?.result || 'Sorry, I couldn\'t generate a response.';

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: aiText,
                isUser: false,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Sorry, I encountered an error. Please try again.',
                isUser: false,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={90}
        >
            <LinearGradient
                colors={['#0a0a0f', '#1a1a2e']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <View style={styles.aiAvatar}>
                        <Ionicons name="sparkles" size={24} color={Colors.dark.primary} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>AI Study Buddy</Text>
                        <Text style={styles.headerSubtitle}>Powered by ElevenFolks AI</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.map((message) => (
                    <View
                        key={message.id}
                        style={[
                            styles.messageBubble,
                            message.isUser ? styles.userMessage : styles.aiMessage,
                        ]}
                    >
                        {!message.isUser && (
                            <View style={styles.aiIndicator}>
                                <Ionicons name="sparkles" size={12} color={Colors.dark.primary} />
                            </View>
                        )}
                        {message.image && (
                            <Image
                                source={{ uri: message.image }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                        )}
                        <Text style={[styles.messageText, message.isUser && styles.userMessageText]}>
                            {message.text}
                        </Text>
                        <Text style={[styles.timestamp, message.isUser && styles.userTimestamp]}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                ))}

                {loading && (
                    <View style={[styles.messageBubble, styles.aiMessage]}>
                        <View style={styles.typingIndicator}>
                            <ActivityIndicator size="small" color={Colors.dark.primary} />
                            <Text style={styles.typingText}>AI is thinking...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {selectedImage && (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                    <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setSelectedImage(null)}
                    >
                        <Ionicons name="close-circle" size={20} color="#ff4444" />
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.inputContainer}>
                <LinearGradient
                    colors={['#00f3ff10', '#ff00ff10']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.inputWrapper}
                >
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={pickImage}
                    >
                        <Ionicons name="add-circle-outline" size={24} color={Colors.dark.primary} />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask a question..."
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        editable={!loading}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() && !selectedImage || loading) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={(!inputText.trim() && !selectedImage) || loading}
                    >
                        <LinearGradient
                            colors={inputText.trim() && !loading ? ['#00f3ff', '#0080ff'] : ['#333', '#333']}
                            style={styles.sendButtonGradient}
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    aiAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.dark.text,
    },
    headerSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: Spacing.md,
        borderRadius: 16,
        marginBottom: Spacing.sm,
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.dark.primary,
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    aiIndicator: {
        marginBottom: Spacing.xs,
    },
    messageText: {
        fontSize: Typography.sizes.md,
        color: Colors.dark.text,
        lineHeight: 22,
    },
    userMessageText: {
        color: Colors.dark.background,
    },
    timestamp: {
        fontSize: Typography.sizes.xs,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
    },
    userTimestamp: {
        color: Colors.dark.background + '80',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.sm,
    },
    typingText: {
        fontSize: Typography.sizes.sm,
        color: Colors.dark.textSecondary,
    },
    inputContainer: {
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    input: {
        flex: 1,
        fontSize: Typography.sizes.md,
        color: Colors.dark.text,
        maxHeight: 100,
        paddingHorizontal: Spacing.sm,
    },
    sendButton: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonGradient: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 12,
        marginBottom: Spacing.sm,
    },
    attachButton: {
        padding: Spacing.xs,
    },
    previewContainer: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
        alignItems: 'center',
    },
    imagePreview: {
        width: 60,
        height: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.primary,
    },
    removeImageBtn: {
        marginLeft: -10,
        marginTop: -50,
        backgroundColor: Colors.dark.background,
        borderRadius: 10,
    },
});
