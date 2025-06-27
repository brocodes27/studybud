import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// For speech-to-text
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function LiveMeetingNotes({ onSendToQuestionGenerator }: { onSendToQuestionGenerator?: (notes: string) => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);

  // Speech-to-text logic
  const startRecording = () => {
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    setIsRecording(true);
    setError(null);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(interim);
      if (final) {
        setNotes(prev => (prev + '\n' + final).trim());
      }
    };
    recognition.onerror = (event: any) => {
      setError('Speech recognition error: ' + event.error);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setTranscript('');
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setTranscript('');
  };

  // Screen sharing logic
  const startScreenShare = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      // Stop sharing if user ends from browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
      });
    } catch (err) {
      setError('Screen sharing was cancelled or failed.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  };

  // Capture screenshot from video
  const captureScreenshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setScreenshots(prev => [...prev, dataUrl]);
    }
    if (!canvasRef.current) canvasRef.current = canvas;
  };

  // Save notes and screenshots to Supabase
  const handleSave = async () => {
    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }
    setTitleError(null);
    setSaving(true);
    setSaveMessage(null);
    try {
      const { error } = await supabase.from('meeting_notes').insert({
        user_id: user?.id,
        title,
        notes,
        screenshots,
        saved_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSaveMessage('Notes and screenshots saved to cloud!');
      setTitle('');
      setNotes('');
      setScreenshots([]);
    } catch (err: any) {
      setSaveMessage('Failed to save notes: ' + (err.message || err.error_description || 'Unknown error'));
    }
    setSaving(false);
  };

  // Send notes to QuestionGenerator
  const handleSendToQuestionGenerator = () => {
    if (onSendToQuestionGenerator) onSendToQuestionGenerator(notes);
  };

  const handleFormatNotes = async () => {
    if (!notes.trim()) return;
    setFormatting(true);
    setFormatError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/format-notes-with-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to format notes');
      }
      const data = await response.json();
      setNotes(data.formatted_notes || notes);
    } catch (err: any) {
      setFormatError(err.message || 'Unknown error');
    } finally {
      setFormatting(false);
    }
  };

  // Ensure video element always gets the stream
  useEffect(() => {
    if (screenStream && videoRef.current) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-4 text-white">Live Meeting Notes</h2>
      {/* Title input */}
      <div className="mb-4">
        <input
          type="text"
          className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-1"
          placeholder="Title (required)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        {titleError && <div className="text-red-400 text-sm">{titleError}</div>}
      </div>
      {/* Screen Share UI */}
      <div className="mb-4 flex gap-2 items-center">
        {!screenStream ? (
          <button
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg"
            onClick={startScreenShare}
          >
            Share Screen
          </button>
        ) : (
          <button
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg"
            onClick={stopScreenShare}
          >
            Stop Sharing
          </button>
        )}
      </div>
      {screenStream && (
        <div className="mb-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={false}
            className="w-full max-h-64 rounded-lg border border-gray-700 shadow"
            style={{ background: '#222' }}
          />
          {!videoRef.current && (
            <div className="text-red-400 mt-2">Video element failed to render. Please try again or check your browser compatibility.</div>
          )}
          {/* Screenshot button */}
          <button
            className="mt-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
            onClick={captureScreenshot}
          >
            Capture Screenshot
          </button>
        </div>
      )}
      {/* Screenshot gallery */}
      {screenshots.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold text-white mb-2">Captured Screenshots:</div>
          <div className="flex flex-wrap gap-2">
            {screenshots.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Screenshot ${idx + 1}`}
                className="w-32 h-20 object-cover rounded border border-gray-700 shadow"
              />
            ))}
          </div>
        </div>
      )}
      <div className="mb-4 flex gap-2 items-center">
        <button
          className={`py-2 px-4 rounded-lg font-semibold ${isRecording ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Noting!'}
        </button>
        {isRecording && <span className="text-yellow-400">Listening...</span>}
        {transcript && <span className="text-gray-400">{transcript}</span>}
      </div>
      <textarea
        className="w-full h-40 p-3 rounded-lg bg-gray-800 text-white border border-gray-700 mb-4"
        placeholder="Type or dictate your meeting notes here..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex gap-4 mb-2">
        <button
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
        <button
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg"
          onClick={handleSendToQuestionGenerator}
          disabled={!notes.trim()}
        >
          Generate Questions from Notes
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          onClick={handleFormatNotes}
          disabled={formatting || !notes.trim()}
        >
          {formatting ? 'Formatting...' : 'AI Format Notes'}
        </button>
      </div>
      {error && <div className="text-red-400 mt-2">{error}</div>}
      {formatError && <div className="text-red-400 mt-2">{formatError}</div>}
      {saveMessage && <div className="text-green-400 mt-2">{saveMessage}</div>}
    </div>
  );
} 