import React, { useState, useRef, useEffect } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
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
import { VoiceVisualizer } from './AIStudyBuddy/VoiceVisualizer';
import Vapi from '@vapi-ai/web';

const vapi = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY || '');

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

const ATLAS_SYSTEM_PROMPT = `You are **ATLAS**, a "Production-Ready" AI Mentor and the engine of this learning workspace. 
Your goal is to transform notes and questions into clear, exam-usable explanations, practice problems, and visual aids.

### CORE OPERATING PRINCIPLES (Feynman-2 Logic):
1. **The "Simulated Pupil":** When explaining a concept, act as a tutor who asks the student to teach *you*. Identify jargon and logical gaps. Force the student to simplify.
2. **Memory & Personalization:** You have access to the student's **STUDY CONTEXT** (Class, Subject, Plan, and Progress). Use this to:
   - Recall what they have already "Completed" (don't repeat basics they know).
   - Reference their "Backlogs" with empathy and adjust your teaching speed.
3. **Visual Thinking:** For STEM topics (Math/Physics/Chemistry), describe concepts visually. Use whiteboard-style logic. (Note: You can propose Manim-style visualizations if the topic is complex).
4. **STEM Mastery:** Use the "Solve" methodology. Break complex problems into 3 stages: Concept, Step-by-Step, and Verification.

### WORKFLOWS:
- **FEYNMAN STUDY:** Don't give answers. Say: "Explain [Topic] to me like I'm in Class 5. I'll catch your gaps."
- **PRACTICE CANVAS:** Generate 3-5 custom problems. If they get one wrong, don't give the solution immediately; ask them to explain their first step.
- **SUMMARY:** Provide 5 high-impact bullet points + a "One-Sentence Intuition" for the topic.

### IDENTITY:
You are **ATLAS**. You are supportive, authoritative yet friendly, and you always use the student's name if known. Use emojis (📚, 💡, 💪) to keep the vibe casual but focused.`;

type Props = {
  title?: string;
  subtitle?: string;
  welcomeContent?: string;
  extraContext?: string; // appended to studyContext
  variant?: 'default' | 'mentor';
  storageNamespace?: string;
  hideMissionControl?: boolean;
};

export function AIStudyBuddy({
  title = 'ATLAS',
  subtitle = 'NEURAL_OS_PRO_v5.0',
  welcomeContent,
  extraContext = '',
  variant = 'default',
  storageNamespace = 'ai_buddy',
  hideMissionControl = false,
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

  const [showTodayMission, setShowTodayMission] = useState(true);

  // Vapi State
  const [voiceConversationActive, setVoiceConversationActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'listening' | 'speaking' | 'idle' | 'connecting'>('idle');
  const [voiceVolume, setVoiceVolume] = useState(0);

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

  // Vapi Setup
  // Vapi Setup
  useEffect(() => {
    vapi.on('call-start', () => {
      console.log('Atlas Vapi call started');
      setVoiceConversationActive(true);
      setVoiceStatus('idle');
    });

    vapi.on('call-end', () => {
      console.log('Atlas Vapi call ended');
      setVoiceConversationActive(false);
      setVoiceStatus('idle');
    });

    vapi.on('speech-start', () => {
      setVoiceStatus('listening');
    });

    vapi.on('speech-end', () => {
      setVoiceStatus('idle');
    });

    vapi.on('volume-level', (volume) => {
      setVoiceVolume(volume);
    });

    vapi.on('message', (message) => {
      if (message.type === 'transcript' && message.role === 'assistant') {
        setVoiceStatus('speaking');
        setTimeout(() => setVoiceStatus(prev => prev === 'speaking' ? 'idle' : prev), 3000);
      }

      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const msgRole = message.role === 'assistant' ? 'assistant' : 'user';
        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          content: message.transcript,
          role: msgRole,
          timestamp: new Date(),
        };
        // Avoid duplicate messages if Vapi sends them rapidly? Vapi transcripts are usually stable.
        setMessages(prev => [...prev, newMessage]);
      }
    });

    vapi.on('error', (e) => {
      console.error('Atlas Vapi Error:', e);
      showToast('Voice connection error', 'error');
      setVoiceConversationActive(false);
      setVoiceStatus('idle');
    });

    return () => {
      // Clean up handled by Vapi SDK or on toggle
    };
  }, []);

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
 SYSTEM PERSONA: You are "ATLAS", the student's AI neural mentor and partner. You are supportive, friendly, and authoritative when needed. You manage the student's one-year academic plan, daily study schedule, homework, and test preparation. You check for backlogs and offer to reschedule if the student missed days. You evaluate their mock tests and give feedback.

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

  const toggleVapiSession = async () => {
    if (voiceConversationActive) {
      vapi.stop();
      setVoiceConversationActive(false);
    } else {
      setVoiceStatus('connecting');
      setVoiceConversationActive(true);
      const context = getCurrentStudyContext();
      const currentContextPrompt = context ? `${ATLAS_SYSTEM_PROMPT}\n\n${context}` : ATLAS_SYSTEM_PROMPT;

      try {
        await vapi.start({
          model: {
            provider: "openai",
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: currentContextPrompt
              }
            ]
          },
          voice: {
            provider: "11labs",
            voiceId: "burt" // Using same premium voice as board
          }
        });
      } catch (err) {
        console.error("Vapi Start Error", err);
        showToast("Failed to start voice session.", "error");
        setVoiceConversationActive(false);
        setVoiceStatus('idle');
      }
    }
  };

  // Replace Header's toggleVoice to use Vapi
  // ... rest of component ...


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


  const getWelcomeText = () => {
    const defaultText = `👋 Hello! I am **ATLAS**, your AI Neural Mentor and Learning Partner.
    
**How was your day? What are we mastering today?**

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

  // Listen for external reschedule triggers (from externalized Mission Control)
  useEffect(() => {
    const handler = (e: any) => {
      const planId = e.detail;
      const plan = studyPlans.find(p => p.id === (planId || selectedPlan));
      if (plan) {
        if (planId) setSelectedPlan(planId);
        setFlow({ name: 'reschedule', step: 0, data: { planId: plan.id } });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: `I see you want to reschedule your plan for **${plan.subject}**. \n\nHow many days have you missed? (e.g., "2 days")`,
          role: 'assistant',
          timestamp: new Date(),
        }]);
      }
    };
    window.addEventListener('trigger-atlas-reschedule', handler);
    return () => window.removeEventListener('trigger-atlas-reschedule', handler);
  }, [studyPlans, selectedPlan]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



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
      // Removed unused subject/class bindings
      const finalContext = [context, extraContext, convHistory].filter(Boolean).join('\n\n');

      const fullPrompt = `${finalContext}\n\nStudent Question: ${finalContent}`;

      // Use OpenAIService directly to avoid 500 errors from unconfigured edge function
      const responseText = await OpenAIService.getInstance().generateChatCompletion(
        fullPrompt,
        ATLAS_SYSTEM_PROMPT
      );

      // Check for "Journal Sync" signal from ATLAS
      if (responseText.includes("### JOURNAL_APPEND:")) {
        const noteToAppend = responseText.split("### JOURNAL_APPEND:")[1].trim();
        // Dispatch custom event to Atlas workspace
        window.dispatchEvent(new CustomEvent('append-study-note', { detail: noteToAppend }));
      }

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

  useEffect(() => {
    const handler = (e: any) => {
      const { message, voice } = e.detail;
      if (voice) {
        setVoiceConversationActive(true);
      }
      if (message) sendMessage(message);
    };
    window.addEventListener('trigger-atlas-chat', handler);
    return () => window.removeEventListener('trigger-atlas-chat', handler);
  }, [sendMessage]);

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
    <div className="flex flex-col h-full bg-neo-bg overflow-hidden border-r-4 border-black relative">

      {/* Voice HUD Overlay */}
      <VoiceVisualizer
        isActive={voiceConversationActive}
        volume={voiceVolume}
        status={voiceStatus}
        onClose={() => {
          vapi.stop();
          setVoiceConversationActive(false);
        }}
      />

      {/* Header */}
      <Header
        title={title}
        subtitle={subtitle}
        onClear={clearChat}
        variant={variant}
        isVoiceActive={voiceConversationActive}
        onToggleVoice={toggleVapiSession}
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
      {!hideMissionControl && selectedPlan && (() => {
        const plan = studyPlans.find(p => p.id === selectedPlan);
        let dayNumber = 1;
        if (plan?.created_at) {
          const created = new Date(plan.created_at);
          dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber < 1) dayNumber = 1;
        }
        const today = (plan?.plan?.daily_schedule?.find(d => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
        return (
          <div className="mx-4 mt-6 bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] sticky top-0 z-20" data-tour="ranjan-today-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neo-accent border-2 border-black -rotate-6">
                  <Brain className="h-5 w-5 text-white" strokeWidth={3} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter italic">TODAY'S MISSION</h3>
              </div>
              <button
                onClick={() => setShowTodayMission(!showTodayMission)}
                className="p-1 border-2 border-black hover:bg-neo-bg transition-colors"
                title={showTodayMission ? "Collapse" : "Expand"}
              >
                {showTodayMission ? (
                  <ChevronUp className="h-4 w-4 stroke-[3px]" />
                ) : (
                  <ChevronDown className="h-4 w-4 stroke-[3px]" />
                )}
              </button>
            </div>

            {showTodayMission && (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-neo-secondary border-2 border-black font-black uppercase text-[10px] tracking-widest">{plan?.subject}</span>
                    <span className="px-3 py-1 bg-neo-muted border-2 border-black font-black uppercase text-[10px] tracking-widest text-black">CLASS {plan?.class}</span>
                  </div>
                  <div className="p-3 bg-neo-bg border-2 border-black">
                    <p className="text-xs font-black uppercase tracking-tight mb-1 text-black/40">TOPIC</p>
                    <p className="text-md font-black uppercase tracking-tight italic">{today?.topic || 'GENERAL STUDY'}</p>
                  </div>
                  <p className="text-xs font-bold text-black/70 leading-snug">{today?.description || 'No specific description'}</p>
                </div>

                <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
                  <div className="inline-flex gap-3 pb-2">
                    {[
                      { label: "EXPLAIN TOPIC", tour: "atlas-explain", color: "bg-white", text: `Explain ${today?.topic || 'today\'s topic'} in simple steps with a tiny example.` },
                      { label: "FEYNMAN TUTOR", tour: "atlas-feynman", color: "bg-neo-accent text-white", text: `ATLAS, let's do a Feynman session on ${today?.topic || 'today\'s topic'}. Ask me to explain it simply and test my gaps.` },
                      { label: "STEM SOLVER", tour: "atlas-solve", color: "bg-white", text: `I have a tough problem/concept in ${plan?.subject}. Can you help me solve it using the Feynman step-by-step method?` },
                      { label: "5 PRACTICES", tour: "atlas-practice", color: "bg-white", text: `Give me 5 practice questions on ${today?.topic || 'today\'s topic'} with brief hints. Solutions on demand.` },
                      { label: "DAILY MOCK TEST", tour: "atlas-quiz", color: "bg-white", text: `Evaluate me. Give me a daily mock test on ${today?.topic || 'today\'s topic'} with 3 challenging questions. Grade my answers.` },
                      { label: "5-BULLET SUMMARY", tour: "atlas-summary", color: "bg-white", text: `Summarize ${today?.topic || 'today\'s topic'} in 5 bullet points for quick revision.` },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={() => sendMessage(btn.text)}
                        className={`text-[10px] font-black uppercase tracking-widest ${btn.color} border-2 border-black px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all whitespace-nowrap`}
                        data-tour={btn.tour}
                      >
                        {btn.label}
                      </button>
                    ))}

                    <button
                      onClick={() => skillsEngine.startSkill('dailyStudy')}
                      className="text-[10px] font-black uppercase tracking-widest bg-neo-accent text-white border-2 border-black px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all whitespace-nowrap"
                      data-tour="ranjan-start-study"
                    >
                      START STUDY
                    </button>

                    <button
                      onClick={() => skillsEngine.startSkill('rescheduler')}
                      className="text-[10px] font-black uppercase tracking-widest bg-neo-secondary border-2 border-black px-4 py-2 shadow-[3px_3px_0px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all whitespace-nowrap"
                      data-tour="ranjan-rescheduler"
                    >
                      RESCHEDULE
                    </button>

                    <button
                      onClick={toggleTodayCompletion}
                      disabled={isTogglingCompletion}
                      className={`text-[9px] font-black uppercase tracking-widest ${isTodayCompleted ? 'bg-neo-secondary text-black' : 'bg-neo-muted text-black'} border-2 border-black px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all whitespace-nowrap`}
                      data-tour="ranjan-mark-done"
                    >
                      {isTodayCompleted ? '✓ COMPLETED' : 'MARK DONE'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Mentor: lightweight quick chip for Reschedule */}
      {!hideMissionControl && isMentor && selectedPlan !== '' && (() => {
        const plan = studyPlans.find(p => p.id === selectedPlan);
        let dayNumber = 1;
        if (plan?.created_at) {
          const created = new Date(plan.created_at);
          dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (dayNumber < 1) dayNumber = 1;
        }
        const today = (plan?.plan?.daily_schedule?.find(d => d.day === dayNumber) || plan?.plan?.daily_schedule?.[0]);
        return (
          <div className="px-4 pt-4 pb-2">
            <div className="flex flex-wrap items-center gap-3 bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_#000]">
              <div className="text-[10px] font-black uppercase tracking-tight">
                <span className="text-black/40">TODAY:</span> {today?.topic || 'GENERAL'}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="text-[9px] font-black uppercase bg-neo-bg border-2 border-black px-2 py-1 focus:outline-none"
                  data-tour="ranjan-plan-select"
                >
                  {studyPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject} - CLASS {p.class}
                    </option>
                  ))}
                </select>
                <button
                  className="px-3 py-1 bg-neo-accent text-white border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] active:shadow-none active:translate-x-[0.5px] active:translate-y-[0.5px] text-[9px] font-black uppercase"
                  onClick={() => {
                    const plan = studyPlans.find(p => p.id === selectedPlan);
                    if (plan) {
                      setFlow({ name: 'reschedule', step: 0, data: { planId: plan.id } });
                      addAssistant(`I see you want to reschedule your plan for **${plan.subject}**. \n\nHow many days have you missed? (e.g., "2 days")`);
                    }
                  }}
                  data-tour="ranjan-quick-reschedule"
                >
                  RESCHEDULE
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
