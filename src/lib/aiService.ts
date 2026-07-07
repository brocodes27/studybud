import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export class AIService {
  private static instance: AIService;
  private constructor() { }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateChatCompletion(prompt: string, systemPrompt?: string, useRAG: boolean = true): Promise<string> {
    try {
      const contents = [];

      let contextualSystemPrompt = systemPrompt;

      // Integrate Semantic Memory into the prompt ONLY if useRAG is true
      if (useRAG) {
        const context = await this.findRelevantKnowledge(prompt);
        contextualSystemPrompt = systemPrompt
          ? `${systemPrompt}\n\nRELEVANT PAST KNOWLEDGE (Use this to personalize your response):\n${context}`
          : `You are ATLAS, the student's friendly AI study partner with memory of their past work.
             Your mission is to provide warm, encouraging, and effective coaching, specializing in JEE (Joint Entrance Examination) preparation.
             RELEVANT PAST KNOWLEDGE:\n${context}`;
      } else if (!contextualSystemPrompt) {
        // Default system prompt if none provided and RAG is off
        contextualSystemPrompt = `You are ATLAS, the student's friendly AI study partner. Your mission is to provide warm, encouraging, and effective coaching.`;
      }

      // Inject real-world temporal awareness so the LLM always knows "today"
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const realWorldContext = `Today is ${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

      const fullPrompt = `SYSTEM INSTRUCTION: ${contextualSystemPrompt}\n\n${realWorldContext}\n\nUSER PROMPT: ${prompt}`;

      contents.push({
        role: 'user',
        parts: [{ text: fullPrompt }]
      });

      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'generate_chat_completion', payload: { prompt: fullPrompt, systemPrompt: contextualSystemPrompt, useRAG } }
      });
      if (error) throw error;
      const responseText = data?.result || '';
      if (useRAG && responseText.length > 200) {
        this.saveToKnowledgeBase(responseText, 'chat');
      }
      return responseText;
    } catch (error: any) {
      console.error('Chat completion error:', error);
      throw error;
    }
  }

  /**
   * Guest-safe chat for the public landing demo. Calls the JWT-less
   * `landing-demo` edge function (anon key only, server-locked prompt).
   */
  async generateGuestChat(message: string, conversationHistory: any[] = []): Promise<{
    response: string,
    emotion_detected: string,
    pedagogical_mode: string
  }> {
    const { data, error } = await supabase.functions.invoke('landing-demo', {
      body: { message, conversation_history: conversationHistory }
    });
    if (error) throw error;
    if (!data?.response || typeof data.response !== 'string' || data.response.trim() === '') {
      throw new Error('Demo returned empty response');
    }
    return data;
  }

  /**
   * Generates a response using the Orchestrator Edge Function (or fallback to NDCF).
   */
  async generateEmpatheticChat(message: string, sessionId: string, conversationHistory: any[], studyContext?: string, useFullOrchestration: boolean = true): Promise<{
    response: string,
    emotion_detected: string,
    pedagogical_mode: string
  }> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        // No auth session (e.g. landing-page demo, logged-out /prove-it):
        // route to the guest-safe demo function instead of failing.
        return await this.generateGuestChat(message, conversationHistory);
      }

      // Use the new Multi-Agent Orchestrator (it handles both fast path and complex path internally)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/multi-agent-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          conversation_history: conversationHistory,
          study_context: studyContext,
          use_full_orchestration: useFullOrchestration
        })
      });

      if (!response.ok) {
        throw new Error(`NDCF Edge Function Error: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();

      if (!data?.response || typeof data.response !== 'string' || data.response.trim() === '') {
        throw new Error('Orchestrator returned empty response');
      }
      return data;
    } catch (error) {
      console.error('Empathetic Chat Error:', error);
      throw error;
    }
  }

  async analyzeImagesWithVision(images: string[], prompt?: string, systemPrompt?: string, maxTokens: number = 2048): Promise<string> {
    try {
      const { data: resp, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'analyze_images', payload: { images, prompt, systemPrompt, maxTokens } }
      });
      if (error) throw error;
      return (resp as any)?.result || '';
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw error;
    }
  }

  async transcribeAndAnalyzeAudio(base64Audio: string, prompt: string): Promise<{ transcript: string, feedback: string }> {
    try {
      const { data: resp, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'transcribe_audio', payload: { base64Audio, prompt } }
      });
      if (error) throw error;
      const result = (resp as any)?.result || {};
      return {
        transcript: result.transcript || 'Transcript unavailable',
        feedback: result.feedback || result.textResponse || ''
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
  }

  /**
   * Save a piece of knowledge to the user's semantic memory
   */
  async saveToKnowledgeBase(content: string, sourceType: 'chat' | 'journal' | 'research'): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) return;

      if (content.trim().length < 50) return;

      const { error } = await supabase
        .from('user_knowledge')
        .insert({
          user_id: sessionData.session.user.id,
          content: content.trim(),
          source_type: sourceType,
          metadata: { timestamp: new Date().toISOString() }
        });

      if (error) throw error;
    } catch (e) {
      console.error('Knowledge base save error:', e);
    }
  }

  /**
   * Search for relevant previous knowledge
   */
  async findRelevantKnowledge(query: string): Promise<string> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) return '';

      // Text-based similarity search (simplified for MVP)
      const { data, error } = await supabase
        .from('user_knowledge')
        .select('content, created_at')
        .eq('user_id', sessionData.session.user.id)
        .ilike('content', `%${query.split(' ')[0]}%`)
        .limit(3);

      if (error || !data || data.length === 0) return '';

      return data.map(k => `[Archived ${new Date(k.created_at).toLocaleDateString()}]: ${k.content}`).join('\n---\n');
    } catch {
      return '';
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action: 'get_embedding', payload: { text } }
      });
      if (error) throw error;
      return data?.result || new Array(768).fill(0);
    } catch (error) {
      console.error('Embedding error:', error);
      return new Array(768).fill(0);
    }
  }

  async searchSimilarQuestions(
    embedding: number[],
    threshold: number,
    count: number,
    classLevel: string,
    subject: string
  ): Promise<any[]> {
    try {
      const isZeroVector = embedding.every(n => n === 0);
      if (isZeroVector) {
        console.warn('searchSimilarQuestions: Zero-vector embedding detected (placeholder). Skipping RAG.');
        return [];
      }

      const { data, error } = await supabase.rpc('match_questions', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
        filter_class: classLevel,
        filter_subject: subject
      });

      if (error) {
        console.warn('Supabase RAG search failed:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('searchSimilarQuestions error:', e);
      return [];
    }
  }

  async generateManimVideoScript(topic: string, subject: string): Promise<any> {
    const systemPrompt = `You are an elite educational scriptwriter for Manim. Return valid JSON.`;
    const prompt = `Generate a 3 segment script for a video lesson about: ${topic} in ${subject}.`;

    const response = await this.generateChatCompletion(prompt, systemPrompt);
    try {
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}');
      return JSON.parse(response.slice(start, end + 1));
    } catch (e) {
      throw new Error('Manim script generation failed');
    }
  }

  async generateSpeech(_input: string): Promise<ArrayBuffer> {
    throw new Error('TTS fallback');
  }
}

export default AIService;
