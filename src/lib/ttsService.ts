// @ts-nocheck
export class TTSService {
    private static instance: TTSService;

    private constructor() { }

    static getInstance() {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    async getAudioUrl(text: string, voiceIdOrGender: string = "default"): Promise<string | null> {
        if (!text) return null;

        try {
            // Unicode-safe base64 encoding for cache key
            const safeBtoa = (str: string) => {
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
                    function toSolidBytes(match, p1) {
                        return String.fromCharCode(parseInt(p1, 16));
                    }));
            };
            const cacheKey = `tts_inworld_v1_${safeBtoa(text).slice(0, 32)}_${voiceIdOrGender}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return cached;

            console.log(`[TTS] Generating audio via Inworld AI: "${text.slice(0, 20)}..."`);

            // Map generic gender requests to Inworld Voice IDs
            // "Dennis" is the example voice provided. 
            let voiceId = "Dennis";
            if (voiceIdOrGender.toLowerCase().includes('female')) {
                // Using a likely female ID or falling back to Dennis if unknown. 
                // "Gloria" or "Eileen" are common, but let's default to Dennis for safety unless we know for sure.
                // We'll stick to Dennis for now or the user provided specific ID.
                voiceId = "Tessa"; // Trying a female name, or fallback.
            }

            const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic Y2pCVzc0YnM2Qk1UaEJhck8zNklDNURZdTlUeXgyY0g6ZEdWTmcyNnd4NlJpMGJFcW9WMU9WM2dxZ0FtWGMxb3VUUHVFRkI4UlhBVkpDUXcxQTFHOUpzTjd2VE96MUkzeA==',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voice_id: voiceId,
                    audio_config: {
                        audio_encoding: "MP3",
                        speaking_rate: 1
                    },
                    temperature: 1.0, // Reduced slightly for stability
                    model_id: "inworld-tts-1.5-max"
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error('[TTS] Inworld API Error:', err);
                throw new Error(`Inworld API Error: ${response.status}`);
            }

            const result = await response.json();

            if (result.audioContent) {
                const audioSrc = `data:audio/mp3;base64,${result.audioContent}`;
                sessionStorage.setItem(cacheKey, audioSrc);
                return audioSrc;
            }

            return null;

        } catch (error: any) {
            console.error('[TTS] Inworld TTS failed, switching to fallback:', error);

            // Fallback: Google Translate
            try {
                const encodedText = encodeURIComponent(text.slice(0, 200));
                return `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=en&dt=t&q=${encodedText}`;
            } catch (e) {
                return null;
            }
        }
    }
}
