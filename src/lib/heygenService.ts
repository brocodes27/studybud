import { supabase } from './supabase';

export interface HeygenVideoOptions {
  avatarId?: string;
  voiceId?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '1280x720' | '720x1280' | '1080x1920' | '1024x1024';
  caption?: boolean;
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
  private defaultAvatarId: string | undefined;
  private defaultVoiceId: string | undefined;

  private constructor() {
    this.apiKey = import.meta.env.VITE_HEYGEN_API_KEY || '';
    this.defaultAvatarId = import.meta.env.VITE_HEYGEN_AVATAR_ID || undefined;
    this.defaultVoiceId = import.meta.env.VITE_HEYGEN_VOICE_ID || undefined;

    if (!this.apiKey) {
      console.warn('HeyGen API key missing. Set VITE_HEYGEN_API_KEY to enable avatar videos.');
    }
  }

  static getInstance(): HeygenService {
    if (!HeygenService.instance) HeygenService.instance = new HeygenService();
    return HeygenService.instance;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    } as const;
  }

  async generateVideoFromText(text: string, opts: HeygenVideoOptions = {}): Promise<string> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');
    const avatarId = opts.avatarId || this.defaultAvatarId;
    if (!avatarId) throw new Error('VITE_HEYGEN_AVATAR_ID is not set');

    const payload = {
      video_inputs: [
        {
          avatar_id: avatarId,
          voice_id: opts.voiceId || this.defaultVoiceId,
          input_text: text,
        }
      ],
      aspect_ratio: opts.aspectRatio || '16:9',
      resolution: opts.resolution || '1280x720',
      caption: opts.caption ?? false,
      transparent: false,
      metadata: await this.getUserMeta()
    } as any;

    const res = await fetch(`${this.baseUrl}/v2/video/generate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen generate failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    const videoId = data?.data?.video_id || data?.video_id;
    if (!videoId) {
      throw new Error('HeyGen response missing video_id');
    }
    return videoId;
  }

  async getStatus(videoId: string): Promise<HeygenStatus> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');

    const res = await fetch(`${this.baseUrl}/v1/video/status?video_id=${encodeURIComponent(videoId)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen status failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    const status = data?.data?.status || data?.status || 'pending';
    const downloadUrl = data?.data?.download_url || data?.download_url;
    return { status, downloadUrl };
  }

  async getDownloadUrl(videoId: string): Promise<string | null> {
    if (!this.apiKey) throw new Error('VITE_HEYGEN_API_KEY is not set');

    const res = await fetch(`${this.baseUrl}/v1/video/download?video_id=${encodeURIComponent(videoId)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`HeyGen download lookup failed: ${res.status} ${msg}`);
    }

    const data = await res.json();
    return data?.data?.video_url || data?.video_url || null;
  }

  async waitForVideoUrl(
    videoId: string,
    opts: { maxAttempts?: number; delayMs?: number; signal?: AbortSignal } = {}
  ): Promise<string | null> {
    const { maxAttempts = 30, delayMs = 4000, signal } = opts;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) return null;
      const status = await this.getStatus(videoId);
      if (status.status === 'completed') {
        if (status.downloadUrl) return status.downloadUrl;
        return await this.getDownloadUrl(videoId);
      }
      if (status.status === 'failed') {
        throw new Error(status.error || 'HeyGen video generation failed');
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
