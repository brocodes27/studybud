import { useState, useEffect, useRef } from 'react';
import VAPIService from '../lib/vapiService';
import { useAuth } from '../contexts/AuthContext';
import { X, Mic, Send, Brain, Target, MessageSquare } from 'lucide-react';
import { FeatureGate } from './FeatureGate';

interface VoiceLectureInterfaceProps {
  lessonId: string;
  lessonTitle: string;
  topic: string;
  onComplete: (accuracy: number, xpEarned: number) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export function VoiceLectureInterface({
  lessonId,
  lessonTitle,
  topic,
  onComplete,
  onClose
}: VoiceLectureInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState('friendly');
  const [status, setStatus] = useState<string>('INITIALIZING_CORES...');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const vapiService = VAPIService.getInstance();
  const { user, isPremium } = useAuth() as any;

  useEffect(() => {
    // Only initialize call if premium
    if (isPremium) {
      initializeVAPICall();
    } else {
      setStatus('ACCESS_DENIED: PREMIUM_REQUIRED');
      addMessage('ai', 'ACCESS_RESTRICTION: NEURAL_VOICE_CIRCUITS_REQUIRE_PREMIUM_AUTHORIZATION.');
    }

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (callId) {
        vapiService.endCall(callId);
      }
    };
  }, [isPremium]);

  const initializeVAPICall = async () => {
    try {
      setStatus('CONNECTING_VAPI_CORE...');
      const call = await vapiService.initializeCall(topic, selectedPersonality);
      setCallId(call.id);

      if (call.id.startsWith('mock-call') || call.id.startsWith('fallback-call')) {
        setIsCallActive(false);
        setStatus('VOICE_STREAM_NULL: FALLBACK_TO_TEXT');
        addMessage('ai', `HELLO_HUMAN! I'M YOUR NEURAL_MODERATOR. LET'S EXPLORE ${topic.toUpperCase()} TOGETHER. VOICE_CIRCUITS_ARE_OFFLINE. PROTOCOL: TEXT_INPUT_ACTIVE.`);
        return;
      }

      setIsCallActive(true);
      setStatus('ESTABLISHING_SYNC...');

      const ws = vapiService.connectToCall(call.id, handleWebSocketMessage);
      setWsConnection(ws);

      if (ws) {
        setStatus('SYNC_ESTABLISHED: SPEAK_NOW');
        setTimeout(() => {
          addMessage('ai', `GREETINGS. I AM ELLIOT_V2. SYSTEM_SYNC_COMPLETE. SUBJECT: ${topic.toUpperCase()}. INITIALIZING_QUERY_STREAM.`);
        }, 1000);
      } else {
        throw new Error('STREAM_CONNECT_FAILURE');
      }
    } catch (error) {
      console.error('VAPI_INIT_ERROR:', error);
      setStatus('PROTOCOL_FAILURE: TEXT_OVERRIDE');
      addMessage('ai', `CRITICAL_ERROR: VOICE_SYSTEMS_COMPROMISED. SWITCHING_TO_TEXT_SYNC. LET'S ANALYZE ${topic.toUpperCase()}.`);
      setIsCallActive(false);
      setCallId('fallback-' + Date.now());
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'message':
        setIsSpeaking(true);
        addMessage('ai', data.content);
        if (data.audioUrl) playAudio(data.audioUrl);
        break;
      case 'user-input':
        setIsListening(false);
        addMessage('user', data.content);
        break;
      case 'listening':
        setIsListening(true);
        setIsSpeaking(false);
        setStatus('CORE_LISTENING...');
        break;
      case 'speaking':
        setIsSpeaking(true);
        setIsListening(false);
        setStatus('AI_TRANSMITTING...');
        break;
      default:
        console.log('UNHANDLED_WS_PACKET:', data.type);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(console.error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (type: 'ai' | 'user', content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    }]);
  };

  const handleVoiceInput = () => {
    if (isCallActive && wsConnection) {
      if (isListening) {
        setIsListening(false);
        setStatus('SYNC_PAUSED');
      } else {
        setIsListening(true);
        setStatus('LISTENING_FOR_WAVES...');
        wsConnection.send(JSON.stringify({ type: 'start-listening' }));
      }
    } else {
      setStatus('VOICE_IO_DENIED');
    }
  };

  const handleTextInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    addMessage('user', currentInput);

    if (isCallActive && wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'text-input',
        content: currentInput
      }));
    } else {
      setTimeout(() => {
        addMessage('ai', `SYNC_RECEIVED: "${currentInput.toUpperCase()}". PROCESSING_QUERY_UPSTREAM. WHAT_IS_YOUR_NEXT_ITERATION?`);
      }, 1000);
    }

    setCurrentInput('');
  };

  const completeLesson = async () => {
    setIsCompleted(true);
    setStatus('SEQUENCE_COMPLETE');

    if (callId && user) {
      try {
        await vapiService.saveVoiceLectureData(user.id, lessonId, {
          topic,
          transcript: messages.map(m => `${m.type.toUpperCase()}: ${m.content}`).join('\n'),
          progress: 100,
          accuracy: 85,
          xpEarned: 50
        });
      } catch (error) {
        console.error('DATA_SYNC_ERROR:', error);
      }
    }

    onComplete(85, 50);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[110] backdrop-blur-[4px] p-4">
      <div className="bg-slate-800 border border-white/10 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-neo">

        {/* Header */}
        <div className="p-8 border-b-8 border-white/10 bg-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-neo-secondary border border-white/10 p-4 shadow-neo rotate-3">
              <Brain className="h-10 w-10 text-slate-100 stroke-[4px]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tighter italic leading-none">{lessonTitle}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-0.5 font-black uppercase text-[10px] tracking-widest border border-white/10 ${isCallActive ? 'bg-neo-accent text-white' : 'bg-slate-900 text-slate-100'}`}>
                  {isPremium ? (isCallActive ? 'VOICE_SYNC_ON' : 'TEXT_MODE_ONLY') : 'PREMIUM_LOCKED'}
                </span>
                {isPremium && (
                  <span className="text-[10px] font-black text-slate-100/40 uppercase tracking-widest italic truncate max-w-[200px]">
                    [{status}]
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedPersonality}
              onChange={(e) => setSelectedPersonality(e.target.value)}
              disabled={isCallActive || !isPremium}
              className="bg-slate-800 border border-white/10 px-4 py-2 font-black uppercase text-xs tracking-widest italic outline-none focus:bg-slate-900 transition-all disabled:opacity-50"
            >
              <option value="friendly">NEUTRAL_FRIENDLY</option>
              <option value="encouraging">HIGH_ENCOURAGE</option>
              <option value="strict">MASTER_STRICT</option>
              <option value="socratic">SOCRATIC_DEEP</option>
            </select>

            <button
              onClick={onClose}
              className="bg-slate-800 border border-white/10 p-2 hover:bg-neo-accent hover:text-white transition-all shadow-neo active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <X className="h-8 w-8 stroke-[4px]" />
            </button>
          </div>
        </div>

        <FeatureGate fallback="lock" featureName="Neural Voice Lecture">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-950/5 custom-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-6 border border-white/10 shadow-neo relative ${message.type === 'user'
                    ? 'bg-neo-secondary -rotate-1'
                    : 'bg-slate-800 rotate-1'
                    }`}
                >
                  <div className={`absolute -top-4 ${message.type === 'user' ? '-right-4' : '-left-4'} bg-slate-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest`}>
                    {message.type.toUpperCase()}_ID
                  </div>
                  <p className="font-black text-xl italic uppercase tracking-tight leading-tight">{message.content}</p>
                  <span className="text-[10px] font-black opacity-30 mt-4 block uppercase tracking-widest">
                    SYNC_TIME: {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Controls */}
          <div className="p-8 border-t-8 border-white/10 bg-slate-800 space-y-8">
            <div className="flex items-center gap-6">
              <button
                onClick={handleVoiceInput}
                className={`flex-1 flex items-center justify-center gap-4 px-10 py-6 border border-white/10 font-black uppercase italic tracking-tighter text-2xl transition-all shadow-neo hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-0 active:translate-y-0 active:shadow-none ${isListening
                  ? 'bg-neo-accent text-white animate-pulse'
                  : 'bg-neo-secondary text-slate-100'
                  }`}
              >
                {isListening ? (
                  <>
                    <Target className="h-8 w-8 animate-spin" />
                    <span>STOP_SCANNING_VOICE</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-8 w-8 stroke-[4px]" />
                    <span>INITIALIZE_VOICE_SYNC</span>
                  </>
                )}
              </button>
              <button
                onClick={completeLesson}
                className="px-10 py-6 border border-white/10 bg-slate-900 text-white font-black uppercase italic tracking-tighter text-2xl hover:bg-neo-accent transition-all shadow-neo"
              >
                FINISH_CONV
              </button>
            </div>

            <form onSubmit={handleTextInput} className="flex gap-6">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="TYPE_SYSTEM_INPUT_HERE..."
                  className="w-full bg-slate-800 border border-white/10 px-8 py-5 font-black text-xl uppercase italic tracking-tighter focus:bg-slate-900 outline-none transition-all shadow-neo"
                />
                <MessageSquare className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-100/20 h-8 w-8" />
              </div>
              <button
                type="submit"
                className="bg-slate-900 text-white px-10 py-5 border border-white/10 font-black uppercase italic tracking-tighter text-2xl hover:bg-neo-accent transition-all shadow-neo active:translate-y-1 active:shadow-none"
              >
                <Send className="h-8 w-8 stroke-[4px]" />
              </button>
            </form>
          </div>
        </FeatureGate>

        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default VoiceLectureInterface;