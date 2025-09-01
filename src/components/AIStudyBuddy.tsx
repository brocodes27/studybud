import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Brain, BookOpen, Sparkles } from 'lucide-react';
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
  const { session } = useAuth() as any;
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [notes, setNotes] = useState<string>('');

  // Storage keys per user
  const userKey = (session?.user?.id as string) || 'guest';
  const historyKey = `ai_buddy_history_${userKey}`;
  const notesKey = `ai_buddy_notes_${userKey}`;

  const saveHistory = (msgs: Message[]) => {
    try {
      localStorage.setItem(historyKey, JSON.stringify(msgs));
    } catch {}
  };
  const loadHistory = (): Message[] => {
    try {
      const raw = localStorage.getItem(historyKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Message[];
      // revive dates
      return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
      return [];
    }
  };
  const saveNotes = (val: string) => {
    try { localStorage.setItem(notesKey, val); } catch {}
  };
  const loadNotes = (): string => {
    try { return localStorage.getItem(notesKey) || ''; } catch { return ''; }
  };

  // Minimal Markdown -> HTML: bold + plain text only, escape HTML
  const renderMarkdownLite = (raw: string) => {
    if (typeof raw !== 'string') return { __html: '' };
    let s = raw;
    // Escape HTML
    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    // Strip code fences and inline code to plain text
    s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
    s = s.replace(/`([^`]+)`/g, '$1');
    // Convert bold (**text** or __text__)
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Links/images -> plain text label
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    // Strip headings/blockquote/list markers to plain
    s = s.replace(/^>\s?/gm, '');
    s = s.replace(/^#{1,6}\s*/gm, '');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/^\s*\d+[.)]\s+/gm, '');
    // Preserve line breaks
    s = s.replace(/\r\n|\r|\n/g, '<br/>');
    return { __html: s };
  };

  // Initialize messages and notes (welcome only if no history)
  useEffect(() => {
    const existing = loadHistory();
    if (existing.length > 0) {
      setMessages(existing);
    } else {
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
    }
    setNotes(loadNotes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  // Persist messages whenever they change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

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
    
    // Simplified: pick the first scheduled day as current (no date field in schedule type)
    const currentDay = plan.plan.daily_schedule[0];
    
    return `
Current Study Context:
- Subject: ${plan.subject}
- Class: ${plan.class}
- Today's Topic: ${currentDay?.topic || 'General'}
- Study Description: ${currentDay?.description || 'No specific description'}
- Chapters: ${plan.chapters}
${notes ? `- Notes: ${notes}` : ''}
`;
  };

  const clearChat = () => {
    const welcome: Message = {
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
    };
    const arr = [welcome];
    setMessages(arr);
    saveHistory(arr);
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
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
          <Brain className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Study Buddy</h2>
          <p className="text-sm text-gray-600">Your personal learning assistant</p>
        </div>
        <div className="ml-auto">
          <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
        </div>
      </div>

      {/* Memory: Notes + Study Plan Selector */}
      {studyPlans.length > 0 && (
        <div className="p-4 border-b border-border">
          <label className="block text-sm font-medium text-gray-900 mb-2">Personal Notes (used in context)</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); saveNotes(e.target.value); }}
            placeholder="Add key preferences, syllabus focus, weak topics, exam dates, etc."
            className="form-input mb-3 h-20"
          />
          <label className="block text-sm font-medium text-gray-900 mb-2">
            <BookOpen className="h-4 w-4 inline mr-2" />
            Select Study Plan (for context)
          </label>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="form-input"
          >
            <option value="">No study plan selected</option>
            {studyPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.subject} - Class {plan.class}
              </option>
            ))}
          </select>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearChat}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full border border-border transition-colors"
            >
              Clear Chat
            </button>
          </div>
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
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-primary-foreground'
                  : 'bg-gray-100 text-gray-900 border border-border'
              }`}
            >
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={renderMarkdownLite(message.content)} />

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
            <div className="bg-gray-100 text-gray-900 border border-border rounded-2xl px-4 py-3">
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
        <div className="p-4 border-t border-border">
          <p className="text-sm text-gray-600 mb-3">💡 Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((question, index) => (
              <button
                key={index}
                onClick={() => sendMessage(question)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full border border-border transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your studies..."
              className="form-input pr-12"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-colors ${
                isRecording || isListening
                  ? 'bg-red-500 text-destructive-foreground'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-primary-foreground px-4 py-3 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
} 