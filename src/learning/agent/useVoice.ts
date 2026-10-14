import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkVoiceAvailability,
  transcribeVoiceAudio,
  requestVoiceSpeech,
} from "./api";
import { VoiceCapture } from "./voiceAudio";
import { splitSpeechText } from "./speechText";

export type VoiceState =
  | "disconnected"
  | "connecting"
  | "listening"
  | "working"
  | "speaking"
  | "muted";
interface UseVoiceOptions {
  onMessage: (
    text: string,
    signal: AbortSignal,
  ) => Promise<string | null | undefined>;
  busy?: boolean;
}

export function useVoice({ onMessage, busy = false }: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const sessionRef = useRef<AbortController | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const captureRef = useRef(new VoiceCapture());
  const mutedRef = useRef(false);
  const workingRef = useRef(false);
  const optionsRef = useRef({ onMessage, busy });
  optionsRef.current = { onMessage, busy };

  const disconnect = useCallback(() => {
    sessionRef.current?.abort();
    sessionRef.current = null;
    if (playbackRef.current) {
      playbackRef.current.onended = null;
      playbackRef.current.stop();
      playbackRef.current.disconnect();
      playbackRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    captureRef.current.reset();
    mutedRef.current = false;
    workingRef.current = false;
    setIsMuted(false);
    setState("disconnected");
    setLiveTranscript("");
  }, []);

  const processUtterance = useCallback(
    async (wav: Uint8Array, session: AbortController) => {
      workingRef.current = true;
      setState("working");
      setError(null);
      try {
        const text = await transcribeVoiceAudio(
          new Blob([new Uint8Array(wav)], { type: "audio/wav" }),
          session.signal,
        );
        if (session.signal.aborted || !text) return;
        setLiveTranscript(text);
        const reply = await optionsRef.current.onMessage(text, session.signal);
        if (session.signal.aborted || !reply) return;
        for (const chunk of splitSpeechText(reply)) {
          const audio = await requestVoiceSpeech(chunk, session.signal);
          const ctx = contextRef.current;
          if (session.signal.aborted || !ctx) return;
          const buffer = await ctx.decodeAudioData(audio);
          if (session.signal.aborted) return;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          playbackRef.current = source;
          setState("speaking");
          await new Promise<void>((resolve, reject) => {
            const finish = () => {
              session.signal.removeEventListener("abort", finish);
              resolve();
            };
            source.onended = finish;
            session.signal.addEventListener("abort", finish, { once: true });
            try {
              source.start();
            } catch (error) {
              session.signal.removeEventListener("abort", finish);
              reject(error);
            }
          });
          source.disconnect();
          if (playbackRef.current === source) playbackRef.current = null;
          if (session.signal.aborted) return;
        }
      } catch (err) {
        if (!session.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : "Voice failed. You can keep typing.",
          );
      } finally {
        if (sessionRef.current === session) {
          workingRef.current = false;
          captureRef.current.reset();
          setState(mutedRef.current ? "muted" : "listening");
        }
      }
    },
    [],
  );

  const connect = useCallback(async () => {
    if (sessionRef.current) return;
    const session = new AbortController();
    sessionRef.current = session;
    setError(null);
    setState("connecting");
    setLiveTranscript("");
    try {
      // Create/resume during the user's click so mobile browsers allow playback.
      const ctx = new AudioContext({ sampleRate: 16000 });
      contextRef.current = ctx;
      await ctx.resume();
      await checkVoiceAvailability(session.signal);
      if (session.signal.aborted) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (session.signal.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (ctx.sampleRate !== 16000)
        throw new Error(
          "This browser cannot record 16 kHz audio. You can keep typing.",
        );
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(ctx.destination);
      processor.onaudioprocess = (event) => {
        // Half-duplex capture prevents the assistant from transcribing its own reply.
        if (
          session.signal.aborted ||
          mutedRef.current ||
          workingRef.current ||
          optionsRef.current.busy
        ) {
          captureRef.current.reset();
          return;
        }
        const wav = captureRef.current.push(
          event.inputBuffer.getChannelData(0),
        );
        if (wav) void processUtterance(wav, session);
      };
      setState("listening");
    } catch (err) {
      if (session.signal.aborted) return;
      disconnect();
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission was denied. You can keep typing."
          : err instanceof Error
            ? err.message
            : "Could not start voice.",
      );
    }
  }, [disconnect, processUtterance]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    mutedRef.current = !mutedRef.current;
    streamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !mutedRef.current;
    });
    captureRef.current.reset();
    setIsMuted(mutedRef.current);
    if (!workingRef.current) setState(mutedRef.current ? "muted" : "listening");
  }, []);

  useEffect(() => disconnect, [disconnect]);
  return {
    state,
    error,
    liveTranscript,
    connect,
    disconnect,
    toggleMute,
    isMuted,
  };
}
