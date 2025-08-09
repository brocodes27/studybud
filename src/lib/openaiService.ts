// src/lib/openaiService.ts

export class OpenAIService {
  private static instance: OpenAIService;
  private apiKey: string;
  private apiUrl: string = 'https://api.openai.com/v1/chat/completions';
  private model: string = 'gpt-4.1';

  private constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenAI API key is missing. Please set VITE_OPENAI_API_KEY in your .env file');
    }
  }

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  async generateChatCompletion(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) throw new Error('OpenAI API key not set');
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];
    const body = {
      model: this.model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    };
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('OpenAI API error: ' + response.status + ' ' + errorText);
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return text;
  }
}

export default OpenAIService;
