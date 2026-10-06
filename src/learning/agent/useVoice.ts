import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestVoiceSession,
  executeWorkspaceTool,
  recordWorkspaceTranscript,
} from './api';
import type { WorkspaceEvent, WorkspaceTool } from './contracts';

export type VoiceState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'working'
  | 'speaking'
  | 'muted';

interface UseVoiceOptions {
  onEvent?: (event: WorkspaceEvent) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  checkpointId?: string | null;
}

export function useVoice({
  onEvent,
  onTranscript,
  checkpointId,
}: UseVoiceOptions = {}) {
  const [state, setState] = useState<VoiceState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);
  const activeCheckpointRef = useRef<string | null>(checkpointId || null);

  // Keep track of checkpoint transitions
  useEffect(() => {
    activeCheckpointRef.current = checkpointId || null;
  }, [checkpointId]);

  const stopAudio = useCallback(() => {
    // Stop all queued audio playback
    for (const source of audioQueueRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* ignore */
      }
    }
    audioQueueRef.current = [];
  }, []);

  const disconnect = useCallback(() => {
    stopAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    setState('disconnected');
    setLiveTranscript('');
  }, [stopAudio]);

  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMutedRef.current = !audioTrack.enabled;
      setState(isMutedRef.current ? 'muted' : 'listening');
    }
  }, []);

  const playAudioChunk = useCallback((base64Pcm: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      audioQueueRef.current.push(source);
      source.onended = () => {
        audioQueueRef.current = audioQueueRef.current.filter((s) => s !== source);
        if (audioQueueRef.current.length === 0 && wsRef.current) {
          setState((prev) => (prev === 'speaking' ? 'listening' : prev));
        }
      };

      source.start();
      setState('speaking');
    } catch {
      /* ignore audio playback decode errors */
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setState('connecting');
    setLiveTranscript('');

    try {
      // 1. Get mic access first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Request ephemeral token from server
      const { token, model, config } = await requestVoiceSession();

      // 3. Connect to Gemini Live WebSocket
      const isEphemeral = token.startsWith('auth_tokens/');
      const method = isEphemeral
        ? 'BidiGenerateContentConstrained'
        : 'BidiGenerateContent';
      const keyParam = isEphemeral ? 'access_token' : 'key';
      const apiVersion = 'v1alpha';
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.${method}?${keyParam}=${encodeURIComponent(
        token
      )}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send initial setup frame
        const modelName = model.startsWith('models/')
          ? model
          : `models/${model}`;
        const setupMessage = {
          setup: {
            model: modelName,
            ...(config && typeof config === 'object' ? config : {}),
          },
        };
        ws.send(JSON.stringify(setupMessage));
        setState('listening');

        // Start capturing audio
        const audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32 to Int16 PCM
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Base64 encode
          const u8 = new Uint8Array(pcm16.buffer);
          let binary = '';
          for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
          }
          const base64 = btoa(binary);

          ws.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64,
                  },
                ],
              },
            })
          );
        };
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // User interruption signal from server
          if (data.serverContent?.interrupted) {
            stopAudio();
            setState('listening');
            return;
          }

          // Audio output parts
          const modelTurn = data.serverContent?.modelTurn;
          if (modelTurn?.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData?.data) {
                playAudioChunk(part.inlineData.data);
              }
              if (part.text) {
                setLiveTranscript((prev) => prev + ' ' + part.text);
                onTranscript?.('assistant', part.text);
                void recordWorkspaceTranscript(part.text, 'assistant');
              }
            }
          }

          // Transcribed student audio
          const inputTurn = data.serverContent?.turnComplete;
          if (inputTurn && data.userContent?.parts) {
            for (const part of data.userContent.parts) {
              if (part.text) {
                onTranscript?.('user', part.text);
                void recordWorkspaceTranscript(part.text, 'user');
              }
            }
          }

          // Function calls / tool calls
          if (data.toolCall?.functionCalls) {
            setState('working');
            for (const call of data.toolCall.functionCalls) {
              if (call.name === 'workspace_action') {
                const actionArgs = call.args as {
                  name: string;
                  args: Record<string, unknown>;
                };
                try {
                  const toolObj: WorkspaceTool = {
                    name: actionArgs.name as WorkspaceTool['name'],
                    args: actionArgs.args || {},
                  };
                  const result = await executeWorkspaceTool(
                    toolObj,
                    (ev) => onEvent?.(ev)
                  );

                  // Send response back to Gemini Live
                  ws.send(
                    JSON.stringify({
                      toolResponse: {
                        functionResponses: [
                          {
                            response: { output: result },
                            id: call.id,
                          },
                        ],
                      },
                    })
                  );
                } catch (toolErr) {
                  const errMessage =
                    toolErr instanceof Error
                      ? toolErr.message
                      : 'Tool execution failed';
                  ws.send(
                    JSON.stringify({
                      toolResponse: {
                        functionResponses: [
                          {
                            response: { error: errMessage },
                            id: call.id,
                          },
                        ],
                      },
                    })
                  );
                }
              }
            }
            setState('listening');
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        setError('Voice connection encountered an error.');
        disconnect();
      };

      ws.onclose = () => {
        disconnect();
      };
    } catch (err) {
      disconnect();
      const msg =
        err instanceof Error
          ? err.name === 'NotAllowedError'
            ? 'Microphone permission was denied. You can continue typing in the chat.'
            : err.message
          : 'Could not connect to voice.';
      setError(msg);
    }
  }, [disconnect, onEvent, onTranscript, playAudioChunk, stopAudio]);

  return {
    state,
    error,
    liveTranscript,
    connect,
    disconnect,
    toggleMute,
    isMuted: isMutedRef.current,
  };
}
