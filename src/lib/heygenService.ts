import { supabase } from './supabase';

export interface HeygenVideoOptions {
  voiceId?: string;
  format?: 'mp3' | 'wav';
}

export interface HeygenStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Lightweight HeyGen client used to request talking-head lesson videos.
 * NOTE: This hits the HeyGen API directly from the browser; prefer a proxy if you need stricter key protection.
 */
export class HeygenService {
  private static instance: HeygenService;
  private apiKey: string;
  private baseUrl = 'https://api.heygen.com';
  private defaultVoiceId: string | undefined;

  private constructor() {
    this.apiKey = import.meta.env.VITE_HEYGEN_API_KEY || '';
    this.defaultVoiceId = import.meta.env.VITE_HEYGEN_VOICE_ID || undefined;

    if (!this.apiKey) {
      console.warn('HeyGen API key missing. Set VITE_HEYGEN_API_KEY to enable audio rendering.');
    }
  }

  static getInstance(): HeygenService {
    if (!HeygenService.instance) HeygenService.instance = new HeygenService();
    return HeygenService.instance;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Api-Key': this.apiKey
    } as const;
  }

  async generateVideoFromText(text: string, opts: HeygenVideoOptions = {}): Promise<string> {
    // Kept name for backward compatibility; now issues audio-only jobs (no avatar).
    const { id } = await this.generateAudioFromText(text, opts);
    return id;
  }

  async generateAudioFromText(text: string, opts: HeygenVideoOptions = {}): Promise<{ id: string; url: string | null }> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');
    const voiceId = opts.voiceId || this.defaultVoiceId;
    if (!voiceId) throw new Error('VITE_HEYGEN_VOICE_ID is not set');

    const payload = {
      voice_id: voiceId,
      text,
      format: opts.format || 'mp3',
      metadata: await this.getUserMeta()
    } as any;

    const res = await fetch(`${this.baseUrl}/v1/audio.generate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen audio generate failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    const audioId = data?.data?.audio_id || data?.audio_id;
    const audioUrl = data?.data?.audio_url || data?.audio_url || data?.data?.download_url || data?.download_url || null;
    if (!audioId) {
      throw new Error('HeyGen response missing audio_id');
    }
    return { id: audioId, url: audioUrl };
  }

  async getStatus(jobId: string): Promise<HeygenStatus> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');

    const res = await fetch(`${this.baseUrl}/v1/audio.status?audio_id=${encodeURIComponent(jobId)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen status failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    const status = data?.data?.status || data?.status || 'pending';
    const downloadUrl = data?.data?.audio_url || data?.audio_url || data?.data?.download_url || data?.download_url;
    return { status, downloadUrl };
  }

  async getDownloadUrl(jobId: string): Promise<string | null> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');

    const res = await fetch(`${this.baseUrl}/v1/audio.download?audio_id=${encodeURIComponent(jobId)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen download lookup failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    return data?.data?.audio_url || data?.audio_url || data?.data?.download_url || data?.download_url || null;
  }

  async waitForVideoUrl(
    jobId: string,
    opts: { maxAttempts?: number; delayMs?: number; signal?: AbortSignal } = {}
  ): Promise<string | null> {
    const { maxAttempts = 30, delayMs = 4000, signal } = opts;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) return null;
      const status = await this.getStatus(jobId);
      if (status.status === 'completed') {
        if (status.downloadUrl) return status.downloadUrl;
        return await this.getDownloadUrl(jobId);
      }
      if (status.status === 'failed') {
        throw new Error(status.error || 'HeyGen audio generation failed');
      }
      await this.sleep(delayMs, signal);
    }
    return null;
  }

  private async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  private async getUserMeta() {
    try {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id;
      return id ? { user_id: id } : undefined;
    } catch {
      return undefined;
    }
  }
}

export default HeygenService;
