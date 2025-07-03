import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Mic, MicOff, Loader2, Brain, BookOpen, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  subject?: string;
  topic?: string;
}

interface StudyPlan {
  id: string;
  subject: string;
  class: string;
  chapters: string;
  plan: {
    daily_schedule: Array<{
      day: number;
      topic: string;
      description: string;
    }>;
  };
}

export function AIStudyBuddy() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        content: `👋 Hi! I'm your AI Study Buddy. I can help you with:
        
📚 **Subject Questions**: Ask me anything about your subjects
🎯 **Study Plan Help**: Get guidance on your current study topics
📝 **Homework Help**: Get step-by-step explanations
🧠 **Concept Clarification**: I'll explain complex topics simply
📊 **Practice Questions**: Request additional practice problems

What would you like to study today?`,
        role: 'assistant',
        timestamp: new Date(),
      }
    ]);
  }, []);

  // Fetch user's study plans
  useEffect(() => {
    const fetchStudyPlans = async () => {
      if (!session?.user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('exam_plans')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setStudyPlans(data || []);
      } catch (error) {
        console.error('Error fetching study plans:', error);
      }
    };

    fetchStudyPlans();
  }, [session?.user?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getCurrentStudyContext = () => {
    if (!selectedPlan) return '';
    
    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (!plan) return '';
    
    const today = new Date();
    const planStartDate = new Date(plan.plan.daily_schedule[0]?.date || '');
    const daysSinceStart = Math.floor((today.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const currentDay = plan.plan.daily_schedule[daysSinceStart] || plan.plan.daily_schedule[0];
    
    return `
Current Study Context:
- Subject: ${plan.subject}
- Class: ${plan.class}
- Today's Topic: ${currentDay?.topic || 'General'}
- Study Description: ${currentDay?.description || 'No specific description'}
- Chapters: ${plan.chapters}
`;
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      let context = getCurrentStudyContext();
      if (!context || context.trim() === '') {
        context = 'General study context.';
      }
      const selectedPlanObj = studyPlans.find(p => p.id === selectedPlan);
      const subject = selectedPlanObj?.subject || 'General';
      let classValue = selectedPlanObj?.class || '';
      if (!classValue || classValue.trim() === '') {
        classValue = '10'; // Default to class 10 or another sensible default
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-study-buddy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: content.trim(),
          studyContext: context,
          subject,
          class: classValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        subject: studyPlans.find(p => p.id === selectedPlan)?.subject,
        topic: studyPlans.find(p => p.id === selectedPlan)?.plan.daily_schedule[0]?.topic,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to get response from AI. Please try again.', 'error');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again or rephrase your question.',
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const startVoiceRecording = () => {
    if (!('webkitSpeechRecognition' in window)) {
      showToast('Voice recording is not supported in your browser', 'error');
      return;
    }

    setIsRecording(true);
    setIsListening(true);

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);
      setIsRecording(false);
      sendMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setIsRecording(false);
      showToast('Voice recognition failed. Please try typing instead.', 'error');
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsRecording(false);
    };

    recognition.start();
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    setIsListening(false);
  };

  const getSuggestedQuestions = () => {
    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (!plan) return [];

    return [
      `Explain ${plan.subject} concepts in simple terms`,
      `Help me understand ${plan.plan.daily_schedule[0]?.topic || 'today\'s topic'}`,
      `Give me practice questions for ${plan.subject}`,
      `What are the key points to remember for ${plan.chapters.split(',')[0]?.trim()}`,
    ];
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-700/50">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">AI Study Buddy</h2>
          <p className="text-sm text-gray-400">Your personal learning assistant</p>
        </div>
        <div className="ml-auto">
          <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
        </div>
      </div>

      {/* Study Plan Selector */}
      {studyPlans.length > 0 && (
        <div className="p-4 border-b border-gray-700/50">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <BookOpen className="h-4 w-4 inline mr-2" />
            Select Study Plan (for context)
          </label>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">No study plan selected</option>
            {studyPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.subject} - Class {plan.class}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'bg-gray-800 text-gray-100 border border-gray-700'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.subject && (
                <div className="text-xs opacity-70 mt-2">
                  📚 {message.subject} {message.topic && `• ${message.topic}`}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-100 border border-gray-700 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {selectedPlan && messages.length <= 1 && (
        <div className="p-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-400 mb-3">💡 Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((question, index) => (
              <button
                key={index}
                onClick={() => sendMessage(question)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-700/50">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your studies..."
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none pr-12"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-colors ${
                isRecording || isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {isListening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-3 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
} 