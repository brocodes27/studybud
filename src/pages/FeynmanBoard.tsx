import { useState, useEffect } from 'react';
import { Mic, Square, Brain, ArrowLeft, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import Vapi from '@vapi-ai/web';

const vapi = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY || '');

const FeynmanBoard = () => {
  // No user required for session
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    vapi.on('call-start', () => {
      console.log('Vapi call started');
      setIsListening(true);
      setTranscript('');
      setFeedback(null);
    });

    vapi.on('call-end', () => {
      console.log('Vapi call ended');
      setIsListening(false);
    });

    vapi.on('speech-start', () => {
      console.log('User started speaking');
    });

    vapi.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setTranscript(prev => prev + ' ' + message.transcript);
      }
      if (message.type === 'function-call' && message.functionCall.name === 'provideFeedback') {
        // If we were using function calling, but we'll stick to conversation for now
      }
    });

    // Listen for model output text to display as feedback
    vapi.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final' && message.role === 'assistant') {
        setFeedback(message.transcript);
      }
    });

    vapi.on('error', (e) => {
      console.error('Vapi Error:', e);
      showToast('Voice connection error', 'error');
      setIsListening(false);
    });

    return () => {
      // Clean up listeners handled by sdk
    };
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      vapi.stop();
    } else {
      try {
        await vapi.start({
          model: {
            provider: "google",
            model: "gemini-1.5-flash",
            messages: [
              {
                role: "system",
                content: `You are ATLAS, the elite AI study architect. 
                The student is explaining a topic using the Feynman Technique.
                Current Topic: ${topic || 'General Knowledge'}
                
                YOUR GOAL:
                1. Listen to their explanation.
                2. If they stop, provide a textual and audio critique.
                3. Point out logical loops, jargon, or weak spots.
                4. Be sharp, concise (under 80 words), and professional.
                
                Interact as if you are a strict but helpful tutor.`
              }
            ]
          },
          voice: {
            provider: "11labs",
            voiceId: "burt" // A deep, premium male voice
          }
        });
      } catch (err) {
        console.error("Vapi Start Error", err);
        showToast("Failed to start voice session. Check API Key.", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg p-6 pb-20 text-black">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/dashboard" className="flex items-center gap-2 font-black uppercase tracking-widest text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" /> BACK
          </Link>
          <div className="bg-neo-accent text-white px-4 py-1 border-2 border-black shadow-[4px_4px_0px_0px_#000] font-black uppercase text-xs -rotate-2 italic">
            FEYNMAN_BOARD_v5.0 (VAPI_POWERED)
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] relative overflow-hidden">

          {/* Topic Input */}
          <div className="mb-12 text-center">
            <label className="block text-xs font-black uppercase tracking-widest text-black/40 mb-4">
              CURRENT_LEARNING_FOCUS
            </label>
            <input
              type="text"
              placeholder="E.g., Quantum Physics, SAT Algebra..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full text-center text-3xl md:text-5xl font-black uppercase italic border-b-4 border-black focus:outline-none focus:border-neo-accent placeholder-black/20 bg-transparent py-4 text-black"
            />
          </div>

          <div className="min-h-[300px] flex flex-col items-center justify-center mb-8 relative">

            {isListening ? (
              <div className="relative text-center">
                <div className="w-40 h-40 rounded-full border-4 border-black flex items-center justify-center animate-pulse bg-neo-accent text-white shadow-[8px_8px_0px_0px_#000]">
                  <Mic className="w-16 h-16" />
                </div>
                <div className="absolute inset-0 w-full h-full rounded-full border-4 border-neo-accent animate-ping opacity-20"></div>
                <p className="mt-8 font-black uppercase tracking-widest animate-bounce">ATLAS IS LISTENING...</p>
                <p className="text-[10px] font-bold opacity-40 mt-2 uppercase">Explain smoothly. Pause to get feedback.</p>
              </div>
            ) : feedback ? (
              <div className="text-center w-full max-w-2xl animate-fade-in">
                <div className="w-24 h-24 bg-neo-secondary border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-[8px_8px_0px_0px_#000] rotate-3">
                  <Brain className="w-12 h-12 text-black" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest text-black/40 mb-4 italic">ATLAS_FEEDBACK</h3>
                <p className="text-2xl font-bold leading-relaxed mb-8">"{feedback}"</p>
                <button onClick={toggleListening} className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mx-auto hover:text-neo-accent">
                  RESUME SESSION
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Brain className="w-32 h-32 mx-auto mb-4 stroke-1 opacity-20" />
                <p className="font-black uppercase tracking-widest opacity-40">READY_FOR_EXPLANATION</p>
                <p className="text-xs font-bold text-neo-accent mt-4">1. ENTER TOPIC → 2. CONNECT TO ATLAS → 3. CONVERSE</p>
              </div>
            )}

            {/* Live Transcript */}
            {isListening && transcript && (
              <div className="mt-12 p-4 bg-black/5 border-2 border-black/10 rounded w-full text-center max-w-2xl">
                <p className="font-mono text-xs opacity-60 uppercase mb-2">LIVE_TRANSCRIPT</p>
                <p className="text-sm italic">"{transcript}"</p>
              </div>
            )}

          </div>

          {/* Controls */}
          <div className="flex justify-center gap-6">
            {!isListening ? (
              <button
                onClick={toggleListening}
                className="bg-neo-accent text-white border-4 border-black px-10 py-5 font-black uppercase tracking-widest text-xl shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center gap-4 italic"
              >
                <Zap className="w-8 h-8 fill-yellow-300 text-black" /> CONNECT_TO_ATLAS
              </button>
            ) : (
              <button
                onClick={toggleListening}
                className="bg-white text-black border-4 border-black px-8 py-4 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000] hover:bg-red-500 hover:text-white flex items-center gap-2"
              >
                <Square className="w-5 h-5 fill-current" /> DISCONNECT
              </button>
            )}
          </div>

        </div>

        {/* Tip Card */}
        <div className="mt-12 bg-neo-secondary border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000] flex items-start gap-4 -rotate-1">
          <div className="bg-white p-2 border-2 border-black">
            <Zap className="w-6 h-6 text-black fill-yellow-400" />
          </div>
          <div>
            <h4 className="font-black uppercase italic mb-1">ATLAS_PROTOCOL</h4>
            <p className="text-sm font-bold leading-tight">
              If you can't explain it simply, you don't understand it well enough. Atlas will scan your speech for complexity and logical gaps.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FeynmanBoard;
