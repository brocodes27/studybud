import React, { useState, useEffect, useRef } from 'react';
import VAPIService from '../lib/vapiService';
import { useAuth } from '../contexts/AuthContext';

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

const VoiceLectureInterface: React.FC<VoiceLectureInterfaceProps> = ({
  lessonId,
  lessonTitle,
  topic,
  onComplete,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState('friendly');
  const [status, setStatus] = useState<string>('Initializing...');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const vapiService = VAPIService.getInstance();
  const { user } = useAuth() as any;

  useEffect(() => {
    // Initialize VAPI call when component mounts
    initializeVAPICall();
    
    // Cleanup on unmount
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (callId) {
        vapiService.endCall(callId);
      }
    };
  }, []);

  const initializeVAPICall = async () => {
    try {
      setStatus('Initializing voice call...');
      const call = await vapiService.initializeCall(topic, selectedPersonality);
      setCallId(call.id);
      
      // Check if this is a real call or fallback
      if (call.id.startsWith('mock-call') || call.id.startsWith('fallback-call')) {
        // This is a fallback/mock call
        setIsCallActive(false);
        setStatus('Voice service unavailable - using text mode');
        addMessage('ai', `Hello! I'm your AI tutor. Let's explore ${topic} together. Since voice features are currently unavailable, you can type your responses and I'll help you learn through text-based conversation.`);
        return;
      }
      
      // This is a real VAPI call
      setIsCallActive(true);
      setStatus('Connecting to voice service...');
      
      // Connect to VAPI WebSocket stream
      const ws = vapiService.connectToCall(call.id, handleWebSocketMessage);
      setWsConnection(ws);
      
      if (ws) {
        setStatus('Connected! Speak to your AI tutor.');
        // Add initial greeting
        setTimeout(() => {
          addMessage('ai', `Hello! I'm Elliot, your AI tutor. Let's explore ${topic} together. What do you know about this topic?`);
        }, 1000);
      } else {
        throw new Error('Failed to connect to voice stream');
      }
    } catch (error) {
      console.error('Error initializing VAPI call:', error);
      setStatus('Voice service unavailable - using text mode');
      
      // Provide a fallback experience
      addMessage('ai', `Hello! I'm your AI tutor. Let's explore ${topic} together. Since voice features are currently unavailable, you can type your responses and I'll help you learn through text-based conversation.`);
      
      // Set up fallback mode
      setIsCallActive(false);
      setCallId('fallback-' + Date.now());
    }
  };

  const handleWebSocketMessage = (data: any) => {
    console.log('WebSocket message received:', data);
    
    switch (data.type) {
      case 'message':
        // AI is speaking
        setIsSpeaking(true);
        addMessage('ai', data.content);
        // Play audio if available
        if (data.audioUrl) {
          playAudio(data.audioUrl);
        }
        break;
        
      case 'user-input':
        // User spoke
        setIsListening(false);
        addMessage('user', data.content);
        break;
        
      case 'listening':
        // AI is listening for user input
        setIsListening(true);
        setIsSpeaking(false);
        setStatus('Listening... Speak now!');
        break;
        
      case 'speaking':
        // AI is speaking
        setIsSpeaking(true);
        setIsListening(false);
        setStatus('AI is speaking...');
        break;
        
      case 'error':
        console.error('VAPI WebSocket error:', data);
        setStatus('Connection error - trying to reconnect...');
        break;
        
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (type: 'ai' | 'user', content: string, isTyping?: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      isTyping
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleVoiceInput = () => {
    if (isCallActive && wsConnection) {
      if (isListening) {
        // Stop listening
        setIsListening(false);
        setStatus('Voice input stopped');
      } else {
        // Start listening
        setIsListening(true);
        setStatus('Listening for voice input...');
        // Send a message to VAPI to start listening
        wsConnection.send(JSON.stringify({ type: 'start-listening' }));
      }
    } else {
      setStatus('Voice service not available');
    }
  };

  const handleTextInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    addMessage('user', currentInput);
    
    if (isCallActive && wsConnection) {
      // Send text input to VAPI
      wsConnection.send(JSON.stringify({ 
        type: 'text-input', 
        content: currentInput 
      }));
    } else {
      // Fallback: simulate AI response
      setTimeout(() => {
        addMessage('ai', `I understand you said: "${currentInput}". Let's continue our conversation about ${topic}. What would you like to know more about?`);
      }, 1000);
    }
    
    setCurrentInput('');
  };

  const completeLesson = async () => {
    setIsCompleted(true);
    setStatus('Lesson completed!');
    
    // Save conversation data
    if (callId && user) {
      try {
        await vapiService.saveVoiceLectureData(user.id, lessonId, {
          topic,
          transcript: messages.map(m => `${m.type}: ${m.content}`).join('\n'),
          progress: 100,
          accuracy: 85,
          xpEarned: 50
        });
      } catch (error) {
        console.error('Error saving voice lecture data:', error);
      }
    }
    
    // Call completion callback
    onComplete(85, 50);
  };

  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-700 p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">{lessonTitle}</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isCallActive ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-sm text-gray-300">
                {isCallActive ? 'Voice Active' : 'Text Mode Only'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <select 
              value={selectedPersonality} 
              onChange={(e) => setSelectedPersonality(e.target.value)}
              disabled={isCallActive}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
            >
              <option value="friendly">Friendly</option>
              <option value="encouraging">Encouraging</option>
              <option value="strict">Strict</option>
              <option value="socratic">Socratic</option>
            </select>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-white'
                }`}
              >
                {message.isTyping ? (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice Controls */}
        <div className="bg-gray-700 p-4 rounded-b-xl">
          {!isCallActive ? (
            <div className="text-center mb-4">
              <div className="bg-yellow-600 text-white p-3 rounded-lg mb-4">
                <p className="font-semibold">🎤 Voice Mode Unavailable</p>
                <p className="text-sm">Please check your VAPI API key configuration</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-4 mb-4">
              <button
                onClick={handleVoiceInput}
                className={`flex items-center space-x-2 px-6 py-3 rounded-full font-semibold transition-all ${
                  isListening
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isListening ? (
                  <>
                    <div className="w-4 h-4 bg-red-400 rounded-full animate-pulse"></div>
                    <span>Stop Listening</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span>Start Voice</span>
                  </>
                )}
              </button>

              {isSpeaking && (
                <div className="flex items-center space-x-2 text-green-400">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span>AI Speaking...</span>
                </div>
              )}
            </div>
          )}

          {/* Text Input Fallback */}
          <form onSubmit={handleTextInput} className="flex space-x-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </form>
        </div>

        {/* Hidden Audio Element */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default VoiceLectureInterface; 