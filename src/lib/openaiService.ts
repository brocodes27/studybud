import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private apiKey: string;
  private model: string = 'gemini-3-flash-preview';

  private constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  async generateChatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const contents = [];
      
      // Integrate Semantic Memory into the prompt
      const context = await this.findRelevantKnowledge(prompt);
      const contextualSystemPrompt = systemPrompt 
        ? `${systemPrompt}\n\nRELEVANT PAST KNOWLEDGE (Use this to personalize your response):\n${context}`
        : `You are Ranjan Sir, an AI tutor with memory of the student's past work. 
           RELEVANT PAST KNOWLEDGE:\n${context}`;

      const fullPrompt = `SYSTEM INSTRUCTION: ${contextualSystemPrompt}\n\nUSER PROMPT: ${prompt}`;

      contents.push({
        role: 'user',
        parts: [{ text: fullPrompt }]
      });

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
        throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Proactively save important insights back to knowledge base
      if (responseText.length > 200) {
          this.saveToKnowledgeBase(responseText, 'chat');
      }

      return responseText;
    } catch (error: any) {
      console.error('Gemini Service Error:', error);
      throw error;
    }
  }

  async analyzeImagesWithVision(images: string[], prompt?: string): Promise<string> {
    try {
      const parts: any[] = [{ text: prompt || 'Analyze this image.' }];
      
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
            maxOutputTokens: 2048,
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
     console.warn('Embedding call redirected to Gemini placeholder');
     return new Array(1536).fill(0); 
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

  async generateSpeech(input: string): Promise<ArrayBuffer> {
    throw new Error('TTS fallback');
  }
}

export default OpenAIService;
