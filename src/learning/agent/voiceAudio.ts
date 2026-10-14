/** Mono PCM WAV accepted by Meta's recording transcription endpoint. */
export function encodeVoiceWav(
  chunks: Float32Array[],
  sampleRate = 16000,
): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(44 + length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  return bytes;
}

/** End an utterance after 900 ms of silence; cap recordings at 25 seconds. */
export class VoiceCapture {
  private chunks: Float32Array[] = [];
  private samples = 0;
  private silence = 0;
  private speech = 0;
  reset() {
    this.chunks = [];
    this.samples = 0;
    this.silence = 0;
    this.speech = 0;
  }
  push(chunk: Float32Array): Uint8Array | null {
    const rms = Math.sqrt(
      chunk.reduce((sum, value) => sum + value * value, 0) / chunk.length,
    );
    const voiced = rms > 0.015;
    if (!voiced && !this.samples) return null;
    this.chunks.push(chunk.slice());
    this.samples += chunk.length;
    if (voiced) {
      this.silence = 0;
      this.speech += chunk.length;
    } else this.silence += chunk.length;
    if (this.samples < 16000 * 25 && this.silence < 16000 * 0.9) return null;
    const result =
      this.speech >= 16000 * 0.2 ? encodeVoiceWav(this.chunks) : null;
    this.reset();
    return result;
  }
}
