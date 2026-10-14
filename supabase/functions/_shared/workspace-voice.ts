export const TRANSCRIPTION_MODEL = "muse-voice-transcribe-1.0";
export const MAX_VOICE_BYTES = 1_000_000;

export interface VoiceConfig {
  metaKey?: string;
  groqKey?: string;
}

export function requireVoiceConfig(config: VoiceConfig) {
  if (!config.metaKey)
    throw new Error(
      "Speech recognition is not configured. You can keep typing.",
    );
  if (!config.groqKey)
    throw new Error("Hosted speech is not configured. You can keep typing.");
}

export async function transcribeVoice(
  audio: Uint8Array,
  config: VoiceConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!config.metaKey) throw new Error("Speech recognition is not configured.");
  if (audio.length < 44 || audio.length > MAX_VOICE_BYTES)
    throw new Error("Record a voice message of up to 25 seconds.");
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
  const tag = (start: number, length: number) =>
    new TextDecoder().decode(audio.slice(start, start + length));
  if (
    tag(0, 4) !== "RIFF" ||
    tag(8, 4) !== "WAVE" ||
    tag(12, 4) !== "fmt " ||
    tag(36, 4) !== "data" ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== 16000 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(40, true) !== audio.length - 44
  ) {
    throw new Error("Voice audio must be mono 16 kHz PCM WAV.");
  }
  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: TRANSCRIPTION_MODEL,
          audioEncoding: "WAV",
          mode: "PUSH_TO_TALK",
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append(
    "audio",
    new Blob([new Uint8Array(audio)], { type: "audio/wav" }),
    "speech.wav",
  );
  const response = await fetch("https://api.meta.ai/v1/asr/transcribe", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.metaKey}`,
      Accept: "text/plain",
    },
    body: form,
    signal: signal ?? AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error("Speech recognition is unavailable. Please try again.");
  const transcript = (await response.text()).trim();
  if (transcript.length > 6000)
    throw new Error("Voice message is too long. Please try a shorter message.");
  return transcript;
}

export const SPEECH_MODEL = "canopylabs/orpheus-v1-english";
export async function synthesizeVoice(
  text: unknown,
  config: VoiceConfig,
  signal?: AbortSignal,
): Promise<Response> {
  if (!config.groqKey)
    throw new Error("Hosted speech is not configured. You can keep typing.");
  if (typeof text !== "string" || !text.trim() || Array.from(text).length > 200)
    throw new Error("Speech requests require between 1 and 200 characters.");
  const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    signal: signal ?? AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${config.groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      input: text.trim(),
      voice: "hannah",
      response_format: "wav",
    }),
  });
  if (response.status === 429)
    throw new Error(
      "The free speech quota is temporarily exhausted. Your reply is available in the conversation.",
    );
  if (
    !response.ok ||
    !response.body ||
    !/^audio\//i.test(response.headers.get("Content-Type") || "")
  )
    throw new Error(
      "Hosted speech is unavailable. Your reply is available in the conversation.",
    );
  return response;
}
