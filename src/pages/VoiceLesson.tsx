import React, { useEffect, useRef, useState } from 'react';
import MurfService from '../lib/murfService';
import GeminiService from '../lib/geminiService';

// Simple voice lesson loop: Play prompt (TTS) -> Record answer -> Transcribe (STT)
// This page is a minimal scaffold you can link into your router.

const prompts = [
  'Say: Hello, how are you?',
  'Describe your day in one sentence.',
  'Ask for directions to the nearest station.'
];

const VoiceLesson: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const murf = useRef(MurfService.getInstance()).current;
  const gemini = useRef(GeminiService.getInstance()).current;

  const log = (s: string) => setLogs((prev) => [s, ...prev].slice(0, 200));

  const ensureMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (e: any) {
      setError('Mic permission denied');
      throw e;
    }
  };

  const playPrompt = async () => {
    setError('');
    const text = prompts[current] || 'Say anything you like.';
    try {
      await murf.playText(text, { voiceId: undefined });
      log(`Played prompt: ${text}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to play prompt');
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await ensureMic();
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const base64 = await blobToBase64NoPrefix(blob);
          const text = await gemini.transcribeAudio(base64, blob.type);
          setTranscript(text);
          log(`Transcript: ${text}`);
        } catch (e: any) {
          setError(e?.message || 'Transcription failed');
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      log('Recording started');
    } catch (e: any) {
      setError(e?.message || 'Failed to start recording');
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      log('Recording stopped');
    } catch (e: any) {
      setError(e?.message || 'Failed to stop recording');
    }
  };

  const nextPrompt = () => {
    setTranscript('');
    setCurrent((c) => (c + 1) % prompts.length);
  };

  useEffect(() => {
    // hint: set VITE_MURF_TTS_URL to your Supabase function URL for murf-tts
    // e.g., https://<project>.functions.supabase.co/murf-tts
  }, []);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Voice Lesson</h1>

      <div className="p-3 border rounded">
        <div className="font-medium">Prompt</div>
        <div className="text-gray-800">{prompts[current]}</div>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={playPrompt}>
            Play Prompt (TTS)
          </button>
          {!recording ? (
            <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={startRecording}>
              Start Recording
            </button>
          ) : (
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={stopRecording}>
              Stop Recording
            </button>
          )}
          <button className="px-3 py-2 bg-gray-200 rounded" onClick={nextPrompt}>
            Next Prompt
          </button>
        </div>
      </div>

      <div className="p-3 border rounded">
        <div className="font-medium">Transcript</div>
        <div className="min-h-[3rem] whitespace-pre-wrap">{transcript || '—'}</div>
      </div>

      {error && (
        <div className="p-3 border rounded border-red-300 bg-red-50 text-red-800">{error}</div>
      )}

      <div className="p-3 border rounded">
        <div className="font-medium">Logs</div>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          {logs.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

async function blobToBase64NoPrefix(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  // btoa handles binary to base64, we return the data part only
  return btoa(binary);
}

export default VoiceLesson;
