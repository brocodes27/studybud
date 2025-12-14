import React, { useState, useRef, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

import { OpenAIService } from '../lib/openaiService';
import { useChatSkills } from '../skills/useChatSkills';
import { Header } from './AIStudyBuddy/Header';
import { ContextPanel } from './AIStudyBuddy/ContextPanel';
import { MessageList } from './AIStudyBuddy/MessageList';
import { SuggestedQuestions } from './AIStudyBuddy/SuggestedQuestions';
import { ChatInput } from './AIStudyBuddy/ChatInput';

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
  created_at?: string;
  exam_date?: string;
  plan: {
    daily_schedule: Array<{
      day: number;
      topic: string;
      description: string;
    }>;
  };
}

const RANJAN_SIR_SYSTEM_PROMPT = `You are **Ranjan Sir**, an AI Teacher, Partner, and Buddy for students. 
Your specific traits are:
- **Role**: You are not just a bot; you are a mentor ("Sir") who is supportive, wise, and slightly informal but academic.
- **Tone**: Encouraging, engaging, and clear. Use emojis appropriately (e.g., 📚, ✨, 💪).
- **Goal**: Help the student succeed in their academic journey, managing backlogs, explaining concepts, and solving problems.

Your Capabilities:
1. **Explain Concepts**: Simplify complex topics. Use analogies.
2. **Solve Problems**: Step-by-step. Don't just give answers.
3. **Manage Plans**: If a student is behind, offer to reschedule (you know they can use the "Reschedule" button).
4. **Practice**: Offer quiz questions if asked.

Always refer to the provided **STUDY CONTEXT** to know the student's class, subject, and exam status.
If the context mentions "backlogs", be empathetic and help them prioritize.
`;

type Props = {
  title?: string;
  subtitle?: string;
  welcomeContent?: string;
  functionPath?: string; // supabase function name
  extraContext?: string; // appended to studyContext
  variant?: 'default' | 'mentor';
  storageNamespace?: string;
};

export function AIStudyBuddy({
  title = 'Ranjan Sir',
  subtitle = 'Your AI Teacher, Partner, and Buddy',
  welcomeContent,
  functionPath = 'ai-study-buddy',
  extraContext = '',
  variant = 'default',
  storageNamespace = 'ai_buddy',
}: Props) {
  const { session } = useAuth() as any;
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [homework, setHomework] = useState<string>('');
  const [isTodayCompleted, setIsTodayCompleted] = useState<boolean>(false);
  const [isTogglingCompletion, setIsTogglingCompletion] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [showContext, setShowContext] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [wasVoiceInput, setWasVoiceInput] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Conversational flow state
  const [flow, setFlow] = useState<{ name: 'idle' | 'create_plan' | 'flashcards' | 'reschedule'; step: number; data: any; options?: any[] }>({ name: 'idle', step: 0, data: {} });

  // One-off progress panel state
  const [progressPanel, setProgressPanel] = useState<{ visible: boolean; loading: boolean; data: Array<{ date: string; count: number }> }>({ visible: false, loading: false, data: [] });

  // Helper to append an assistant message (keeps markdown-lite rules downstream)
  const addAssistant = (content: string) => {
    const assistantMessage: Message = {
      id: (Date.now() + Math.random()).toString(),
      content,
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);
  };

  // Refresh user's study plans (reusable)
  const refreshStudyPlans = async () => {
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

  // (fetch triggered below on session.user.id change)

  // Skills engine (plugin-style flows)
  const skillsEngine = useChatSkills({
    addAssistant,
    session,
    selectedPlan,
    getPlanById: (id: string) => studyPlans.find(p => p.id === id),
    refreshStudyPlans: async () => {
      await refreshStudyPlans();
    }
  });

  // Generate a study plan via Supabase Edge Function and optionally persist plan_name
  const generateStudyPlanFromData = async (data: { subject: string; class: string; exam_date: string; chapters: string; plan_name?: string }) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-plan`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ ...data, plan_name: data.plan_name }),
    });
    if (!response.ok) {
      let errMsg = 'Failed to generate study plan';
      try { const e = await response.json(); errMsg = e.error || errMsg; } catch { }
      throw new Error(errMsg);
    }
    const plan = await response.json();
    // Persist custom plan_name if necessary
    if (data.plan_name) {
      try {
        let updateErr: any = null;
        if (plan && (plan as any).id) {
          const { error: nameErr } = await supabase
            .from('exam_plans')
            .update({ plan_name: data.plan_name })
            .eq('id', (plan as any).id);
          updateErr = nameErr;
        } else {
          const { data: latestPlan, error: fetchErr } = await supabase
            .from('exam_plans')
            .select('id')
            .eq('user_id', session?.user?.id)
            .eq('subject', data.subject)
            .eq('exam_date', data.exam_date)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (!fetchErr && latestPlan) {
            const { error: upErr } = await supabase
              .from('exam_plans')
              .update({ plan_name: data.plan_name })
              .eq('id', latestPlan.id);
            updateErr = upErr;
          }
        }
        if (updateErr) {
          console.warn('Could not save plan_name:', updateErr.message);
        }
      } catch { }
    }
    return plan;
  };

  // Generate flashcards for a plan via Supabase Function
  const generateFlashcardsForPlan = async (planId: string, topic: string) => {
    const { data: plan, error } = await supabase
      .from('exam_plans')
      .select('subject, class, chapters')
      .eq('id', planId)
      .maybeSingle();
    if (error) throw error;
    const payload = {
      subject: (plan as any)?.subject ?? '',
      class: (plan as any)?.class ?? '',
      chapters: (plan as any)?.chapters ?? '',
      plan_id: planId,
      count: 65,
      topic,
    } as any;
    const { error: invErr } = await supabase.functions.invoke('generate-flashcards', { body: payload });
    if (invErr) throw invErr;
  };

  // Fetch and show one-off progress panel
  const handleProgressRequest = async () => {
    try {
      if (!session?.user?.id) {
        addAssistant('Please sign in to view progress.');
        return;
      }
      setProgressPanel({ visible: true, loading: true, data: [] });
      const since = new Date();
      since.setDate(since.getDate() - 6);
      const { data, error } = await supabase
        .from('task_completions')
        .select('id, created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(since.getTime());
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        counts[key] = 0;
      }
      (data || []).forEach((row: any) => {
        const key = (row.created_at as string).slice(0, 10);
        if (counts[key] !== undefined) counts[key] += 1;
      });
      const series = Object.keys(counts).sort().map(k => ({ date: k, count: counts[k] }));
      setProgressPanel({ visible: true, loading: false, data: series });
      addAssistant('Here is your last 7 days progress.');
    } catch (e) {
      setProgressPanel({ visible: true, loading: false, data: [] });
      addAssistant('I could not fetch your progress right now.');
    }
  };

  // Start flows based on intent
  const maybeStartFlowFromIntent = async (raw: string): Promise<boolean> => {
    const text = raw.toLowerCase();
    // Create Plan intent
    if ((/\b(create|make|generate)\b/.test(text) && text.includes('plan')) || /study plan/.test(text)) {
      setFlow({ name: 'create_plan', step: 0, data: {} });
      addAssistant('Great! Let’s create your study plan. First, which subject?');
      return true;
    }
    // Flashcards intent
    if (text.includes('flashcard') || text.includes('flash cards') || text.includes('generate flashcards')) {
      if (selectedPlan) {
        setFlow({ name: 'flashcards', step: 1, data: { planId: selectedPlan } });
        addAssistant('Sure. Which topic should I generate flashcards for?');
      } else {
        try {
          if (!session?.user?.id) {
            addAssistant('Please sign in to generate flashcards.');
            return true;
          }
          const { data, error } = await supabase
            .from('exam_plans')
            .select('id, subject, class, chapters')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const options = data || [];
          if (options.length === 0) {
            addAssistant('You have no study plans yet. Create a plan first, then ask me to generate flashcards.');
            return true;
          }
          setFlow({ name: 'flashcards', step: 0, data: {}, options });
          const list = options.map((p: any, i: number) => `${i + 1}. ${p.subject} (Class ${p.class})`).join('\n');
          addAssistant(`Which plan should I use? Reply with a number:\n${list}`);
        } catch (e) {
          addAssistant('I could not fetch your plans right now. Please try again.');
        }
      }
      return true;
    }
    // Progress intent (one-off inline graphs)
    if (text.includes('progress') || text.includes('stats') || text.includes('analytics') || text.includes('how am i doing')) {
      await handleProgressRequest();
      return true;
    }
    return false;
  };

  // Handle ongoing flow steps
  const handleFlowMessage = async (raw: string) => {
    if (flow.name === 'create_plan') {
      const step = flow.step;
      const data = { ...flow.data } as any;
      if (step === 0) {
        data.subject = raw.trim();
        setFlow({ name: 'create_plan', step: 1, data });
        addAssistant('Which class? (e.g., 10, 11, 12)');
        return;
      }
      if (step === 1) {
        const m = raw.match(/\d{1,2}/);
        data.class = m ? m[0] : raw.trim();
        setFlow({ name: 'create_plan', step: 2, data });
        addAssistant('What is your exam date? (YYYY-MM-DD)');
        return;
      }
      if (step === 2) {
        const dateStr = raw.trim();
        const valid = !isNaN(Date.parse(dateStr));
        if (!valid) {
          addAssistant('Please provide a valid date in YYYY-MM-DD format.');
          return;
        }
        data.exam_date = dateStr;
        setFlow({ name: 'create_plan', step: 3, data });
        addAssistant('List the chapters/topics (comma-separated).');
        return;
      }
      if (step === 3) {
        data.chapters = raw.trim();
        setFlow({ name: 'create_plan', step: 4, data });
        addAssistant('Optional: provide a plan name, or say "skip".');
        return;
      }
      if (step === 4) {
        const planName = raw.trim().toLowerCase() === 'skip' ? '' : raw.trim();
        data.plan_name = planName;
        addAssistant('Creating your plan...');
        try {
          await generateStudyPlanFromData(data);
          addAssistant('Your study plan is ready. Opening Study Plans...');
          setFlow({ name: 'idle', step: 0, data: {} });
          setTimeout(() => { try { window.location.assign('/plans'); } catch { } }, 700);
        } catch (e: any) {
          addAssistant('I could not create the plan. Please try again.');
          setFlow({ name: 'idle', step: 0, data: {} });
        }
        return;
      }
      return;
    }
    if (flow.name === 'flashcards') {
      const step = flow.step;
      const data = { ...flow.data } as any;
      if (step === 0) {
        const idx = parseInt(raw.trim(), 10);
        if (isNaN(idx) || idx < 1 || !flow.options || idx > flow.options.length) {
          addAssistant('Please reply with a valid number from the list.');
          return;
        }
        const picked = flow.options[idx - 1];
        data.planId = picked.id;
        data.planMeta = picked;
        setFlow({ name: 'flashcards', step: 1, data });
        addAssistant('Great. Which topic should I generate flashcards for?');
        return;
      }
      if (step === 1) {
        const topic = raw.trim();
        if (!topic) {
          addAssistant('Please provide a topic.');
          return;
        }
        addAssistant('Generating flashcards...');
        try {
          await generateFlashcardsForPlan(data.planId, topic);
          addAssistant('Flashcards are ready. Opening Study Tools...');
          setFlow({ name: 'idle', step: 0, data: {} });
          setTimeout(() => { try { window.location.assign('/tools'); } catch { } }, 700);
        } catch (e: any) {
          addAssistant('I could not generate flashcards. Please try again.');
          setFlow({ name: 'idle', step: 0, data: {} });
        }
        return;
      }
      return;
    }

    if (flow.name === 'reschedule') {
      const days = parseInt(raw.match(/\d+/)?.[0] || '0');
      if (days > 0) {
        addAssistant(`Understood. I've shifted your schedule by ${days} days to accommodate the backlog. 🗓️\n\nDon't stress! We'll get back on track. Your new topic for today is updated.`);
        // In a real app, we would call a backend function here: await reschedulePlan(flow.data.planId, days);
        showToast('Plan rescheduled successfully', 'success');
      } else {
        addAssistant("I didn't catch a number. Let's keep the plan as is for now. You can ask me to reschedule anytime.");
      }
      setFlow({ name: 'idle', step: 0, data: {} });
      return;
    }
  };

  // Storage keys per user
  const userKey = (session?.user?.id as string) || 'guest';
  const defaultNamespace = 'ai_buddy';
  const historyKey = `${storageNamespace}_history_${userKey}`;
  const notesKey = `${storageNamespace}_notes_${userKey}`;
  const selectedPlanKey = `${storageNamespace}_selected_plan_${userKey}`;

  const saveHistory = (msgs: Message[]) => {
    try {
      localStorage.setItem(historyKey, JSON.stringify(msgs));
    } catch { }
  };
  const loadHistory = (): Message[] => {
    try {
      let raw = localStorage.getItem(historyKey);
      // Migrate from default namespace if needed
      if (!raw && storageNamespace !== defaultNamespace) {
        const fallbackKey = `${defaultNamespace}_history_${userKey}`;
        raw = localStorage.getItem(fallbackKey);
        if (raw) {
          try { localStorage.setItem(historyKey, raw); } catch { }
        }
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Message[];
      // revive dates
      return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
      return [];
    }
  };
  const saveNotes = (val: string) => {
    try { localStorage.setItem(notesKey, val); } catch { }
  };
  const loadNotes = (): string => {
    try {
      let val = localStorage.getItem(notesKey) || '';
      if ((!val || val === '') && storageNamespace !== defaultNamespace) {
        const fallbackKey = `${defaultNamespace}_notes_${userKey}`;
        const legacy = localStorage.getItem(fallbackKey) || '';
        if (legacy) {
          val = legacy;
          try { localStorage.setItem(notesKey, legacy); } catch { }
        }
      }
      return val || '';
    } catch { return ''; }
  };

  // Save homework locally per user+plan+day
  const saveHomeworkLocal = (val: string) => {
    setHomework(val);
    try {
      if (!selectedPlan) return;
      const plan = studyPlans.find(p => p.id === selectedPlan);
      if (!plan) return;
      let dayNumber = 1;
      if (plan.created_at) {
        const created = new Date(plan.created_at);
        dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (dayNumber < 1) dayNumber = 1;
      }
      const hwKey = `${storageNamespace}_homework_${userKey}_${plan.id}_${dayNumber}`;
      localStorage.setItem(hwKey, val);
    } catch { }
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

  const getWelcomeText = () => {
    const defaultText = `👋 Hello! I am **Ranjan Sir**, your AI Teacher, Partner, and Buddy.
    
**How was your day today? What happened in school today?**

I am here to support you in your entire academic journey, from daily planning to board exams.

I already know your class, syllabus, and exam dates from your plan. I can help you with:
- 📅 **Daily Study Plans**: tailored to your schedule
- 📝 **Homework & Tests**: I'll evaluate your mock tests and help with homework
- 🔄 **Backlogs**: Missed a few days? No problem, I'll update your plan.

What shall we tackle today?`;
    return welcomeContent || defaultText;
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
          content: getWelcomeText(),
          role: 'assistant',
          timestamp: new Date(),
        }
      ]);
    }
    setNotes(loadNotes());
    // Restore last selected plan if available
    try {
      let savedSel = localStorage.getItem(selectedPlanKey);
      if (!savedSel && storageNamespace !== defaultNamespace) {
        const fallbackSel = localStorage.getItem(`${defaultNamespace}_selected_plan_${userKey}`);
        if (fallbackSel) {
          savedSel = fallbackSel;
          try { localStorage.setItem(selectedPlanKey, savedSel); } catch { }
        }
      }
      if (savedSel) setSelectedPlan(savedSel);
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  // Persist messages whenever they change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Handle namespace changes (e.g., HMR or persona switch) by attempting to reload
  useEffect(() => {
    // Refresh notes from new namespace
    setNotes(loadNotes());
    // If no history currently loaded (or only welcome), try to load migrated history
    const hasOnlyWelcome = messages.length === 0 || (messages.length === 1 && messages[0]?.id === 'welcome');
    if (hasOnlyWelcome) {
      const existing = loadHistory();
      if (existing.length > 0) {
        setMessages(existing);
      }
    }
    // Try to restore selected plan if not set
    try {
      if (!selectedPlan) {
        const savedSel = localStorage.getItem(selectedPlanKey);
        if (savedSel) setSelectedPlan(savedSel);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageNamespace]);

  // Fetch user's study plans
  useEffect(() => {
    refreshStudyPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Auto-select a plan after fetch (no manual selection required)
  useEffect(() => {
    if (!studyPlans || studyPlans.length === 0) return;
    if (selectedPlan && studyPlans.some(p => p.id === selectedPlan)) return;
    try {
      const savedSel = localStorage.getItem(selectedPlanKey);
      if (savedSel && studyPlans.some(p => p.id === savedSel)) {
        setSelectedPlan(savedSel);
        return;
      }
    } catch { }
    // Fallback to latest (first due to created_at desc)
    setSelectedPlan(studyPlans[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyPlans]);

  // Persist selected plan per user
  useEffect(() => {
    try {
      if (selectedPlan) {
        localStorage.setItem(selectedPlanKey, selectedPlan);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  // One-time hint: Reschedule availability (per user+plan)
  useEffect(() => {
    if (!selectedPlan) return;
    try {
      const key = `reschedule_hint_${userKey}_${selectedPlan}`;
      if (!localStorage.getItem(key)) {
        showToast('Missed a day? Use Reschedule to shift upcoming dates.', 'info', 4000);
        localStorage.setItem(key, '1');
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getCurrentStudyContext = () => {
    if (!selectedPlan) return '';

    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (!plan) return '';

    // Determine current study day based on plan created_at; fallback to first day
    const today = new Date();
    let dayNumber = 1;
    if (plan && (plan as any).created_at) {
      const created = new Date((plan as any).created_at);
      dayNumber = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }
    const currentDay = plan.plan.daily_schedule.find(d => d.day === dayNumber) || plan.plan.daily_schedule[0];

    return `
 SYSTEM PERSONA: You are "Ranjan Sir", the student's AI teacher, partner, and buddy. You are supportive, friendly, and authoritative when needed. You manage the student's one-year academic plan, daily study schedule, homework, and test preparation. You check for backlogs and offer to reschedule if the student missed days. You evaluate their mock tests and give feedback.

 Current Study Context:
 - Student Class: ${plan.class}
 - Subject: ${plan.subject}
 - Today's Topic: ${currentDay?.topic || 'General'}
 - Study Description: ${currentDay?.description || 'No specific description'}
 - Chapters in Syllabus: ${plan.chapters}
 - Exam Date: ${plan.exam_date || 'Not set'}
 ${notes ? `- Personal Notes & School Context: ${notes}` : ''}
 ${homework ? `- Today's Homework context: ${homework}` : ''}
 `;
  };

  // Build a compact conversation history context to keep continuity without overloading tokens
  const buildConversationContext = (msgs: Message[], maxMessages: number = 8, charLimit: number = 1500) => {
    try {
      const recent = msgs.filter(m => m.id !== 'welcome').slice(-maxMessages);
      if (recent.length === 0) return '';
      const lines = recent.map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content.replace(/\s+/g, ' ').trim()}`);
      let s = lines.join('\n');
      if (s.length > charLimit) {
        s = s.slice(s.length - charLimit);
      }
      return `CONVERSATION HISTORY (last ${recent.length} messages):\n${s}\nUse this to maintain continuity and avoid repeating earlier steps.`;
    } catch {
      return '';
    }
  };

  // Load per-day homework and completion status when plan changes
  useEffect(() => {
    const loadPerDay = async () => {
      try {
        if (!selectedPlan) { setHomework(''); setIsTodayCompleted(false); return; }
        const plan = studyPlans.find(p => p.id === selectedPlan);
        if (!plan) { setHomework(''); setIsTodayCompleted(false); return; }
        let dayNumber = 1;
        if (plan.created_at) {
          const created = new Date(plan.created_at);
          dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber < 1) dayNumber = 1;
        }
        // homework from localStorage with namespace migration
        const hwKey = `${storageNamespace}_homework_${userKey}_${plan.id}_${dayNumber}`;
        try {
          let hw = localStorage.getItem(hwKey) || '';
          if ((!hw || hw === '') && storageNamespace !== defaultNamespace) {
            const legacyKey = `${defaultNamespace}_homework_${userKey}_${plan.id}_${dayNumber}`;
            const legacy = localStorage.getItem(legacyKey) || '';
            if (legacy) {
              hw = legacy;
              try { localStorage.setItem(hwKey, legacy); } catch { }
            }
          }
          setHomework(hw);
        } catch { setHomework(''); }
        // completion from Supabase
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('task_completions')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('plan_id', plan.id)
            .eq('day_number', dayNumber)
            .limit(1);
          if (!error) {
            setIsTodayCompleted(Array.isArray(data) && data.length > 0);
          } else {
            setIsTodayCompleted(false);
          }
        }
      } catch {
        setHomework('');
        setIsTodayCompleted(false);
      }
    };
    loadPerDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan, studyPlans, userKey, session?.user?.id]);

  // -------------------------
  // === SECOND (kept) VERSIONS ===
  // These are the versions you asked to keep (the "second" set).
  // -------------------------

  const toggleTodayCompletion = async () => {
    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (!plan || !session?.user?.id) return;
    let dayNumber = 1;
    if (plan.created_at) {
      const created = new Date(plan.created_at);
      dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }
    setIsTogglingCompletion(true);
    try {
      if (!isTodayCompleted) {
        const { error } = await supabase
          .from('task_completions')
          .upsert(
            { user_id: session.user.id, plan_id: plan.id, day_number: dayNumber },
            { onConflict: 'user_id,plan_id,day_number', ignoreDuplicates: true }
          );
        if (error) throw error;
        setIsTodayCompleted(true);
        showToast('Marked today as completed.', 'success');
      } else {
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('user_id', session.user.id)
          .eq('plan_id', plan.id)
          .eq('day_number', dayNumber);
        if (error) throw error;
        setIsTodayCompleted(false);
        showToast('Marked as not completed.', 'success');
      }
    } catch (e) {
      showToast('Could not update completion. Please try again.', 'error');
    } finally {
      setIsTogglingCompletion(false);
    }
  };

  const clearChat = () => {
    const welcome: Message = {
      id: 'welcome',
      content: getWelcomeText(),
      role: 'assistant',
      timestamp: new Date(),
    };
    const arr = [welcome];
    setMessages(arr);
    saveHistory(arr);
  };

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // Strip markdown for speech
    const cleanText = text
      .replace(/[*#`_\[\]]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/<[^>]*>/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US'; // Or en-IN for Ranjan Sir flavor?
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (content: string) => {
    if ((!content.trim() && !selectedImage) || isLoading) return;

    let finalContent = content.trim();
    let imageDescription = '';

    const userMessage: Message = {
      id: Date.now().toString(),
      content: finalContent || (selectedImage ? '[Image Uploaded]' : ''),
      role: 'user',
      timestamp: new Date(),
    };

    const newMessageList = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    const isVoice = wasVoiceInput;
    setWasVoiceInput(false); // Reset

    setIsLoading(true);

    try {
      // 1. Analyze Image if present
      if (selectedImage) {
        addAssistant('Analyzing your image... 👁️');
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedImage);
          });

          // Use OpenAIService (assuming it's set up)
          imageDescription = await OpenAIService.getInstance().analyzeImagesWithVision([base64],
            "Analyze this academic image. If it's a question, solve it step-by-step. If it's a topic, explain it. Provide the output in plain text suited for a student.");

          finalContent = `[User Uploaded an Image] \nAnalysis: ${imageDescription} \n\n User Question: ${finalContent}`;
          // Remove the "Analyzing..." placeholder if we want, or just append the real answer next. 
          // Actually, let's keep it simple: the main AI response will cover it.
          // Note: We are NOT removing the 'Analyzing' message from UI, so it might stay. 
          // For a cleaner UI, we should probably not use addAssistant for status updates, or use a specific status state.
          // For this MVP, we'll just proceed and let the final answer come.
        } catch (err) {
          console.error("Vision Error", err);
          showToast('Failed to analyze image.', 'error');
        }
        setSelectedImage(null);
      }

      // If in a guided flow, handle it and return (no AI call)
      if (flow.name !== 'idle') {
        await handleFlowMessage(finalContent);
        return;
      }

      // Existing intents (create plan / flashcards / progress)
      if (await maybeStartFlowFromIntent(finalContent)) {
        return;
      }

      // Skills: continue ongoing skill or start by intent
      if (await skillsEngine.handleOngoing(finalContent)) {
        return;
      }
      if (await skillsEngine.maybeStartByIntent(finalContent)) {
        return;
      }

      let context = getCurrentStudyContext();
      if (!context || context.trim() === '') {
        context = 'General study context.';
      }
      const convHistory = buildConversationContext(newMessageList);
      const selectedPlanObj = studyPlans.find(p => p.id === selectedPlan);
      // Removed unused subject/class bindings
      const finalContext = [context, extraContext, convHistory].filter(Boolean).join('\n\n');

      const fullPrompt = `${finalContext}\n\nStudent Question: ${finalContent}`;

      // Use OpenAIService directly to avoid 500 errors from unconfigured edge function
      const responseText = await OpenAIService.getInstance().generateChatCompletion(
        fullPrompt,
        RANJAN_SIR_SYSTEM_PROMPT
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        role: 'assistant',
        timestamp: new Date(),
        subject: studyPlans.find(p => p.id === selectedPlan)?.subject,
        topic: (() => {
          const plan = studyPlans.find(p => p.id === selectedPlan);
          if (!plan) return undefined;
          let dayNumber = 1;
          if (plan.created_at) {
            const created = new Date(plan.created_at);
            dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (dayNumber < 1) dayNumber = 1;
          }
          return (plan.plan.daily_schedule.find(d => d.day === dayNumber) || plan.plan.daily_schedule[0])?.topic;
        })(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Speak if voice was used
      if (isVoice) {
        speakResponse(responseText);
      }

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
      setWasVoiceInput(true); // Mark as voice interaction for TTS
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

    let dayNumber = 1;
    if (plan.created_at) {
      const created = new Date(plan.created_at);
      dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }
    const todaysTopic = (plan.plan.daily_schedule.find(d => d.day === dayNumber) || plan.plan.daily_schedule[0])?.topic || "today's topic";

    return [
      `Explain ${plan.subject} concepts in simple terms`,
      `Help me understand ${todaysTopic}`,
      `Give me practice questions for ${plan.subject}`,
      `What are the key points to remember for ${plan.chapters.split(',')[0]?.trim()}`,
      `Give me a quick 3-question quiz on ${todaysTopic}`,
      `Summarize ${todaysTopic} in 5 bullet points`,
      `Based on my plan, suggest a reshuffled focus for the next 7 days`
    ];
  };

  const isMentor = variant === 'mentor';

  const formatTime = (d: Date) => {
    try {
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel overflow-hidden border-r border-white/10 rounded-none">
      {/* Header */}
      <Header
        title={title}
        subtitle={subtitle}
        onClear={clearChat}
        variant={variant}
      />

      {/* Memory: Notes + Study Plan Selector */}
      {!isMentor && studyPlans.length > 0 && (
        <ContextPanel
          notes={notes}
          setNotes={setNotes}
          saveNotes={saveNotes}
          homework={homework}
          setHomework={saveHomeworkLocal}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          studyPlans={studyPlans}
          showContext={showContext}
          setShowContext={setShowContext}
        />
      )}

      {/* Today's Plan Summary and Quick Actions */}
      {selectedPlan && (() => {
        const plan = studyPlans.find(p => p.id === selectedPlan);
        let dayNumber = 1;
        if (plan?.created_at) {
          const created = new Date(plan.created_at);
          dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber < 1) dayNumber = 1;
        }
        const today = (plan?.plan?.daily_schedule?.find(d => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
        return (
          <div className="mt-4 glass-card border border-white/10 rounded-xl p-4 backdrop-blur-sm" data-tour="ranjan-today-panel">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-neon-blue/20 rounded-lg">
                <Brain className="h-4 w-4 text-neon-blue" />
              </div>
              <h3 className="text-sm font-bold text-white">Today's Plan</h3>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">{plan?.subject}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">Class {plan?.class}</span>
              </div>
              <div className="mt-2 text-gray-300"><strong className="text-neon-blue">Topic:</strong> {today?.topic || 'General'}</div>
              <div className="text-gray-400"><strong className="text-neon-purple">Focus:</strong> {today?.description || 'No specific description'}</div>
            </div>
            <div className="mt-4 overflow-x-auto scrollbar-none">
              <div className="inline-flex gap-2 pr-1">
                <button onClick={() => sendMessage(`Explain ${today?.topic || 'today\'s topic'} in simple steps with a tiny example.`)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors whitespace-nowrap" data-tour="ranjan-explain">Explain Topic</button>
                <button onClick={() => sendMessage(`Give me 5 practice questions on ${today?.topic || 'today\'s topic'} with brief hints. Solutions on demand.`)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors whitespace-nowrap" data-tour="ranjan-practice">5 Practices</button>
                <button onClick={() => sendMessage(`Evaluate me. Give me a daily mock test on ${today?.topic || 'today\'s topic'} with 3 challenging questions. Grade my answers.`)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors whitespace-nowrap" data-tour="ranjan-quiz">Daily Mock Test</button>
                <button onClick={() => sendMessage(`Summarize ${today?.topic || 'today\'s topic'} in 5 bullet points for quick revision.`)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors whitespace-nowrap" data-tour="ranjan-summary">5-Bullet Summary</button>
                <button onClick={() => sendMessage(`Based on my studyContext, suggest a reshuffled plan for the next 7 days as simple day-wise bullets (bold allowed only).`)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 transition-colors whitespace-nowrap" data-tour="ranjan-reshuffle-7">Reshuffle 7 Days</button>
                <button onClick={() => skillsEngine.startSkill('dailyStudy')} className="text-xs bg-neon-blue/20 hover:bg-neon-blue/30 text-neon-blue px-3 py-1.5 rounded-lg border border-neon-blue/30 transition-colors whitespace-nowrap" data-tour="ranjan-start-study">Start Today's Study</button>
                <button onClick={() => skillsEngine.startSkill('rescheduler')} className="text-xs bg-neon-yellow/20 hover:bg-neon-yellow/30 text-neon-yellow px-3 py-1.5 rounded-lg border border-neon-yellow/30 transition-colors whitespace-nowrap" data-tour="ranjan-rescheduler">Reschedule Missed Days</button>
                <button onClick={toggleTodayCompletion} disabled={isTogglingCompletion} className={`text-xs ${isTodayCompleted ? 'bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border-neon-green/30' : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'} px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap`} data-tour="ranjan-mark-done">
                  {isTodayCompleted ? '✓ Done' : 'Mark Done'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mentor: lightweight quick chip for Reschedule */}
      {isMentor && selectedPlan !== '' && (() => {
        const plan = studyPlans.find(p => p.id === selectedPlan);
        let dayNumber = 1;
        if (plan?.created_at) {
          const created = new Date(plan.created_at);
          dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber < 1) dayNumber = 1;
        }
        const today = (plan?.plan?.daily_schedule?.find(d => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
        return (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-3">
              <div className="text-[11px] text-gray-300">
                <strong>Today's:</strong> {today?.topic || 'General'}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="text-[11px] bg-black/40 text-white border border-white/10 rounded-full px-2 py-1 focus:border-neon-blue focus:outline-none"
                  data-tour="ranjan-plan-select"
                  title="Select Study Plan"
                >
                  {studyPlans.map((p) => (
                    <option key={p.id} value={p.id} className="bg-gray-900">
                      {p.subject} - Class {p.class}
                    </option>
                  ))}
                </select>
                <button
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white border border-white/10 transition-colors"
                  onClick={() => {
                    const plan = studyPlans.find(p => p.id === selectedPlan);
                    if (plan) {
                      setFlow({ name: 'reschedule', step: 0, data: { planId: plan.id } });
                      addAssistant(`I see you want to reschedule your plan for **${plan.subject}**. \n\nHow many days have you missed? (e.g., "2 days")`);
                    }
                  }}
                  data-tour="ranjan-quick-reschedule"
                >
                  Reschedule/Backlog
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isMentor={isMentor}
        title={title}
        messagesEndRef={messagesEndRef}
        renderMarkdownLite={renderMarkdownLite}
        formatTime={formatTime}
      />

      {/* One-off Progress Panel (rendered only when requested) */}
      {progressPanel.visible && (
        <div className="px-4 pb-2">
          <div className="glass-card border border-white/10 rounded-xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Last 7 Days Progress</h3>
              <button
                className="text-xs text-gray-400 hover:text-white"
                onClick={() => setProgressPanel({ visible: false, loading: false, data: [] })}
              >
                Dismiss
              </button>
            </div>
            {progressPanel.loading ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : (
              <div className="space-y-2">
                {progressPanel.data.length === 0 && (
                  <div className="text-sm text-gray-400">No data available.</div>
                )}
                {progressPanel.data.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-gray-400">{d.date.slice(5)}</div>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-neon-blue to-blue-500"
                        style={{ width: `${(d.count / Math.max(1, ...progressPanel.data.map(x => x.count))) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-300 text-right">{d.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {!isMentor && selectedPlan && messages.length <= 1 && (
        <SuggestedQuestions
          questions={getSuggestedQuestions()}
          onSelect={sendMessage}
        />
      )}

      {/* Input */}
      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        isLoading={isLoading}
        isRecording={isRecording}
        isListening={isListening}
        isMentor={isMentor}
        onSubmit={handleSubmit}
        startVoiceRecording={startVoiceRecording}
        stopVoiceRecording={stopVoiceRecording}
        onImageSelect={setSelectedImage}
        selectedImage={selectedImage}
      />
    </div>
  );
}
