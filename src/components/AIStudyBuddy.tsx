import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Brain, BookOpen, Sparkles, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useChatSkills } from '../skills/useChatSkills';

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
  title = 'AI Study Buddy',
  subtitle = 'Your personal learning assistant',
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

  // Conversational flow state (plan creation, flashcards)
  const [flow, setFlow] = useState<{ name: 'idle' | 'create_plan' | 'flashcards'; step: number; data: any; options?: any[] }>({ name: 'idle', step: 0, data: {} });

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
      try { const e = await response.json(); errMsg = e.error || errMsg; } catch {}
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
      } catch {}
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
          setTimeout(() => { try { window.location.assign('/plans'); } catch {} }, 700);
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
          setTimeout(() => { try { window.location.assign('/tools'); } catch {} }, 700);
        } catch (e: any) {
          addAssistant('I could not generate flashcards. Please try again.');
          setFlow({ name: 'idle', step: 0, data: {} });
        }
        return;
      }
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
    } catch {}
  };
  const loadHistory = (): Message[] => {
    try {
      let raw = localStorage.getItem(historyKey);
      // Migrate from default namespace if needed
      if (!raw && storageNamespace !== defaultNamespace) {
        const fallbackKey = `${defaultNamespace}_history_${userKey}`;
        raw = localStorage.getItem(fallbackKey);
        if (raw) {
          try { localStorage.setItem(historyKey, raw); } catch {}
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
    try { localStorage.setItem(notesKey, val); } catch {}
  };
  const loadNotes = (): string => {
    try {
      let val = localStorage.getItem(notesKey) || '';
      if ((!val || val === '') && storageNamespace !== defaultNamespace) {
        const fallbackKey = `${defaultNamespace}_notes_${userKey}`;
        const legacy = localStorage.getItem(fallbackKey) || '';
        if (legacy) {
          val = legacy;
          try { localStorage.setItem(notesKey, legacy); } catch {}
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
    } catch {}
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
    const defaultText = `👋 Hi! I'm your ${title}. I can help you with:
          
📚 **Subject Questions**: Ask me anything about your subjects
🎯 **Study Plan Help**: Get guidance on your current study topics
📝 **Homework Help**: Get step-by-step explanations
🧠 **Concept Clarification**: I'll explain complex topics simply
📊 **Practice Questions**: Request additional practice problems

What would you like to study today?`;
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
          try { localStorage.setItem(selectedPlanKey, savedSel); } catch {}
        }
      }
      if (savedSel) setSelectedPlan(savedSel);
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
    } catch {}
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
 Current Study Context:
 - Subject: ${plan.subject}
 - Class: ${plan.class}
 - Today's Topic: ${currentDay?.topic || 'General'}
 - Study Description: ${currentDay?.description || 'No specific description'}
 - Chapters: ${plan.chapters}
 ${notes ? `- Notes: ${notes}` : ''}
 ${homework ? `- Homework: ${homework}` : ''}
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
              try { localStorage.setItem(hwKey, legacy); } catch {}
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

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    const newMessageList = [...messages, userMessage];

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      // If in a guided flow, handle it and return (no AI call)
      if (flow.name !== 'idle') {
        await handleFlowMessage(content.trim());
        return;
      }

      // Existing intents (create plan / flashcards / progress)
      if (await maybeStartFlowFromIntent(content.trim())) {
        return;
      }

      // Skills: continue ongoing skill or start by intent
      if (await skillsEngine.handleOngoing(content.trim())) {
        return;
      }
      if (await skillsEngine.maybeStartByIntent(content.trim())) {
        return;
      }

      setIsLoading(true);
      let context = getCurrentStudyContext();
      if (!context || context.trim() === '') {
        context = 'General study context.';
      }
      const convHistory = buildConversationContext(newMessageList);
      const selectedPlanObj = studyPlans.find(p => p.id === selectedPlan);
      const subject = selectedPlanObj?.subject || 'General';
      let classValue = selectedPlanObj?.class || '';
      if (!classValue || classValue.trim() === '') {
        classValue = '10'; // Default to class 10 or another sensible default
      }
      const finalContext = [context, extraContext, convHistory].filter(Boolean).join('\n\n');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: content.trim(),
          studyContext: finalContext,
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
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      {!isMentor && (
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
            >
              Clear
            </button>
            <Sparkles className="h-5 w-5 text-yellow-400" />
          </div>
        </div>
      )}
      {/* Memory: Notes + Study Plan Selector */}
      {!isMentor && studyPlans.length > 0 && (
        <div className="p-4 border-b border-border">
          <button
            type="button"
            onClick={() => setShowContext(v => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-900"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Study Context
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showContext ? 'rotate-180' : ''}`} />
          </button>
          <p className="text-xs text-gray-500 mt-1">Notes and plan selection are included in AI context.</p>

          {showContext && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-900 mb-2">Personal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); saveNotes(e.target.value); }}
                placeholder="Add key preferences, syllabus focus, weak topics, exam dates, etc."
                className="form-input mb-3 h-20"
              />
              <label className="block text-sm font-medium text-gray-900 mb-2">Homework for Today (included in context)</label>
              <textarea
                value={homework}
                onChange={(e) => saveHomeworkLocal(e.target.value)}
                placeholder="Paste questions or describe assigned homework for today"
                className="form-input mb-3 h-16"
              />
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <BookOpen className="h-4 w-4 inline mr-2" />
                Select Study Plan
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
            </div>
          )}

          {/* Today's Plan Summary and Quick Actions */}
          {selectedPlan && (() => {
            const plan = studyPlans.find(p => p.id === selectedPlan);
            // Compute current day and today's task
            let dayNumber = 1;
            if (plan?.created_at) {
              const created = new Date(plan.created_at);
              dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              if (dayNumber < 1) dayNumber = 1;
            }
            const today = (plan?.plan?.daily_schedule?.find(d => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
            return (
              <div className="mt-4 bg-gray-50 border border-border rounded-xl p-4" data-tour="ranjan-today-panel">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">Today's Plan</h3>
                </div>
                <div className="text-xs text-gray-600">
                  <div><strong>Subject:</strong> {plan?.subject} • <strong>Class:</strong> {plan?.class}</div>
                  <div className="mt-0.5"><strong>Topic:</strong> {today?.topic || 'General'}</div>
                  <div className="mt-0.5"><strong>Focus:</strong> {today?.description || 'No specific description'}</div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <div className="inline-flex gap-2 pr-1">
                    <button onClick={() => sendMessage(`Explain ${today?.topic || 'today\'s topic'} in simple steps with a tiny example.`)} className="text-xs bg-white hover:bg-gray-100 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors" data-tour="ranjan-explain">Explain Topic</button>
                    <button onClick={() => sendMessage(`Give me 5 practice questions on ${today?.topic || 'today\'s topic'} with brief hints. Solutions on demand.`)} className="text-xs bg-white hover:bg-gray-100 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors" data-tour="ranjan-practice">5 Practices</button>
                    <button onClick={() => sendMessage(`Give me a quick 3-question quiz on ${today?.topic || 'today\'s topic'} and check my answers step-by-step.`)} className="text-xs bg-white hover:bg-gray-100 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors" data-tour="ranjan-quiz">3Q Quiz</button>
                    <button onClick={() => sendMessage(`Summarize ${today?.topic || 'today\'s topic'} in 5 bullet points for quick revision.`)} className="text-xs bg-white hover:bg-gray-100 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors" data-tour="ranjan-summary">5-Bullet Summary</button>
                    <button onClick={() => sendMessage(`Based on my studyContext, suggest a reshuffled plan for the next 7 days as simple day-wise bullets (bold allowed only).`)} className="text-xs bg-white hover:bg-gray-100 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors" data-tour="ranjan-reshuffle-7">Reshuffle 7 Days</button>
                    <button onClick={() => skillsEngine.startSkill('dailyStudy')} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-200 transition-colors" data-tour="ranjan-start-study">Start Today's Study</button>
                    <button onClick={() => skillsEngine.startSkill('rescheduler')} className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-200 transition-colors" data-tour="ranjan-rescheduler">Reschedule Missed Days</button>
                    <button onClick={toggleTodayCompletion} disabled={isTogglingCompletion} className={`text-xs ${isTodayCompleted ? 'bg-green-100 hover:bg-green-200 text-green-800' : 'bg-white hover:bg-gray-100 text-gray-800'} px-3 py-1 rounded-full border border-gray-200 transition-colors`} data-tour="ranjan-mark-done">
                      {isTodayCompleted ? '✓ Done' : 'Mark Done'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
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
              <div className="text-[11px] text-blue-900/80">
                <strong>Today's:</strong> {today?.topic || 'General'}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="text-[11px] bg-white text-blue-900 border border-blue-100 rounded-full px-2 py-1"
                  data-tour="ranjan-plan-select"
                  title="Select Study Plan"
                >
                  {studyPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject} - Class {p.class}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => skillsEngine.startSkill('rescheduler')}
                  className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full border border-amber-200 transition-colors"
                  data-tour="ranjan-quick-reschedule"
                >
                  Reschedule
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Messages */}
      <div className={`flex-1 overflow-y-auto ${isMentor ? 'p-6' : 'p-4'} space-y-4`}>
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${isMentor ? 'rounded-xl' : 'rounded-2xl'} px-4 py-3 ${
              message.role === 'user'
                ? (isMentor ? 'bg-blue-50 text-blue-900 border border-blue-100' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-primary-foreground')
                : (isMentor ? 'bg-white text-gray-900 border border-blue-100' : 'bg-gray-100 text-gray-900 border border-border')
            }`}>
              {isMentor && message.role === 'assistant' && (
                <div className="text-[10px] font-semibold text-blue-900 uppercase mb-1 flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  {title.toUpperCase()} <span className="opacity-60">{formatTime(message.timestamp)}</span>
                </div>
              )}
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={renderMarkdownLite(message.content)} />
              {message.subject && !isMentor && (
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

      {/* One-off Progress Panel (rendered only when requested) */}
      {progressPanel.visible && (
        <div className="px-4 pb-2">
          <div className="border border-border rounded-xl p-4 bg-white/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Last 7 Days Progress</h3>
              <button
                className="text-xs text-gray-600 hover:text-gray-900"
                onClick={() => setProgressPanel({ visible: false, loading: false, data: [] })}
              >
                Dismiss
              </button>
            </div>
            {progressPanel.loading ? (
              <div className="text-sm text-gray-600">Loading...</div>
            ) : (
              <div className="space-y-2">
                {progressPanel.data.length === 0 && (
                  <div className="text-sm text-gray-600">No data available.</div>
                )}
                {progressPanel.data.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-gray-600">{d.date.slice(5)}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-blue-500"
                        style={{ width: `${(d.count / Math.max(1, ...progressPanel.data.map(x => x.count))) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs text-gray-700 text-right">{d.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {!isMentor && selectedPlan && messages.length <= 1 && (
        <div className="p-4 border-t border-border">
          <p className="text-sm text-gray-600 mb-3">💡 Suggested questions:</p>
          <div className="overflow-x-auto">
            <div className="inline-flex gap-2 pr-1">
              {getSuggestedQuestions().map((question, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(question)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full border border-gray-200 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
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
              placeholder="Enter your query..."
              className={`${isMentor ? 'rounded-full h-12 pl-4 pr-12 border-blue-100' : 'pr-12'} form-input`}
              disabled={isLoading}
              data-tour="ranjan-input"
            />
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 transition-colors ${
                isMentor ? 'rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100' : 'rounded-lg ' + (isRecording || isListening ? 'bg-red-500 text-destructive-foreground' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
              }`}
              data-tour="ranjan-mic"
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
            className={`${isMentor ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-primary-foreground'} px-4 py-3 rounded-xl transition-all duration-200 disabled:cursor-not-allowed`}
            data-tour="ranjan-send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}