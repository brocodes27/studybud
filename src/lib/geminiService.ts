export interface ConversationAnalysis {
  accuracy: number;
  keywords: string[];
  feedback: string;
  suggestedNextTopics: string[];
  learningStyle: string;
  confidenceLevel: 'low' | 'medium' | 'high';
  areasForImprovement: string[];
  strengths: string[];
  emotionalState: 'confident' | 'uncertain' | 'engaged' | 'confused';
}

export interface LearningInsights {
  preferredLearningStyle: string;
  knowledgeGaps: string[];
  strengths: string[];
  recommendedTopics: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  studyRecommendations: string[];
}

import { supabase } from './supabase';

export class GeminiService {
  private static instance: GeminiService;

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private async callProxy(action: string, payload: Record<string, unknown>): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: { action, payload } });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Proxy call failed');
    return data.result;
  }

  async analyzeConversation(transcript: string, topic: string): Promise<ConversationAnalysis> {
    try {
      return await this.callProxy('analyze_conversation', { transcript, topic });
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return {
        accuracy: 75, keywords: [], feedback: 'Good conversation! Keep learning.',
        suggestedNextTopics: [], learningStyle: 'auditory', confidenceLevel: 'medium',
        areasForImprovement: ['Continue practicing key concepts'], strengths: ['Good engagement'], emotionalState: 'engaged'
      };
    }
  }

  async generatePersonalizedFeedback(analysis: ConversationAnalysis, topic: string): Promise<string> {
    try {
      return await this.callProxy('generate_feedback', { analysis, topic });
    } catch (error) {
      console.error('Error generating feedback:', error);
      return 'Great work on this topic! Keep practicing and you\'ll continue to improve.';
    }
  }

  async generateLearningInsights(_userId: string, conversationHistory: any[]): Promise<LearningInsights> {
    try {
      return await this.callProxy('generate_insights', { data: { conversationHistory } });
    } catch (error) {
      console.error('Error generating learning insights:', error);
      return {
        preferredLearningStyle: 'auditory',
        knowledgeGaps: ['Continue building foundational knowledge'],
        strengths: ['Good engagement in conversations'],
        recommendedTopics: ['Continue with current topic progression'],
        difficultyLevel: 'intermediate',
        studyRecommendations: ['Practice regularly', 'Review key concepts']
      };
    }
  }

  async generateAdaptiveQuestions(topic: string, difficulty: string, learningStyle: string): Promise<string[]> {
    try {
      return await this.callProxy('generate_adaptive_questions', { topic, difficulty, learningStyle });
    } catch (error) {
      console.error('Error generating adaptive questions:', error);
      return [
        `What is the main concept of ${topic}?`,
        `How does ${topic} apply to everyday life?`,
        `What are the key principles of ${topic}?`,
        `Can you give an example of ${topic} in action?`,
        `What would happen if we changed one aspect of ${topic}?`
      ];
    }
  }

  async detectEmotionalState(transcript: string): Promise<string> {
    try {
      const result = await this.callProxy('detect_emotional_state', { message: transcript });
      const validStates = ['confident', 'uncertain', 'engaged', 'confused'];
      return validStates.includes(result?.emotion) ? result.emotion : 'engaged';
    } catch (error) {
      console.error('Error detecting emotional state:', error);
      return 'engaged';
    }
  }

  async transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
    try {
      const result = await this.callProxy('transcribe_audio', { audioDataUrl: `data:${mimeType};base64,${audioBase64}` });
      return result?.transcript || 'Transcription failed';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return 'Transcription failed';
    }
  }

  async generateResponse(prompt: string, context: string = "Educational Assistant"): Promise<string> {
    try {
      return await this.callProxy('generate_chat_completion', { prompt, systemPrompt: context });
    } catch (error) {
      console.error('generateResponse error:', error);
      return "My cognitive circuits are experiencing high latency. Please try again.";
    }
  }
}

export default GeminiService;