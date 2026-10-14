import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { build } from "esbuild";

let useVoice: typeof import("./useVoice").useVoice;
let values: unknown[] = [];
let processor: { onaudioprocess: ((event: unknown) => void) | null };
let stopped = 0;
let messages: string[] = [];
const harness = globalThis as typeof globalThis & {
  __voiceReact: unknown;
  __voiceApi: unknown;
};
before(async () => {
  harness.__voiceReact = {
    useState(value: unknown) {
      const index = values.length;
      values.push(value);
      return [
        value,
        (next: unknown) => {
          values[index] = next;
        },
      ];
    },
    useRef: (current: unknown) => ({ current }),
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
  };
  const bundle = await build({
    entryPoints: [new URL("./useVoice.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    plugins: [
      {
        name: "voice-harness",
        setup(build) {
          build.onResolve({ filter: /^(react|\.\/api)$/ }, (args) => ({
            path: args.path,
            namespace: "harness",
          }));
          build.onLoad({ filter: /.*/, namespace: "harness" }, (args) => ({
            contents:
              args.path === "react"
                ? "export const {useState,useRef,useCallback,useEffect}=globalThis.__voiceReact;"
                : "export const checkVoiceAvailability=(...a)=>globalThis.__voiceApi.check(...a); export const transcribeVoiceAudio=(...a)=>globalThis.__voiceApi.transcribe(...a); export const requestVoiceSpeech=(...a)=>globalThis.__voiceApi.speak(...a);",
          }));
        },
      },
    ],
  });
  useVoice = (
    await import(
      `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
    )
  ).useVoice;
});
beforeEach(() => {
  values = [];
  stopped = 0;
  messages = [];
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: class {
      sampleRate = 16000;
      destination = {};
      resume = async () => {};
      close = async () => {};
      createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
      createScriptProcessor = () => {
        processor = {
          onaudioprocess: null,
          connect() {},
          disconnect() {},
        } as typeof processor;
        return processor;
      };
      decodeAudioData = async () => ({});
      createBufferSource = () => {
        const source = {
          buffer: null,
          onended: null as (() => void) | null,
          connect() {},
          disconnect() {},
          stop() {},
          start() {
            queueMicrotask(() => source.onended?.());
          },
        };
        return source;
      };
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream() } },
  });
  harness.__voiceApi = {
    check: async () => {},
    transcribe: async () => "Option B",
    speak: async () => new ArrayBuffer(4),
  };
});
function stream() {
  return {
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
    getAudioTracks: () => [],
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("ending voice while microphone permission is pending stops the late stream", async () => {
  let release!: (value: unknown) => void;
  navigator.mediaDevices.getUserMedia = () =>
    new Promise((resolve) => {
      release = resolve as typeof release;
    });
  const voice = useVoice({ onMessage: async () => null });
  const connecting = voice.connect();
  await flush();
  voice.disconnect();
  release(stream());
  await connecting;
  assert.equal(stopped, 1);
  assert.equal(values[0], "disconnected");
});
test("spoken turns use the saved-message path and resume listening after hosted speech playback", async () => {
  const voice = useVoice({
    onMessage: async (text) => {
      messages.push(text);
      return "Choice saved.";
    },
  });
  await voice.connect();
  for (let i = 0; i < 5; i++)
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.2) },
    });
  for (let i = 0; i < 4; i++)
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096) },
    });
  await flush();
  assert.deepEqual(messages, ["Option B"]);
  assert.equal(values[0], "listening");
  voice.disconnect();
  assert.equal(stopped, 1);
});
test("ending voice during transcription cancels work and never dispatches the transcript", async () => {
  let release!: (value: string) => void;
  let signal: AbortSignal | undefined;
  harness.__voiceApi = {
    check: async () => {},
    transcribe: (_audio: unknown, inputSignal: AbortSignal) => {
      signal = inputSignal;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    speak: async () => {
      throw new Error("must not speak");
    },
  };
  const voice = useVoice({
    onMessage: async (text) => {
      messages.push(text);
      return "Saved";
    },
  });
  await voice.connect();
  for (let i = 0; i < 5; i++)
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.2) },
    });
  for (let i = 0; i < 4; i++)
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096) },
    });
  voice.disconnect();
  release("Option B");
  await flush();
  assert.equal(signal?.aborted, true);
  assert.deepEqual(messages, []);
  assert.equal(values[0], "disconnected");
});
