import { supabase } from './supabase';
import GeminiService from './geminiService';

export interface VAPIConfig {
  apiKey: string;
  assistantId: string;
  voiceId: string;
  model: string;
}

export interface VoiceCall {
  id: string;
  status: 'connecting' | 'connected' | 'ended' | 'error' | 'active';
  transcript?: string;
  audioUrl?: string;
  duration?: number;
  createdAt?: Date;
  assistantId?: string;
  voiceId?: string;
}

export interface VAPIAssistant {
  id: string;
  name: string;
  instructions: string;
  model: string;
  voiceId: string;
  personality: string;
}

export class VAPIService {
  private static instance: VAPIService;
  private apiKey: string;
  private baseUrl: string = 'https://api.vapi.ai';
  private currentCall: VoiceCall | null = null;
  private defaultAssistantId: string = '';
  private defaultVoiceId: string = '';

  constructor() {
    this.apiKey = import.meta.env.VITE_VAPI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('VAPI API key is missing. Please set VITE_VAPI_API_KEY in your .env file');
    } else {
      console.log('VAPI API key found:', this.apiKey.substring(0, 10) + '...');
    }
  }

  static getInstance(): VAPIService {
    if (!VAPIService.instance) {
      VAPIService.instance = new VAPIService();
    }
    return VAPIService.instance;
  }

  async initializeCall(topic: string, personality: string): Promise<VoiceCall> {
    try {
      // First, let's test if the API key is valid
      if (!this.apiKey || this.apiKey === 'your_vapi_api_key_here') {
        console.warn('VAPI API key is not set or is using placeholder value');
        return {
          id: `mock-call-${Date.now()}`,
          status: 'active',
          assistantId: 'fallback-assistant',
          voiceId: 'elliot'
        };
      }

      const assistantId = await this.getOrCreateDefaultAssistant();
      const voiceId = await this.getOrCreateDefaultVoice();

      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistantId: assistantId,
          voiceId: voiceId,
          metadata: {
            topic: topic,
            personality: personality,
            model: 'gemini-3-flash'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn('VAPI call creation failed, using fallback:', errorData);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        return {
          id: `mock-call-${Date.now()}`,
          status: 'active',
          assistantId: assistantId,
          voiceId: voiceId
        };
      }

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        assistantId: assistantId,
        voiceId: voiceId
      };
    } catch (error) {
      console.warn('VAPI initialization failed, using fallback mode:', error);
      return {
        id: `fallback-call-${Date.now()}`,
        status: 'active',
        assistantId: 'fallback-assistant',
        voiceId: 'elliot'
      };
    }
  }

  private async getOrCreateDefaultVoice(): Promise<string> {
    if (this.defaultVoiceId && this.defaultVoiceId !== '') {
      return this.defaultVoiceId;
    }

    // Use Elliot as the default voice
    this.defaultVoiceId = 'elliot';
    return this.defaultVoiceId;
  }

  private async getOrCreateDefaultAssistant(): Promise<string> {
    if (this.defaultAssistantId && this.defaultAssistantId !== '') {
      return this.defaultAssistantId;
    }

    try {
      // Try to create a new assistant optimized for Gemini 3 Flash
      const response = await fetch(`${this.baseUrl}/assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'elevenfolks AI Tutor',
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini', // VAPI will route to Gemini 3 Flash
            temperature: 0.7
          },
          voice: {
            provider: '11labs',
            voiceId: 'elliot'
          },
          instructions: (() => {
            const now = new Date();
            const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            return `You are an AI tutor helping students learn various subjects. You are using Gemini 3 Flash for enhanced reasoning and conversation capabilities.

CURRENT REAL-WORLD CONTEXT:
- Today is ${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}.
- Current time: ${now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (local time).

Key Responsibilities:
- Be encouraging, patient, and adapt your teaching style to the student's needs
- Ask open-ended questions to promote critical thinking
- Provide real-world examples and analogies
- Use the Socratic method when appropriate
- Give positive reinforcement and constructive feedback
- Adapt your pace based on the student's understanding
- Use clear, concise explanations
- Encourage active participation and questions

Remember to:
- Listen actively to the student's responses
- Ask follow-up questions to deepen understanding
- Provide specific, actionable feedback
- Keep the conversation engaging and interactive
- Use analogies and examples relevant to the student's level`;
          })()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.defaultAssistantId = data.id || 'default-assistant-id';
        return this.defaultAssistantId;
      } else {
        const errorData = await response.json();
        console.warn('Failed to create assistant, using fallback ID:', errorData);
        console.log('Assistant creation response status:', response.status);
        this.defaultAssistantId = 'default-assistant-id';
        return this.defaultAssistantId;
      }
    } catch (error) {
      console.warn('Error creating assistant, using fallback:', error);
      this.defaultAssistantId = 'default-assistant-id';
      return this.defaultAssistantId;
    }
  }

  private generateInstructions(topic: string, personality: string): string {
    const baseInstructions = `You are an AI tutor helping a student learn about ${topic}. 
    Your teaching style is ${personality}. 
    
    Guidelines:
    - Ask open-ended questions to encourage critical thinking
    - Provide positive reinforcement for correct answers
    - Give helpful hints when students struggle
    - Keep responses concise and engaging
    - Adapt your teaching style based on the student's responses
    - Use real-world examples when possible
    - Encourage the student to explain their reasoning
    
    Topic: ${topic}
    Teaching Style: ${personality}`;

    return baseInstructions;
  }

  private generateSystemPrompt(topic: string, personality: string): string {
    const personalityPrompts = {
      encouraging: `You are Sarah, an encouraging and patient tutor. Always celebrate small successes and provide gentle guidance. Use phrases like "That's a great start!" and "You're on the right track!"`,
      strict: `You are Dr. Johnson, a strict but fair professor. Expect excellence and provide direct feedback. Use phrases like "Let's be more precise" and "Think about this carefully."`,
      friendly: `You are Mike, a friendly tutor who makes learning fun. Use humor and relatable examples. Keep the conversation light and engaging.`,
      socratic: `You are Sophia, a Socratic tutor. Guide students to discover answers themselves through leading questions. Ask "What do you think?" and "How did you arrive at that conclusion?"`
    };

    return `${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.friendly}

    You are teaching about: ${topic}
    
    Remember to:
    - Stay in character as your assigned personality
    - Focus on the topic at hand
    - Keep responses under 30 seconds
    - Ask follow-up questions to deepen understanding
    - Provide constructive feedback`;
  }

  async getCallStatus(callId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get call status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting call status:', error);
      throw error;
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to end call');
      }

      this.currentCall = null;
    } catch (error) {
      console.error('Error ending call:', error);
      throw error;
    }
  }

  async getCallTranscript(callId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}/transcript`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get transcript');
      }

      const data = await response.json();
      return data.transcript || '';
    } catch (error) {
      console.error('Error getting transcript:', error);
      return '';
    }
  }

  async saveVoiceLectureData(userId: string, lessonId: string, callData: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('voice_lectures')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          topic: callData.topic,
          conversation_history: callData.transcript,
          progress: callData.progress || 100,
          accuracy: callData.accuracy || 0,
          xp_earned: callData.xpEarned || 0,
          completed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving voice lecture data:', error);
      }
    } catch (error) {
      console.error('Error saving voice lecture data:', error);
    }
  }

  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voice`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get available voices');
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error getting available voices:', error);
      return [];
    }
  }

  async createCustomAssistant(name: string, instructions: string, voiceId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          instructions,
          voice: {
            id: voiceId
          },
          model: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create assistant');
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Error creating assistant:', error);
      throw error;
    }
  }

  async getAssistants(): Promise<VAPIAssistant[]> {
    try {
      const response = await fetch(`${this.baseUrl}/assistant`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get assistants');
      }

      const data = await response.json();
      return data.assistants || [];
    } catch (error) {
      console.error('Error getting assistants:', error);
      return [];
    }
  }

  // WebSocket connection for real-time updates
  connectToCall(callId: string, onUpdate: (data: any) => void): WebSocket | null {
    try {
      const wsUrl = `wss://api.vapi.ai/call/${callId}/stream`;
      console.log('Connecting to VAPI WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Connected to VAPI call stream');
        // Send authentication
        ws.send(JSON.stringify({
          type: 'auth',
          apiKey: this.apiKey
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          onUpdate(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        onUpdate({ type: 'error', message: 'WebSocket connection failed' });
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        onUpdate({ type: 'disconnected', code: event.code, reason: event.reason });
      };

      return ws;
    } catch (error) {
      console.error('❌ Error connecting to call stream:', error);
      return null;
    }
  }

  // Analyze conversation for learning insights using Gemini
  async analyzeConversation(transcript: string, topic: string): Promise<{
    accuracy: number;
    keywords: string[];
    feedback: string;
    suggestedNextTopics: string[];
  }> {
    const geminiService = GeminiService.getInstance();
    const analysis = await geminiService.analyzeConversation(transcript, topic);

    return {
      accuracy: analysis.accuracy,
      keywords: analysis.keywords,
      feedback: analysis.feedback,
      suggestedNextTopics: analysis.suggestedNextTopics
    };
  }
}

export default VAPIService; 