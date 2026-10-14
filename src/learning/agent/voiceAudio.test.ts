import assert from "node:assert/strict";
import { test } from "node:test";
import { VoiceCapture, encodeVoiceWav } from "./voiceAudio";

test("encodes mono 16 kHz WAV and clips samples without wrapping", () => {
  const bytes = encodeVoiceWav([new Float32Array([-2, 0, 2])]);
  const view = new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.deepEqual(
    [44, 46, 48].map((offset) => view.getInt16(offset, true)),
    [-32768, 0, 32767],
  );
});
test("silence never triggers transcription and short noise is discarded", () => {
  const capture = new VoiceCapture();
  for (let i = 0; i < 40; i++)
    assert.equal(capture.push(new Float32Array(1600)), null);
  assert.equal(capture.push(new Float32Array(1600).fill(0.2)), null);
  for (let i = 0; i < 12; i++)
    assert.equal(capture.push(new Float32Array(1600)), null);
});
test("emits a single utterance after silence and resets between turns", () => {
  const capture = new VoiceCapture();
  for (let i = 0; i < 5; i++)
    assert.equal(capture.push(new Float32Array(1600).fill(0.2)), null);
  for (let i = 0; i < 8; i++)
    assert.equal(capture.push(new Float32Array(1600)), null);
  const wav = capture.push(new Float32Array(1600));
  assert.ok(wav);
  assert.equal(wav.length, 44 + 14 * 1600 * 2);
  for (let i = 0; i < 12; i++)
    assert.equal(capture.push(new Float32Array(1600)), null);
});
test("caps continuous speech and resets discarded audio when muted", () => {
  const capture = new VoiceCapture();
  for (let i = 0; i < 249; i++)
    assert.equal(capture.push(new Float32Array(1600).fill(0.2)), null);
  assert.ok(capture.push(new Float32Array(1600).fill(0.2)));
  capture.push(new Float32Array(4096).fill(0.2));
  capture.reset();
  for (let i = 0; i < 12; i++)
    assert.equal(capture.push(new Float32Array(1600)), null);
});
