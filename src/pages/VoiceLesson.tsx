import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Volume2, ArrowLeft, Brain, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import GeminiService from '../lib/geminiService';
import MurfService from '../lib/murfService';

// Web Speech API types
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface VivaQuestion {
  question: string;
  context: string;
}

const VoiceLesson: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const topic = searchParams.get('topic') || 'General Science';
  
  const [status, setStatus] = useState<'idle' | 'generating' | 'speaking' | 'listening' | 'analyzing' | 'complete'>('idle');
  const [questions, setQuestions] = useState<VivaQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const gemini = useRef(GeminiService.getInstance()).current;

  // Initialize Speech Recognition
  useEffect(() => {
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
        if (status === 'listening') stopListening();
      };

      recognitionRef.current = recognition;
    }
  }, [status]);

  // Generate Viva Questions on Mount
  useEffect(() => {
    const generateQuestions = async () => {
      setStatus('generating');
      try {
        const prompt = `Generate 3 viva voce (oral exam) questions for the topic: "${topic}". 
        Return ONLY a JSON array of objects with 'question' and 'context' keys. 
        Example: [{"question": "What is Newton's First Law?", "context": "Mechanics"}]`;
        
        const response = await gemini.generateResponse(prompt);
        // Clean markdown if present
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        setQuestions(parsed);
        setStatus('idle');
      } catch (err) {
        console.error('Failed to generate questions', err);
        setQuestions([{ question: `Explain ${topic} in your own words.`, context: 'General' }]);
        setStatus('idle');
      }
    };
    generateQuestions();
  }, [topic]);

  const speakText = (text: string, onEnd?: () => void) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      setStatus('speaking');
      synthRef.current.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  };

  const startViva = () => {
    if (questions.length === 0) return;
    setCurrentQIndex(0);
    setScore(0);
    askQuestion(0);
  };

  const askQuestion = (index: number) => {
    const q = questions[index];
    setTranscript('');
    setFeedback(null);
    speakText(q.question, () => {
      startListening();
    });
  };

  const startListening = () => {
    setStatus('listening');
    recognitionRef.current?.start();
  };

  const stopListening = () => {
    setStatus('analyzing');
    recognitionRef.current?.stop();
    analyzeAnswer();
  };

  const analyzeAnswer = async () => {
    const q = questions[currentQIndex];
    try {
      const prompt = `
        You are an oral examiner.
        Question: "${q.question}"
        Student Answer: "${transcript}"
        
        Task:
        1. Rate the answer from 0 to 10.
        2. Provide 1 sentence of constructive feedback.
        3. If the answer is totally wrong, correct it briefly.
        
        Format: JSON { "score": number, "feedback": string }
      `;
      
      const response = await gemini.generateResponse(prompt);
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJson);
      
      setFeedback(result.feedback);
      setScore(prev => prev + result.score);
      speakText(result.feedback);
      
    } catch (err) {
      console.error('Analysis failed', err);
      setFeedback('Could not analyze answer. Moving on.');
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      askQuestion(currentQIndex + 1);
    } else {
      setStatus('complete');
      speakText(`Viva complete. You scored ${score} out of ${questions.length * 10}.`);
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl bg-white border-4 border-black shadow-[12px_12px_0px_0px_#000] p-8 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b-4 border-black pb-4">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 font-black uppercase tracking-widest hover:text-neo-accent transition-colors">
            <ArrowLeft className="w-5 h-5" /> EXIT_EXAM
          </button>
          <div className="bg-black text-white px-4 py-1 font-black uppercase text-xs">
            VIVA_VOCE_MODE
          </div>
        </div>

        {/* Content Area */}
        <div className="text-center min-h-[300px] flex flex-col justify-center">
          
          {status === 'generating' && (
            <div className="animate-pulse">
              <Brain className="w-16 h-16 mx-auto mb-4 text-black/20" />
              <h2 className="text-2xl font-black uppercase italic">GENERATING QUESTIONS...</h2>
            </div>
          )}

          {status === 'idle' && questions.length > 0 && (
            <div>
              <h1 className="text-4xl font-black uppercase italic mb-2">{topic}</h1>
              <p className="font-bold text-black/60 mb-8">{questions.length} QUESTIONS READY</p>
              <button 
                onClick={startViva}
                className="bg-neo-accent text-white px-8 py-4 font-black uppercase tracking-widest text-xl border-4 border-black hover:shadow-[8px_8px_0px_0px_#000] active:translate-y-1 transition-all"
              >
                BEGIN_EXAM
              </button>
            </div>
          )}

          {(status === 'speaking' || status === 'listening' || status === 'analyzing') && (
            <div>
              <div className="mb-8">
                <span className="text-xs font-black uppercase tracking-widest text-black/40">QUESTION {currentQIndex + 1} OF {questions.length}</span>
                <h2 className="text-3xl font-black uppercase italic leading-tight mt-2">{questions[currentQIndex]?.question}</h2>
              </div>

              {status === 'listening' && (
                <div className="mb-8">
                  <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse border-4 border-black">
                    <Mic className="w-10 h-10 text-white" />
                  </div>
                  <p className="mt-4 font-black uppercase tracking-widest text-red-500">LISTENING...</p>
                  <p className="mt-2 text-sm font-mono opacity-50 max-w-md mx-auto">"{transcript}"</p>
                  <button 
                    onClick={stopListening}
                    className="mt-6 bg-white text-black px-6 py-2 font-black uppercase border-4 border-black hover:bg-black hover:text-white transition-all"
                  >
                    SUBMIT_ANSWER
                  </button>
                </div>
              )}

              {status === 'analyzing' && feedback && (
                <div className="bg-neo-bg border-4 border-black p-6 mb-8 animate-fade-in">
                  <h3 className="font-black uppercase italic mb-2 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" /> EXAMINER_FEEDBACK
                  </h3>
                  <p className="font-medium text-lg leading-relaxed">"{feedback}"</p>
                  <button 
                    onClick={nextQuestion}
                    className="mt-6 bg-black text-white px-8 py-3 font-black uppercase tracking-widest border-4 border-transparent hover:bg-white hover:text-black hover:border-black transition-all"
                  >
                    NEXT_QUESTION »
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'complete' && (
            <div>
              <div className="w-24 h-24 bg-neo-secondary border-4 border-black flex items-center justify-center mx-auto mb-6 shadow-[8px_8px_0px_0px_#000] rotate-3">
                <Brain className="w-12 h-12 text-black" />
              </div>
              <h2 className="text-4xl font-black uppercase italic mb-4">EXAM_COMPLETE</h2>
              <div className="text-6xl font-black mb-8">
                {score} <span className="text-2xl text-black/40">/ {questions.length * 10}</span>
              </div>
              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-black text-white px-8 py-4 font-black uppercase tracking-widest border-4 border-transparent hover:bg-white hover:text-black hover:border-black transition-all"
              >
                RETURN_TO_BASE
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VoiceLesson;
