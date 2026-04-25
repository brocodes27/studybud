import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export class AIService {
  private static instance: AIService;
  private apiKey: string;
  private model: string = 'gemini-3-flash-preview';

  private constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

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

      const fullPrompt = `SYSTEM INSTRUCTION: ${contextualSystemPrompt}\n\nUSER PROMPT: ${prompt}`;

      contents.push({
        role: 'user',
        parts: [{ text: fullPrompt }]
      });

      console.log('Calling Gemini API with model:', this.model);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API specific error:', errorData);
        throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('Gemini API raw response data:', data);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Extracted response text:', responseText);

      // Proactively save important insights back to knowledge base
      if (useRAG && responseText.length > 200) {
        this.saveToKnowledgeBase(responseText, 'chat');
      }

      return responseText;
    } catch (error: any) {
      console.error('Gemini Service Error:', error);
      throw error;
    }
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
        throw new Error('Unauthorized');
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

      // Guard: edge function sometimes returns HTTP 200 with an empty response
      // (e.g. Gemini was rate-limited or safety-blocked). Treat that as failure
      // and fall back to the simple chat completion path.
      if (!data?.response || typeof data.response !== 'string' || data.response.trim() === '') {
        console.warn('Empathetic Chat: empty response from orchestrator, falling back.', data);
        const fallbackResponse = await this.generateChatCompletion(message, studyContext, true);
        return {
          response: fallbackResponse,
          emotion_detected: data?.emotion_detected || 'neutral',
          pedagogical_mode: data?.pedagogical_mode || 'socratic'
        };
      }

      return data;
    } catch (error) {
      console.error('Empathetic Chat Error:', error);
      // Fallback to static RAG if edge function fails
      const fallbackResponse = await this.generateChatCompletion(message, studyContext, true);
      return {
        response: fallbackResponse,
        emotion_detected: 'neutral',
        pedagogical_mode: 'socratic'
      };
    }
  }

  async analyzeImagesWithVision(images: string[], prompt?: string, systemPrompt?: string, maxTokens: number = 2048): Promise<string> {
    try {
      const parts: any[] = [{ text: prompt || 'Analyze this image.' }];
      if (systemPrompt) {
        parts.unshift({ text: `SYSTEM_INSTRUCTION: ${systemPrompt}` });
      }

      for (const base64Data of images) {
        const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const mimeType = base64Data.includes(';') ? base64Data.split(';')[0].split(':')[1] : 'image/jpeg';

        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: data
          }
        });
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: maxTokens,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini Vision Error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('Gemini Vision Error:', error);
      throw error;
    }
  }

  async transcribeAndAnalyzeAudio(base64Audio: string, prompt: string): Promise<{ transcript: string, feedback: string }> {
    try {
      console.log('Gemini Audio Processing Started...');
      const data = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
      const mimeType = base64Audio.includes(';') ? base64Audio.split(';')[0].split(':')[1] : 'audio/webm';

      const parts: any[] = [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: data
          }
        }
      ];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
          }
        })
      });

      console.log('Sending audio prompt:', JSON.stringify(parts, null, 2));

      if (!response.ok) {
        const err = await response.json();
        console.error('Gemini Audio Error details:', err);
        throw new Error(`Gemini Audio Error: ${response.status}`);
      }

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      console.log('Gemini Audio Raw Response:', textResponse);

      // We expect the AI to return a specific format like:
      // TRANSCRIPT: [...]
      // FEEDBACK: [...]
      const transcriptMatch = textResponse.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=\s*ANALYSIS:|$)/i);
      const feedbackMatch = textResponse.match(/ANALYSIS:\s*([\s\S]*)/i);

      return {
        transcript: transcriptMatch ? transcriptMatch[1].trim() : 'Transcript unavailable',
        feedback: feedbackMatch ? feedbackMatch[1].trim() : textResponse
      };
    } catch (error) {
      console.error('Gemini Audio Processing Failed:', error);
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: {
              parts: [{ text: text.replace(/\n/g, " ") }],
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini Embedding Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (error) {
      console.error("Failed to get embedding:", error);
      // Fallback to zero vector (768 dim) if API fails
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
