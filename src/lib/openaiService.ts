// src/lib/openaiService.ts
import { supabase } from './supabase';

export class OpenAIService {
  private static instance: OpenAIService;
  private proxyUrl: string;
  private model: string = 'gpt-4.1';

  private constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not set');
    this.proxyUrl = `${supabaseUrl}/functions/v1/openai-proxy`;
  }

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  private async authorizedFetch(body: any): Promise<any> {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) throw new Error('Not authenticated');

    const res = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI proxy error: ${res.status} ${text}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async generateChatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];
    const body = {
      model: this.model,
      messages,
      max_tokens: 8192,  // Increased for exam paper generation
      temperature: 0.7,
    };
    const data = await this.authorizedFetch(body);
    const text = data?.choices?.[0]?.message?.content || '';
    return text;
  }

  /**
   * Analyze images with GPT-4 Vision / multimodal models
   */
  async analyzeImagesWithVision(images: string[], prompt?: string, model?: string): Promise<string> {
    if (!images || images.length === 0) throw new Error('No images provided');

    const content: any[] = [];
    content.push({ type: 'text', text: prompt || 'Extract all handwritten text accurately. Preserve line breaks. If unreadable, mark as [illegible]. Return plain text.' });
    for (const url of images) {
      content.push({ type: 'image_url', image_url: { url } });
    }

    const body = {
      model: model || this.model,
      messages: [
        { role: 'user', content },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    } as any;

    const data = await this.authorizedFetch(body);
    return data?.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate embedding for text using OpenAI text-embedding-3-small
   */
  async getEmbedding(text: string): Promise<number[]> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not set');

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding Error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }

  /**
   * Search for similar questions using vector similarity
   */
  async searchSimilarQuestions(
    embedding: number[],
    matchThreshold: number,
    matchCount: number,
    filterClass?: string,
    filterSubject?: string
  ) {
    const { data, error } = await supabase.rpc('match_questions', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_class: filterClass,
      filter_subject: filterSubject,
    });

    if (error) throw new Error(`Vector Search Error: ${error.message}`);
    return data;
  }

  /**
   * Generate speech from text using OpenAI TTS
   */
  async generateSpeech(input: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'onyx'): Promise<ArrayBuffer> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('VITE_OPENAI_API_KEY missing, falling back to browser TTS');
      throw new Error('MISSING_KEY');
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input,
        voice,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI TTS Error: ${res.status} ${err}`);
    }

    return await res.arrayBuffer();
  }
}

export default OpenAIService;