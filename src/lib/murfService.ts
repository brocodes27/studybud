export interface MurfSynthesisOptions {
  voiceId?: string;
  speakingRate?: number; // 0.5 - 2.0
  pitch?: number; // -10 to +10 semitones
  style?: string; // e.g., "conversational"
  format?: 'mp3' | 'wav' | 'ogg';
}

/**
 * Minimal Murf TTS client.
 *
 * This client expects either:
 * - A direct Murf-compatible REST endpoint in VITE_MURF_TTS_URL that accepts POST { text, voiceId, ... }
 *   with Authorization: Bearer <VITE_MURF_API_KEY> and returns raw audio (audio/*) OR JSON { url }
 * - Or a server-side proxy you host that bridges to Murf (recommended for CORS/security)
 */
export class MurfService {
  private static instance: MurfService;
  private apiKey: string;
  private defaultVoiceId: string;
  private ttsUrl: string | undefined;

  private constructor() {
    this.apiKey = import.meta.env.VITE_MURF_API_KEY || '';
    this.defaultVoiceId = import.meta.env.VITE_MURF_VOICE_ID || 'zaara';
    this.ttsUrl = import.meta.env.VITE_MURF_TTS_URL || undefined;
  }

  static getInstance(): MurfService {
    if (!MurfService.instance) MurfService.instance = new MurfService();
    return MurfService.instance;
  }

  /**
   * Synthesize speech and return a Blob URL suitable for <audio src>.
   */
  async synthesizeToUrl(text: string, opts: MurfSynthesisOptions = {}): Promise<string> {
    const blob = await this.synthesizeToBlob(text, opts);
    return URL.createObjectURL(blob);
  }

  /**
   * Synthesize speech and return an audio Blob.
   */
  async synthesizeToBlob(text: string, opts: MurfSynthesisOptions = {}): Promise<Blob> {
    if (!this.ttsUrl) {
      throw new Error('VITE_MURF_TTS_URL is not set. Configure a Murf REST endpoint or proxy.');
    }
    if (!this.apiKey) {
      throw new Error('VITE_MURF_API_KEY is not set.');
    }

    const body = {
      text,
      voiceId: opts.voiceId || this.defaultVoiceId,
      speakingRate: opts.speakingRate ?? 1.0,
      pitch: opts.pitch ?? 0,
      style: opts.style || 'conversational',
      format: opts.format || 'mp3'
    };

    const res = await fetch(this.ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const msg = await safeReadText(res);
      throw new Error(`Murf TTS failed: ${res.status} ${res.statusText} - ${msg}`);
    }

    const contentType = res.headers.get('Content-Type') || '';

    // Case 1: server returns audio directly
    if (contentType.startsWith('audio/')) {
      return await res.blob();
    }

    // Case 2: server returns JSON with a URL to the audio file
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.url) {
        const audioRes = await fetch(data.url);
        if (!audioRes.ok) throw new Error('Failed to fetch audio from returned URL');
        return await audioRes.blob();
      }
      throw new Error('Unexpected JSON response from Murf TTS (missing url or audio)');
    }

    // Fallback: try as blob
    return await res.blob();
  }

  /**
   * Convenience: synthesize and play immediately.
   */
  async playText(text: string, opts: MurfSynthesisOptions = {}): Promise<HTMLAudioElement> {
    const url = await this.synthesizeToUrl(text, opts);
    const audio = new Audio(url);
    await audio.play();
    return audio;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export default MurfService;
