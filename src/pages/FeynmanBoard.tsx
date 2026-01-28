import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Volume2, Brain, Sparkles, AlertCircle, ArrowLeft, CheckCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import GeminiService from '../lib/geminiService';
import { useAuth } from '../contexts/AuthContext';

// Web Speech API types
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const FeynmanBoard = () => {
  const { user } = useAuth() as any;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topic, setTopic] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  useEffect(() => {
    // Initialize Speech Recognition
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionConstructor = SpeechRecognition || webkitSpeechRecognition;

    if (SpeechRecognitionConstructor) {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setFeedback(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript) return;
    setIsListening(false);
    recognitionRef.current?.stop();
    setIsProcessing(true);

    try {
      const gemini = GeminiService.getInstance();
      const prompt = `
        You are Elliot, a friendly and encouraging study buddy. 
        The student is using the Feynman Technique to explain the topic: "${topic || 'General Topic'}".
        
        Student's Explanation: "${transcript}"
        
        Your Goal:
        1. Rate their understanding (Beginner, Intermediate, Master).
        2. Identify what they got right.
        3. Gently point out misconceptions or missing key details.
        4. Ask ONE follow-up question to test deeper understanding.
        
        Keep it conversational, short (under 100 words), and encouraging.
      `;
      
      const response = await gemini.generateResponse(prompt);
      setFeedback(response);
      speakFeedback(response);
    } catch (error) {
      console.error(error);
      setFeedback("My brain circuits are a bit fried. Can you try explaining that again?");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakFeedback = (text: string) => {
    if (synthRef.current) {
      // Cancel existing speech
      synthRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      // Try to select a "friendly" voice
      const voices = synthRef.current.getVoices();
      const friendlyVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
      if (friendlyVoice) utterance.voice = friendlyVoice;
      
      utterance.rate = 1.1;
      utterance.pitch = 1.05;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg p-6 pb-20">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/dashboard" className="flex items-center gap-2 font-black uppercase tracking-widest text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" /> Return to Base
          </Link>
          <div className="bg-neo-accent text-white px-4 py-1 border-2 border-black shadow-[4px_4px_0px_0px_#000] font-black uppercase text-xs -rotate-2">
            THE FEYNMAN BOARD
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_#000] relative overflow-hidden">
          
          {/* Topic Input */}
          <div className="mb-12 text-center">
            <label className="block text-xs font-black uppercase tracking-widest text-black/40 mb-4">
              WHAT ARE YOU TEACHING ME TODAY?
            </label>
            <input 
              type="text" 
              placeholder="E.g., Quantum Entanglement, The French Revolution..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full text-center text-3xl md:text-5xl font-black uppercase italic border-b-4 border-black focus:outline-none focus:border-neo-accent placeholder-black/20 bg-transparent py-4"
            />
          </div>

          {/* Visualization / Feedback Area */}
          <div className="min-h-[300px] flex flex-col items-center justify-center mb-8 relative">
            
            {isListening ? (
              <div className="relative">
                <div className="w-40 h-40 rounded-full border-4 border-black flex items-center justify-center animate-pulse bg-red-500 text-white shadow-[8px_8px_0px_0px_#000]">
                  <Mic className="w-16 h-16" />
                </div>
                <div className="absolute inset-0 w-full h-full rounded-full border-4 border-red-500 animate-ping opacity-20"></div>
                <p className="mt-8 font-black uppercase tracking-widest animate-bounce text-center">LISTENING...</p>
              </div>
            ) : isProcessing ? (
              <div className="text-center">
                <div className="w-24 h-24 border-8 border-black border-t-neo-accent rounded-full animate-spin mb-8 mx-auto"></div>
                <h3 className="text-2xl font-black uppercase italic">ANALYZING LOGIC...</h3>
              </div>
            ) : feedback ? (
               <div className="text-center w-full max-w-2xl animate-fade-in">
                 <div className="w-24 h-24 bg-neo-secondary border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-[8px_8px_0px_0px_#000] rotate-3">
                   <Brain className="w-12 h-12 text-black" />
                 </div>
                 <h3 className="text-xl font-black uppercase tracking-widest text-black/40 mb-4">FEEDBACK REPORT</h3>
                 <p className="text-2xl font-bold leading-relaxed mb-8">"{feedback}"</p>
                 <button onClick={() => speakFeedback(feedback)} className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mx-auto hover:text-neo-accent">
                   <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-neo-accent' : ''}`} /> 
                   {isSpeaking ? 'SPEAKING...' : 'REPLAY AUDIO'}
                 </button>
               </div>
            ) : (
              <div className="text-center opacity-40">
                <Brain className="w-32 h-32 mx-auto mb-4 stroke-1" />
                <p className="font-black uppercase tracking-widest">READY TO LEARN</p>
              </div>
            )}

            {/* Transcript Preview */}
            {transcript && (
              <div className="mt-12 p-6 bg-black/5 border-2 border-black/10 rounded w-full text-center">
                <p className="font-mono text-sm opacity-60">"{transcript}"</p>
              </div>
            )}

          </div>

          {/* Controls */}
          <div className="flex justify-center gap-6">
            {!isListening ? (
              <button 
                onClick={toggleListening}
                className="bg-neo-accent text-white border-4 border-black px-10 py-5 font-black uppercase tracking-widest text-xl shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center gap-4"
              >
                <Mic className="w-8 h-8" /> START EXPLAINING
              </button>
            ) : (
              <div className="flex gap-4">
                <button 
                  onClick={toggleListening}
                  className="bg-white text-black border-4 border-black px-8 py-4 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000] hover:bg-red-100 flex items-center gap-2"
                >
                  <Square className="w-5 h-5 fill-current" /> PAUSE
                </button>
                <button 
                  onClick={handleAnalyze}
                  className="bg-black text-white border-4 border-black px-8 py-4 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#999] hover:bg-neo-secondary hover:text-black flex items-center gap-2 animate-pulse"
                >
                  <Sparkles className="w-5 h-5" /> ANALYZE NOW
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Tip Card */}
        <div className="mt-12 bg-neo-secondary border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000] flex items-start gap-4 -rotate-1">
          <div className="bg-white p-2 border-2 border-black">
            <Zap className="w-6 h-6 text-black fill-yellow-400" />
          </div>
          <div>
            <h4 className="font-black uppercase italic mb-1">WHY THIS WORKS</h4>
            <p className="text-sm font-bold leading-tight">
              The "Feynman Technique" forces your brain to reconstruct knowledge from scratch. If you can't explain it simply, you don't understand it well enough.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FeynmanBoard;
