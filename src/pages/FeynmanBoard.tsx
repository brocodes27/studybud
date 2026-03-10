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
    <div className="pb-20 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-[#F472B6]/10 border border-[#F472B6]/20 rounded-[20px] flex items-center justify-center shadow-float-pink">
            <Brain className="h-7 w-7 text-[#F472B6] stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0A192F] tracking-tight">Feynman Board</h1>
            <p className="text-[#64748B] font-medium">Explain it to Atlas. Learn by teaching.</p>
          </div>
          <Link to="/dashboard" className="ml-auto flex items-center gap-2 text-[#64748B] hover:text-[#0A192F] font-bold text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {/* Main Card */}
        <div className="neo-card">
          {/* Topic Input */}
          <div className="mb-10 text-center">
            <label className="block text-xs font-bold uppercase tracking-widest text-[#64748B] mb-3">
              What are you studying?
            </label>
            <input
              type="text"
              placeholder="E.g., Quantum Physics, SAT Algebra..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full text-center text-2xl md:text-3xl font-extrabold border-b-2 border-[#0A192F]/10 focus:outline-none focus:border-[#00D1FF] placeholder-[#0A192F]/20 bg-transparent py-3 text-[#0A192F] transition-colors"
            />
          </div>

          <div className="min-h-[280px] flex flex-col items-center justify-center mb-8">
            {isListening ? (
              <div className="relative text-center">
                <div className="w-36 h-36 rounded-full border-2 border-[#F472B6]/20 flex items-center justify-center animate-pulse bg-[#F472B6]/10 text-[#F472B6] shadow-float-pink">
                  <Mic className="w-14 h-14" />
                </div>
                <div className="absolute inset-0 w-full h-full rounded-full border-2 border-[#F472B6] animate-ping opacity-20"></div>
                <p className="mt-8 font-extrabold text-[#0A192F] tracking-wide animate-bounce">Atlas is listening...</p>
                <p className="text-xs font-medium text-[#64748B] mt-2">Explain smoothly. Pause to get feedback.</p>
              </div>
            ) : feedback ? (
              <div className="text-center w-full max-w-2xl animate-fade-in">
                <div className="w-20 h-20 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[20px] flex items-center justify-center mx-auto mb-5 shadow-float-cyan">
                  <Brain className="w-10 h-10 text-[#00D1FF]" />
                </div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-4">Atlas Feedback</p>
                <p className="text-xl font-medium leading-relaxed text-[#0A192F] mb-6">"{feedback}"</p>
                <button onClick={toggleListening} className="text-sm font-bold text-[#00D1FF] hover:underline flex items-center gap-2 mx-auto">
                  Resume Session
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Brain className="w-24 h-24 mx-auto mb-4 text-[#0A192F]/10" />
                <p className="font-bold text-[#64748B]">Ready for your explanation</p>
                <p className="text-sm text-[#00D1FF] font-medium mt-3">1. Enter topic → 2. Connect to Atlas → 3. Start explaining</p>
              </div>
            )}

            {isListening && transcript && (
              <div className="mt-10 p-5 bg-[#F8FAFF] border-2 border-[#0A192F]/5 rounded-[20px] w-full max-w-2xl text-center">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-2">Live Transcript</p>
                <p className="text-sm italic text-[#0A192F]">"{transcript}"</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {!isListening ? (
              <button
                onClick={toggleListening}
                className="neo-button px-10 py-4 text-base flex items-center gap-3"
              >
                <Zap className="w-5 h-5" /> Connect to Atlas
              </button>
            ) : (
              <button
                onClick={toggleListening}
                className="px-8 py-4 rounded-[16px] bg-red-50 border-2 border-red-200 text-red-600 font-bold hover:bg-red-100 transition-all flex items-center gap-2"
              >
                <Square className="w-5 h-5 fill-current" /> Stop Session
              </button>
            )}
          </div>
        </div>

        {/* Tip Card */}
        <div className="mt-8 bg-[#F8FAFF] rounded-[24px] border-2 border-[#0A192F]/5 p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[12px] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-[#00D1FF]" />
          </div>
          <div>
            <h4 className="font-extrabold text-[#0A192F] mb-1 tracking-tight">The Feynman Technique</h4>
            <p className="text-sm font-medium text-[#64748B] leading-relaxed">
              If you can't explain it simply, you don't understand it well enough. Atlas will scan your speech for complexity and logical gaps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeynmanBoard;
