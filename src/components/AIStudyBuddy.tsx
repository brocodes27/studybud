import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import AIService from '../lib/aiService';
import { useChatSkills } from '../skills/useChatSkills';
import { remember, type ChatTurn } from '../lib/memory';
import { MessageList } from './AIStudyBuddy/MessageList';
import { ChatInput } from './AIStudyBuddy/ChatInput';
import { VoiceVisualizer } from './AIStudyBuddy/VoiceVisualizer';
import { DailyPrescriptionDashboard } from './AIStudyBuddy/DailyPrescriptionDashboard';
import { TestResultUploader } from './AIStudyBuddy/TestResultUploader';
import { MemorySnapshot } from './AIStudyBuddy/MemorySnapshot';
import { SuggestedQuestions } from './AIStudyBuddy/SuggestedQuestions';
import { Zap, Brain, Upload, Target, Flame, BookOpen, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import Vapi from '@vapi-ai/web';

const vapi = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY || '');

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  subject?: string;
  topic?: string;
  isSystemAlert?: boolean;
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

interface ActiveRoadmap {
  id: string;
  institute_name: string;
  program: string;
  current_week: number;
}

interface ActivePrescription {
  id: string;
  tasks: Array<{
    type: string;
    subject: string;
    topic?: string;
    title?: string;
    duration_min?: number;
    estimated_minutes?: number;
    completed?: boolean;
    details?: string;
    description?: string;
    difficulty?: string;
  }>;
  implementation_intentions: Array<{
    trigger: string;
    action: string;
    duration_min?: number;
    completed?: boolean;
  }>;
  total_estimated_minutes: number;
}

const ATLAS_SYSTEM_PROMPT = `You are **ATLAS**, the student's friendly AI study partner and mentor. 
Your goal is to transform notes and questions into clear, exam-usable explanations, practice problems, and visual aids — always with warmth and encouragement.

### CORE OPERATING PRINCIPLES (Feynman-2 Logic):
1. **The "Simulated Pupil":** When explaining a concept, act as a tutor who asks the student to teach *you*. Identify jargon and logical gaps. Force the student to simplify.
2. **Memory & Personalization:** You have access to the student's **STUDY CONTEXT** (Class, Subject, Plan, and Progress) AND their **BEHAVIORAL PROFILE** (study patterns, subject affinity, focus windows, emotional trends, recent wins/struggles). Use both to tailor your tone, pacing, and examples. If the student is weak in Physics, lead with simpler analogies. If they have a short attention span, keep responses under 150 words unless asked for depth.
3. **Visual Thinking:** For STEM topics, describe concepts visually. Use whiteboard-style logic.
4. **STEM Mastery:** Use the "Solve" methodology: Concept, Step-by-Step, Verification.

### WORKFLOWS:
- **FEYNMAN STUDY:** Don't give answers. Say: "Explain [Topic] to me like I'm in Class 5. I'll catch your gaps."
- **PRACTICE CANVAS:** Generate 3-5 custom problems. Solutions on demand.
- **SUMMARY:** Provide 5 high-impact bullet points + a "One-Sentence Intuition".

### TOOLS:
- **addToJournal**: **MANDATORY EXECUTION**. When the student asks to "save", "remember", "add to notes", or "journal this", you MUST call this tool. Do NOT just say you will do it; you MUST trigger the function. Always use LaTeX for math/formulas (e.g. $E=mc^2$).

### IDENTITY:
You are **ATLAS**. You are supportive, warm, and genuinely encouraging. Use emojis (📚, 💡, 💪, 🌟) to keep the vibe friendly and motivating.`;

type Props = {
  title?: string;
  subtitle?: string;
  welcomeContent?: string;
  extraContext?: string; // appended to studyContext
  variant?: 'default' | 'mentor';
  storageNamespace?: string;
  hideMissionControl?: boolean;
  isolateContext?: boolean;
  notes?: string;
  onNotesChange?: (val: string) => void;
};

export function AIStudyBuddy({
  title = 'ATLAS',
  subtitle = 'NEURAL_OS_PRO_v5.0',
  welcomeContent,
  extraContext = '',
  variant = 'default',
  storageNamespace = 'ai_buddy',
  hideMissionControl = false,
  isolateContext = false,
  notes: externalNotes,
  onNotesChange,
}: Props) {
  const { session } = useAuth() as any;
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [activeRoadmap, setActiveRoadmap] = useState<ActiveRoadmap | null>(null);
  const [studentRoadmaps, setStudentRoadmaps] = useState<ActiveRoadmap[]>([]);
  const [activePrescription, setActivePrescription] = useState<ActivePrescription | null>(null);
  const [activeSprint, setActiveSprint] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showMemorySnapshot, setShowMemorySnapshot] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [showTestUploader, setShowTestUploader] = useState(false);

  // Sync internal notes with external props if provided
  useEffect(() => {
    if (externalNotes !== undefined) {
      setNotes(externalNotes);
    }
  }, [externalNotes]);

  useEffect(() => {
    if (onNotesChange && notes !== externalNotes) {
      onNotesChange(notes);
    }
  }, [notes, onNotesChange, externalNotes]);

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


  const getCurrentStudyContext = () => {
    if (isolateContext) return '';

    const now = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const hour = now.getHours();
    const timeOfDay = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
    const season = (month: number) => {
      if (month >= 2 && month <= 4) return 'Spring';
      if (month >= 5 && month <= 7) return 'Summer';
      if (month >= 8 && month <= 10) return 'Autumn';
      return 'Winter';
    };
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);

    let contextString = `SYSTEM PERSONA: You are "ATLAS", the student's warm and encouraging AI study partner. You are supportive, friendly, and patient. You help manage the student's academic roadmap, daily prescriptions, homework, and test preparation with a positive, motivating tone. You evaluate mock tests and give constructive, kind feedback.\n\nREAL-WORLD CONTEXT:\n- Current Date: ${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}\n- Current Time: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (local time)\n- Time of Day: ${timeOfDay}\n- Day ${dayOfYear} of ${now.getFullYear()}\n- Season: ${season(now.getMonth())}\n\nCurrent Study Context:\n`;

    if (activeRoadmap) {
      contextString += `- Enrolled Program: ${activeRoadmap.institute_name} (${activeRoadmap.program}, Week ${activeRoadmap.current_week})\n`;
    }
    
    if (activeSprint) {
      contextString += `- **CURRENT STATUS**: Student is currently in a Correction Sprint following a mock test. Sprint Name: ${activeSprint.sprint_name}. Post-test mode is ACTIVE. Prioritize resolving the weak topics from the sprint over generic progression.\n`;
    }

    if (activePrescription && activePrescription.tasks?.length > 0) {
      const completed = activePrescription.tasks.filter((t: any) => t.completed).length;
      const total = activePrescription.tasks.length;
      contextString += `- Today's Prescription (${completed}/${total} done): ${activePrescription.tasks.map(t => `${t.type} on ${t.title || t.topic} (${t.estimated_minutes || t.duration_min}m)`).join(', ')}\n`;
    }

    // Inject behavioral profile for deeply personalized mentoring
    if (userProfile) {
      contextString += `\n--- STUDENT BEHAVIORAL PROFILE (What Atlas Knows) ---\n`;
      if (userProfile.study_patterns) {
        const p = userProfile.study_patterns;
        contextString += `- Study Patterns: Peak focus ${p.peak_focus_time || 'unknown'}, avg session ${p.avg_session_min || '?'} min, preferred style ${p.preferred_learning_style || 'balanced'}`;
        if (p.consistency_score !== undefined) contextString += `, consistency ${Math.round(p.consistency_score * 100)}%`;
        if (p.engagement_trend) contextString += `, trend: ${p.engagement_trend}`;
        contextString += `\n`;
      }
      if (userProfile.subject_affinity) {
        const a = userProfile.subject_affinity;
        contextString += `- Subject Affinity: Strongest ${a.strongest_subject || 'N/A'}, weakest ${a.weakest_subject || 'N/A'}`;
        if (a.topic_mastery) {
          const mastered = Object.entries(a.topic_mastery).filter(([_, v]) => (v as number) > 0.7).map(([k]) => k).slice(0, 3);
          if (mastered.length) contextString += `, mastered topics: ${mastered.join(', ')}`;
        }
        contextString += `\n`;
      }
      if (userProfile.focus_fatigue) {
        const f = userProfile.focus_fatigue;
        contextString += `- Focus & Fatigue: Attention span ~${f.attention_span_min || '?'} min, fatigue threshold ~${f.fatigue_threshold_min || '?'} min`;
        if (f.optimal_break_interval) contextString += `, break every ${f.optimal_break_interval} min`;
        if (f.streak_days !== undefined) contextString += `, current streak ${f.streak_days} days`;
        contextString += `\n`;
      }
      if (userProfile.behavioral_signals) {
        const b = userProfile.behavioral_signals;
        const signals: string[] = [];
        if (b.risk_flags?.length) signals.push(`risks: ${b.risk_flags.join(', ')}`);
        if (b.emotional_trend) signals.push(`mood: ${b.emotional_trend}`);
        if (b.last_interaction_type) signals.push(`last interaction: ${b.last_interaction_type}`);
        if (signals.length) contextString += `- Behavioral Signals: ${signals.join('; ')}\n`;
      }
      if (userProfile.memory_snapshot) {
        const m = userProfile.memory_snapshot;
        if (m.recent_struggles?.length) contextString += `- Recent Struggles: ${m.recent_struggles.slice(0, 3).join(', ')}\n`;
        if (m.recent_wins?.length) contextString += `- Recent Wins: ${m.recent_wins.slice(0, 3).join(', ')}\n`;
        if (m.open_loops?.length) contextString += `- Open Loops: ${m.open_loops.slice(0, 3).join(', ')}\n`;
      }
      if (userProfile.missed_days_streak !== undefined || userProfile.backlog_count !== undefined) {
        contextString += `- Activity Health: missed-days streak ${userProfile.missed_days_streak ?? '?'}, backlog items ${userProfile.backlog_count ?? '?'}\n`;
      }
      contextString += `---\n\n`;
    }

    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (plan) {
      // Determine current study day based on plan created_at; fallback to first day
      const today = new Date();
      let dayNumber = 1;
      if (plan && (plan as any).created_at) {
        const created = new Date((plan as any).created_at);
        dayNumber = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (dayNumber < 1) dayNumber = 1;
      }
      const currentDay = plan.plan.daily_schedule.find(d => d.day === dayNumber) || plan.plan.daily_schedule[0];

      contextString += `- Legacy Study Plan: Class ${plan.class}, Subject ${plan.subject}\n`;
      contextString += `- Today's Topic: ${currentDay?.topic || 'General'}\n`;
      contextString += `- Chapters in Syllabus: ${plan.chapters}\n`;
    }

    if (notes) contextString += `- Personal Notes & School Context: ${notes}\n`;
    if (homework) contextString += `- Today's Homework context: ${homework}\n`;

    return contextString;
  };

  const toggleVapiSession = async (initialMessage?: string) => {
    if (voiceConversationActive) {
      vapi.stop();
      setVoiceConversationActive(false);
    } else {
      setVoiceStatus('connecting');
      setVoiceConversationActive(true);
      const context = getCurrentStudyContext();
      const currentContextPrompt = [ATLAS_SYSTEM_PROMPT, context, extraContext].filter(Boolean).join('\n\n');

      const messages: any[] = [
        {
          role: "system",
          content: currentContextPrompt
        }
      ];

      if (initialMessage) {
        messages.push({
          role: "user",
          content: initialMessage
        });
      }

      try {
        await vapi.start({
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages,
            tools: [
              {
                type: "function",
                function: {
                  name: "addToJournal",
                  description: "Add a note, formula, or thought to the user's personal journal/notes. Always format math/formulas using LaTeX syntax (e.g. $E=mc^2$).",
                  parameters: {
                    type: "object",
                    properties: {
                      content: {
                        type: "string",
                        description: "The content to add to the journal. Can include markdown and LaTeX."
                      }
                    },
                    required: ["content"]
                  }
                }
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

      // Fetch all student roadmaps + active one
      const { data: allRoadmaps } = await supabase
        .from('student_roadmaps')
        .select('id, institute_name, program, current_week, is_active')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      const rmList = (allRoadmaps || []).map(r => ({ id: r.id, institute_name: r.institute_name, program: r.program, current_week: r.current_week }));
      setStudentRoadmaps(rmList);
      const activeRm = (allRoadmaps || []).find(r => r.is_active);
      if (activeRm) {
        setActiveRoadmap({ id: activeRm.id, institute_name: activeRm.institute_name, program: activeRm.program, current_week: activeRm.current_week });
        // fetch today's prescription
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: presData } = await supabase
           .from('daily_prescriptions')
           .select('id, tasks, implementation_intentions, total_estimated_minutes')
           .eq('roadmap_id', activeRm.id)
           .eq('prescription_date', todayStr)
           .maybeSingle();   
        if (presData) {
           setActivePrescription(presData);
        }
        
        // Also fetch any active correction sprints
        const { data: sprintData } = await supabase
           .from('correction_sprints')
           .select('*')
           .eq('roadmap_id', activeRm.id)
           .eq('user_id', session.user.id)
           .eq('status', 'active')
           .order('created_at', { ascending: false })
           .limit(1)
           .maybeSingle();
        if (sprintData) {
           setActiveSprint(sprintData);
        }
      }
      
      // Fetch behavioral profile for memory transparency
      const { data: profile } = await supabase
         .from('student_behavioral_profiles')
         .select('*')
         .eq('user_id', session.user.id)
         .maybeSingle();
      if (profile) setUserProfile(profile);

      // Recompute with fixed logic (caps lookback at signup, counts curriculum_tasks)
      // so brand-new users don't inherit 14 missed days from pre-fix rows.
      await supabase.rpc('refresh_behavioral_profile', { p_user_id: session.user.id });
      const { data: freshProfile } = await supabase
         .from('student_behavioral_profiles')
         .select('*')
         .eq('user_id', session.user.id)
         .maybeSingle();
      if (freshProfile) setUserProfile(freshProfile);

    } catch (error) {
      console.error('Error fetching study plans/roadmaps:', error);
    }
  };

  // (fetch triggered below on session.user.id change)

  // Switch active curriculum/roadmap
  const switchRoadmap = async (roadmapId: string) => {
    if (!session?.user?.id) return;
    try {
      setIsLoading(true);
      // Deactivate all, then activate selected
      await supabase.from('student_roadmaps').update({ is_active: false }).eq('user_id', session.user.id);
      await supabase.from('student_roadmaps').update({ is_active: true }).eq('id', roadmapId);
      await refreshStudyPlans();
      const selected = studentRoadmaps.find(r => r.id === roadmapId);
      if (selected) {
        addAssistant(`Switched to **${selected.institute_name}** (${selected.program}, Week ${selected.current_week}). Ready when you are! 💪`);
      }
    } catch (e) {
      showToast('Failed to switch curriculum', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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



  // Refs for stable access in Vapi listeners
  const saveNotesRef = useRef(saveNotes);
  const addAssistantRef = useRef(addAssistant);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    saveNotesRef.current = saveNotes;
    addAssistantRef.current = addAssistant;
    showToastRef.current = showToast;
  }, [saveNotes, addAssistant, showToast]);

  // Vapi Setup
  useEffect(() => {
    const onCallStart = () => {
      console.log('Atlas Vapi call started');
      setVoiceConversationActive(true);
      setVoiceStatus('idle');
    };

    const onCallEnd = () => {
      console.log('Atlas Vapi call ended');
      setVoiceConversationActive(false);
      setVoiceStatus('idle');
    };

    const onSpeechStart = () => {
      setVoiceStatus('listening');
    };

    const onSpeechEnd = () => {
      setVoiceStatus('idle');
    };

    const onVolumeLevel = (volume: any) => {
      setVoiceVolume(volume);
    };

    const onMessage = (message: any) => {
      console.log('Atlas Vapi Message:', message);

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
        setMessages(prev => [...prev, newMessage]);
      }

      // Handle Tool Calls (Standard)
      if (message.type === 'tool-calls') {
        console.log('Tool call detected:', message.toolCalls);
        message.toolCalls.forEach((toolCall: any) => {
          if (toolCall.function.name === 'addToJournal' || toolCall.function.name === 'addToNotes') {
            try {
              const args = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

              console.log('Parsed args for journal:', args);
              const noteContent = args.content || args.note || args.text;

              if (noteContent) {
                setNotes(prev => {
                  const newVal = prev && prev.trim() ? prev.trim() + '\n\n' + noteContent : noteContent;
                  if (saveNotesRef.current) saveNotesRef.current(newVal);
                  return newVal;
                });
                if (addAssistantRef.current) addAssistantRef.current(`📝 **Journal Updated:**\n${noteContent}`);
                if (showToastRef.current) showToastRef.current('Added to Journal', 'success');
              } else {
                console.warn('Tool call received but no content found in args:', args);
              }
            } catch (e) {
              console.error('Error processing journal tool call', e);
            }
          }
        });
      }

      // Handle Function Calls (Legacy/Fallback)
      if (message.type === 'function-call' && (message.functionCall.name === 'addToJournal' || message.functionCall.name === 'addToNotes')) {
        try {
          const args = typeof message.functionCall.parameters === 'string'
            ? JSON.parse(message.functionCall.parameters)
            : message.functionCall.parameters;
          if (args.content) {
            setNotes(prev => {
              const newVal = prev ? prev + '\n\n' + args.content : args.content;
              if (saveNotesRef.current) saveNotesRef.current(newVal);
              return newVal;
            });
            if (addAssistantRef.current) addAssistantRef.current(`📝 **Journal Updated:**\n${args.content}`);
            if (showToastRef.current) showToastRef.current('Added to Journal', 'success');
          }
        } catch (e) {
          console.error('Error processing journal add', e);
        }
      }
    };

    const onError = (e: any) => {
      console.error('Atlas Vapi Error:', e);
      if (showToastRef.current) showToastRef.current('Voice connection error', 'error');
      setVoiceConversationActive(false);
      setVoiceStatus('idle');
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('volume-level', onVolumeLevel);
    vapi.on('message', onMessage);
    vapi.on('error', onError);

    return () => {
      vapi.off('call-start', onCallStart);
      vapi.off('call-end', onCallEnd);
      vapi.off('speech-start', onSpeechStart);
      vapi.off('speech-end', onSpeechEnd);
      vapi.off('volume-level', onVolumeLevel);
      vapi.off('message', onMessage);
      vapi.off('error', onError);
    };
  }, []);

  const getWelcomeText = () => {
    if (activePrescription && activePrescription.tasks?.length > 0) {
      const firstTask = activePrescription.tasks[0];
      return `Hey! I'm **Atlas**, your mentor.\n\nI see you have an active study prescription for today. Your first task is **${firstTask.title || firstTask.topic || firstTask.type.replace('_', ' ')}**. Shall we get started?`;
    }
    
    if (activeRoadmap) {
      return `Hey! I'm **Atlas**, your mentor.\n\nYou are synced to the **${activeRoadmap.institute_name}** curriculum (Week ${activeRoadmap.current_week}). Did you have class today? Say "Log my class" if you'd like to generate tonight's prescription!`;
    }

    const plan = studyPlans.find(p => p.id === selectedPlan);
    const subjectHint = plan ? ` Your **${plan.subject}** plan is active.` : '';
    const defaultText = `Hey! I'm **Atlas**, your study mentor.${subjectHint}\n\nWhat would you like to work on today?`;
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

  // Persist messages and notes whenever they change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

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

  // NOTE: Auto-scroll is handled inside MessageList (it owns the scroll container)
  // to avoid scrollIntoView fighting with flex layout and moving the input bar.

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROACTIVE BACKLOG DETECTION
  // Uses the refreshed behavioral profile (single source of truth) instead
  // of a separate, buggy query against task_completions.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [backlogChecked, setBacklogChecked] = useState(false);
  useEffect(() => {
    if (backlogChecked || !selectedPlan || !session?.user?.id || studyPlans.length === 0) return;

    const checkBacklog = async () => {
      try {
        const missedDays = userProfile?.missed_days_streak ?? 0;
        const backlog = userProfile?.backlog_count ?? 0;
        if (missedDays > 0 || backlog > 0) {
          const plan = studyPlans.find(p => p.id === selectedPlan);
          const todayEntry = plan?.plan?.daily_schedule?.[0];
          const parts: string[] = [];
          if (missedDays > 0) parts.push(`you haven't studied for ${missedDays} day${missedDays > 1 ? 's' : ''}`);
          if (backlog > 0) parts.push(`you have ${backlog} backlog item${backlog > 1 ? 's' : ''}`);

          const backlogMessage: Message = {
            id: 'backlog-alert-' + Date.now(),
            content: `⚡ **Hey, I noticed ${parts.join(' and ')}.**\n\nDon't worry — that's completely normal. I can **automatically reschedule** your remaining curriculum to keep you on track.\n\nFor now, let's pick up with **${todayEntry?.topic || 'today\'s topic'}**.\n\nJust say **"Reschedule my plan"** and I'll handle it, or we can dive right into studying. What would you prefer?`,
            role: 'assistant',
            timestamp: new Date(),
          };

          setMessages(prev => {
            if (prev.some(m => m.id.startsWith('backlog-alert-'))) return prev;
            return [...prev, backlogMessage];
          });
        }
        setBacklogChecked(true);
      } catch (e) {
        console.error('Backlog detection failed:', e);
        setBacklogChecked(true);
      }
    };

    const timer = setTimeout(checkBacklog, 1500);
    return () => clearTimeout(timer);
  }, [selectedPlan, session?.user?.id, studyPlans, backlogChecked, userProfile?.missed_days_streak, userProfile?.backlog_count]);



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

  const sendMessage = async (content: string, skipAI: boolean = false) => {
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

          // Use AIService (assuming it's set up)
          imageDescription = await AIService.getInstance().analyzeImagesWithVision([base64],
            "Analyze this academic image. If it's a question, solve it step-by-step. If it's a topic, explain it. Provide the output in plain text suited for a student.");

          finalContent = `[User Uploaded an Image] \nAnalysis: ${imageDescription} \n\n User Question: ${finalContent}`;
        } catch (err) {
          console.error("Vision Error", err);
          showToast('Failed to analyze image.', 'error');
        }
        setSelectedImage(null);
      }

      // If skipAI is true, we just add the message to the list and stop
      if (skipAI) {
        setIsLoading(false);
        // Remember voice-only turns too
        remember(
          newMessageList.slice(-3).filter(m => m.id !== 'welcome').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { source: 'chat', sourceId: session?.user?.id, debounceMs: 2000 }
        );
        return;
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

      // [PHASE 4]: Local Escalation Sentiment Check
      const escalationWords = ["can't do this", "give up", "too hard", "depressed", "failing everything", "i quit", "burnout", "burnt out", "overwhelmed"];
      const isDistress = escalationWords.some(w => finalContent.toLowerCase().includes(w));
      
      let finalContext = getCurrentStudyContext();
      if (!finalContext || finalContext.trim() === '') {
        finalContext = 'General study context.';
      }

      if (isDistress) {
         // Push a system interruption before Atlas replies
         const systemAlert: Message = { 
           id: `sys-${Date.now()}`, 
           content: "⚠️ **ACADEMIC HEALTH ALERT**: Atlas has flagged heightened distress. Escaping standard syllabus flow and entering 'Counselor/Reset Mode'.", 
           role: 'assistant', 
           isSystemAlert: true,
           timestamp: new Date() 
         };
         setMessages(prev => [...prev, systemAlert]);
         
         // Update context to force empathetic mentor
         finalContext += `\n\n[EMERGENCY DIRECTIVE]: The student has expressed strong burnout or distress. STOP academic pushing. Shift immediately to a highly empathetic counselor persona. Acknowledge their feelings, suggest a lightweight reset, and do NOT give new homework or rigorous tasks until they recover.`;
         
         // Optimistically update DB
         if (session?.user?.id) {
           supabase.from('student_behavioral_profiles').upsert({ user_id: session.user.id, escalation_level: 'high' }, { onConflict: 'user_id' }).then();
         }
      }

      // Convert local message array to the format expected by the edge function
      // (Just taking the last 10 messages for context)
      const formattedHistory = newMessageList.slice(-10).filter(m => m.id !== userMessage.id).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call the NDCF Empathetic Edge Function
      const { response: responseText, emotion_detected, pedagogical_mode } = await AIService.getInstance().generateEmpatheticChat(
        finalContent,
        session?.user?.id ? `${session.user.id}_${Date.now().toString().slice(0,6)}` : 'guest_session', 
        formattedHistory,
        finalContext + (extraContext ? `\n\n${extraContext}` : ''),
        true // Enable full multi-agent orchestration
      );

      // Extract Agentic Navigation Commands for the OS layer
      let finalCleanResponse = responseText;
      let navigateAction: string | null = null;
      
      const actionMatch = finalCleanResponse.match(/\[ACTION:NAVIGATE_([A-Z_]+)\]/);
      if (actionMatch) {
        navigateAction = actionMatch[1];
        finalCleanResponse = finalCleanResponse.replace(actionMatch[0], '').trim();
      }

      // Check for "Journal Sync" signal from ATLAS
      if (finalCleanResponse.includes("### JOURNAL_APPEND:")) {
        const noteToAppend = finalCleanResponse.split("### JOURNAL_APPEND:")[1].trim();
        // Dispatch custom event to Atlas workspace
        window.dispatchEvent(new CustomEvent('append-study-note', { detail: noteToAppend }));
        finalCleanResponse = finalCleanResponse.split("### JOURNAL_APPEND:")[0].trim();
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: finalCleanResponse,
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

      // Fire-and-forget: extract memories from this exchange
      const memoryPayload: ChatTurn[] = [
        ...newMessageList.slice(-4).filter(m => m.id !== 'welcome').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'assistant', content: finalCleanResponse },
      ];
      remember(memoryPayload, { source: 'chat', sourceId: session?.user?.id, debounceMs: 2000 });

      // Execute the workspace transition after rendering the message
      if (navigateAction) {
        setTimeout(() => {
            try {
                if (navigateAction === 'VIDEOS') window.location.assign('/videos');
                else if (navigateAction === 'TEST' || navigateAction === 'PRACTICE') window.location.assign('/sat-simulator');
                else if (navigateAction === 'ATLAS') window.location.assign('/atlas');
                else if (navigateAction === 'PLANS') window.location.assign('/plans');
            } catch(e) {}
        }, 1200);
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
      // Even errors can reveal preferences/topics to remember
      remember(
        newMessageList.slice(-3).filter(m => m.id !== 'welcome').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { source: 'chat', sourceId: session?.user?.id, debounceMs: 2000 }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Refs for stable access in window listeners
  const sendMessageRef = useRef(sendMessage);
  const toggleVapiSessionRef = useRef(toggleVapiSession);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    toggleVapiSessionRef.current = toggleVapiSession;
  }, [sendMessage, toggleVapiSession]);

  useEffect(() => {
    const handler = (e: any) => {
      const { message, voice } = e.detail;
      if (voice && !voiceConversationActive) {
        // Start voice session if not already active
        if (toggleVapiSessionRef.current) toggleVapiSessionRef.current(message);
        if (message && sendMessageRef.current) sendMessageRef.current(message, true); // add to history but skip AI (voice handles it)
      } else {
        if (message && sendMessageRef.current) sendMessageRef.current(message);
      }
    };
    window.addEventListener('trigger-atlas-chat', handler);
    return () => window.removeEventListener('trigger-atlas-chat', handler);
  }, [voiceConversationActive]);

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
    // Roadmap-aware suggestions first
    if (activeSprint) {
      const firstTopic = activeSprint.sprint_tasks?.[0]?.topic || 'my first weak topic';
      return [
        `Walk me through ${firstTopic} step by step`,
        `Why did I get ${firstTopic} wrong on the test?`,
        `Give me 3 practice questions on ${firstTopic}`,
        `Explain the concept behind ${firstTopic} like I'm in Class 8`,
        `What are common mistakes in ${firstTopic}?`,
      ];
    }
    if (activePrescription && activePrescription.tasks?.length > 0) {
      const incomplete = activePrescription.tasks.filter((t: any) => !t.completed);
      const nextTask = incomplete[0];
      if (nextTask) {
        return [
          `Help me start ${nextTask.type} on ${nextTask.title || nextTask.topic}`,
          `Explain ${nextTask.title || nextTask.topic} — I have ${nextTask.estimated_minutes || nextTask.duration_min} min`,
          `Quiz me on ${nextTask.title || nextTask.topic} before I attempt it`,
          `Break down ${nextTask.title || nextTask.topic} into smaller chunks`,
          `What prerequisites do I need for ${nextTask.title || nextTask.topic}?`,
        ];
      }
    }
    if (activeRoadmap) {
      return [
        `What should I focus on in Week ${activeRoadmap.current_week}?`,
        `Give me 5 JEE-level problems for this week`,
        `Log my class session for today`,
        `When is my next scheduled test?`,
        `Summarize the key concepts from Week ${activeRoadmap.current_week}`,
      ];
    }

    // Legacy plan fallback
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

  // Determine if we're in the "fresh canvas" state (no real conversation yet)
  const isEmptyState = messages.length === 0;

  // Build today's context for suggestions
  const getSuggestionContext = () => {
    const plan = studyPlans.find(p => p.id === selectedPlan);
    if (!plan) return { topic: "today's topic", subject: 'your subject' };
    let dayNumber = 1;
    if (plan.created_at) {
      const created = new Date(plan.created_at);
      dayNumber = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (dayNumber < 1) dayNumber = 1;
    }
    const topic = (plan.plan.daily_schedule.find(d => d.day === dayNumber) || plan.plan.daily_schedule[0])?.topic || "today's topic";
    return { topic, subject: plan.subject };
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] overflow-hidden relative font-sans">

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
      
      {/* Memory Snapshot Modal */}
      {showMemorySnapshot && (
        <MemorySnapshot
          initialProfile={userProfile}
          onClose={() => setShowMemorySnapshot(false)}
        />
      )}

      {/* ──────────────────────────────────────────── */}
      {/* EMPTY STATE: The Mentor's Welcome Canvas    */}
      {/* Vertically + horizontally centered, like    */}
      {/* ChatGPT / Manus empty state                 */}
      {/* ──────────────────────────────────────────── */}
      {isEmptyState ? (
        <div className="flex-1 flex flex-col">
          {/* Centered greeting area */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
            {/* Subtle avatar */}
            <div className="w-12 h-12 rounded-2xl bg-[#2D2A26] flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>

            <h1 className="text-3xl md:text-4xl font-medium text-[#2D2A26] tracking-tight text-center mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              What shall we work on?
            </h1>
            <p className="text-sm text-[#8A8279] text-center max-w-md mb-10">
              {(() => {
                if (activeRoadmap && !activePrescription) return `Synced to ${activeRoadmap.institute_name} (Week ${activeRoadmap.current_week}). Log class to get daily prescriptions.`;
                if (activePrescription) return `Tonight's AI-generated study prescription based on your roadmap and classes.`;
                const plan = studyPlans.find(p => p.id === selectedPlan);
                if (plan) return `Your ${plan.subject} plan is active. I know your syllabus, progress, and weak areas.`;
                return "I'm Atlas, your JEE mentor. I track your curriculum, test you, and reschedule when you fall behind.";
              })()}
            </p>

            {/* Dashboard / Suggestion cards / Upload UI */}
            {(() => {
               if (showTestUploader && activeRoadmap) {
                 return (
                   <TestResultUploader 
                     roadmapId={activeRoadmap.id}
                     onAnalysisComplete={(res, sprint) => {
                       setShowTestUploader(false);
                       setActiveSprint(sprint);
                       addAssistant(`Excellent, I've analyzed your test results. Your main bottlenecks are: \n\n${res.weak_topics.map((t: any) => `- **${t.topic}**`).join('\n')}\n\nI have generated a Correction Sprint mapping our exact steps to fix these. Are you ready to start?`);
                     }}
                     onCancel={() => setShowTestUploader(false)}
                   />
                 );
               }
               if (activeSprint) {
                 return (
                   <div className="w-full max-w-2xl mx-auto space-y-4 px-4 bg-[#F5F0E8]/50 p-6 rounded-2xl border border-[#E8E2D9]/50">
                     <h3 className="font-bold text-[#2D2A26] text-center">Correction Sprint: {activeSprint.sprint_name}</h3>
                     <p className="text-sm text-center text-[#8A8279] mb-4 cursor-pointer hover:underline" onClick={() => sendMessage("Show me my correction sprint tasks")}>
                       You are currently in Post-Test Correction Mode. We are pausing normal progression to fix test bottlenecks.
                     </p>
                     <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => sendMessage(`I'm ready. Let's tackle the first weak topic from my sprint: ${activeSprint.sprint_tasks?.[0]?.topic || ''}`)} className="p-3 bg-white border border-[#E8E2D9] rounded-xl text-center hover:shadow-md transition-shadow text-[#8B7355] text-sm font-semibold">
                         Start Sprint Session
                       </button>
                       <button onClick={() => { setActiveSprint(null); supabase.from('correction_sprints').update({status:'completed'}).eq('id', activeSprint.id); }} className="p-3 bg-white border border-[#E8E2D9] rounded-xl text-center hover:bg-[#F5F0E8] transition-colors text-[#8A8279] text-sm font-medium">
                         Mark Sprint Complete
                       </button>
                     </div>
                   </div>
                 );
               }
               if (activePrescription) {
                 return (
                   <DailyPrescriptionDashboard 
                     prescriptionId={activePrescription.id}
                     tasks={activePrescription.tasks}
                     intentions={activePrescription.implementation_intentions}
                     totalMinutes={activePrescription.total_estimated_minutes}
                     onSendMessage={sendMessage}
                     onTasksUpdated={(newTasks, newIntentions) => {
                       setActivePrescription({ ...activePrescription, tasks: newTasks, implementation_intentions: newIntentions });
                     }}
                   />
                 );
               }
               else if (activeRoadmap) {
                 const cards = [
                   { icon: '📝', label: 'Log today\'s classes', prompt: `Log my class session for today so we can generate the prescription` },
                   { icon: '📅', label: 'View Roadmap', prompt: `What is coming up next week in the ${activeRoadmap.institute_name} schedule?` },
                   { icon: '✍️', label: 'Practice problems', prompt: `Give me 5 JEE-level practice problems related to the current week` },
                   { icon: '🎯', label: 'Upload test result', action: () => setShowTestUploader(true) },
                 ];
                 return (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                     {cards.map((card, i) => (
                       <button
                         key={i}
                         onClick={() => card.action ? card.action() : sendMessage(card.prompt!)}
                         className="flex items-start gap-3 p-4 bg-white border border-[#E8E2D9] rounded-2xl text-left hover:border-[#8B7355]/30 hover:shadow-sm transition-all group"
                       >
                         <span className="text-lg mt-0.5">{card.icon}</span>
                         <span className="text-[13px] font-medium text-[#8A8279] leading-snug group-hover:text-[#2D2A26]">{card.label}</span>
                       </button>
                     ))}

                     {/* Memory Snapshot Card */}
                     <button
                         onClick={() => setShowMemorySnapshot(true)}
                         className="flex items-start gap-3 p-4 bg-[#F5F0E8]/50 border border-[#E8E2D9] rounded-2xl text-left hover:border-[#8B7355]/30 hover:shadow-sm transition-all group col-span-1 md:col-span-2"
                     >
                         <span className="text-lg mt-0.5">🧠</span>
                         <span className="text-[13px] font-medium text-[#8B7355] leading-snug">View what Atlas knows about you (Memory Snapshot)</span>
                     </button>
                   </div>
                 );
               } 
               else if (selectedPlan) {
                 const { topic, subject } = getSuggestionContext();
                 const cards = [
                   { icon: '📖', label: 'Explain today\'s topic', prompt: `Explain ${topic} in simple terms with examples` },
                   { icon: '✍️', label: 'Practice problems', prompt: `Give me 5 JEE-level practice problems on ${topic}` },
                   { icon: '🧠', label: 'Test my knowledge', prompt: `Quiz me on ${topic} — ask 3 conceptual questions and evaluate my answers` },
                   { icon: '📅', label: 'Reschedule plan', prompt: `I've missed a few days on ${subject}. Can you reschedule my plan?` },
                 ];
                 return (
                   <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                     {cards.map((card, i) => (
                       <button
                         key={i}
                         onClick={() => sendMessage(card.prompt)}
                         className="flex items-start gap-3 p-4 bg-white border border-[#E8E2D9] rounded-2xl text-left hover:border-[#8B7355]/30 hover:shadow-sm transition-all group"
                       >
                         <span className="text-lg mt-0.5">{card.icon}</span>
                         <span className="text-[13px] font-medium text-[#8A8279] leading-snug group-hover:text-[#2D2A26]">{card.label}</span>
                       </button>
                     ))}
                   </div>
                 );
               }
               return null;
            })()}
          </div>

          {/* Input at the bottom */}
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
      ) : (
        /* ──────────────────────────────────────────── */
        /* CONVERSATION STATE: Scrolling messages       */
        /* ──────────────────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Slim Context Awareness Bar — blends into page, no hard divider */}
          <div className="shrink-0 px-6 pt-3 pb-2 flex items-center gap-3 overflow-x-auto bg-transparent">
            {/* Curriculum / Roadmap Selector */}
            {studentRoadmaps.length > 0 || studyPlans.length > 0 ? (
              <div className="relative group">
                <button className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A8279] bg-[#F5F0E8] hover:bg-[#EDE8DE] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors">
                  {activeRoadmap ? (
                    <><Target className="w-3 h-3 text-[#8B7355]" /> {activeRoadmap.institute_name} · W{activeRoadmap.current_week}</>
                  ) : selectedPlan ? (
                    <><Layers className="w-3 h-3 text-[#8B7355]" /> {studyPlans.find(p => p.id === selectedPlan)?.subject || 'Plan'}</>
                  ) : (
                    <><Layers className="w-3 h-3 text-[#B5AEA5]" /> Choose Curriculum</>
                  )}
                  <ChevronDown className="w-3 h-3 text-[#B5AEA5]" />
                </button>
                {/* Dropdown */}
                <div className="absolute top-full left-0 mt-1 w-60 bg-white rounded-xl border border-[#E8E2D9] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  {studentRoadmaps.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-[#B5AEA5] uppercase tracking-wider bg-[#F5F0E8]">
                      Curriculums
                    </div>
                  )}
                  {studentRoadmaps.map((rm) => (
                    <button
                      key={rm.id}
                      onClick={() => switchRoadmap(rm.id)}
                      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#F5F0E8] flex items-center gap-2 ${activeRoadmap?.id === rm.id ? 'bg-[#8B7355]/5 text-[#8B7355]' : 'text-[#2D2A26]'}`}
                    >
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{rm.institute_name} ({rm.program}) · W{rm.current_week}</span>
                      {activeRoadmap?.id === rm.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8B7355]" />}
                    </button>
                  ))}
                  {studyPlans.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-[#B5AEA5] uppercase tracking-wider bg-[#F5F0E8] border-t border-[#E8E2D9]">
                      Legacy Plans
                    </div>
                  )}
                  {studyPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan.id); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#F5F0E8] flex items-center gap-2 ${selectedPlan === plan.id ? 'bg-[#8B7355]/5 text-[#8B7355]' : 'text-[#2D2A26]'}`}
                    >
                      <Layers className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{plan.subject} — Class {plan.class}</span>
                      {selectedPlan === plan.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8B7355]" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {activeSprint && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#B87B6B] bg-[#F5F0E8] px-2.5 py-1 rounded-full whitespace-nowrap">
                <Flame className="w-3 h-3 text-[#B87B6B]" />
                Sprint: {activeSprint.sprint_name}
              </div>
            )}
            {activePrescription && activePrescription.tasks?.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B8E6B] bg-[#F5F0E8] px-2.5 py-1 rounded-full whitespace-nowrap">
                <Zap className="w-3 h-3 text-[#6B8E6B]" />
                {activePrescription.tasks.filter((t: any) => t.completed).length}/{activePrescription.tasks.length} tasks
              </div>
            )}
            {userProfile?.subject_affinity?.strongest_subject && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A8279] bg-[#F5F0E8] px-2.5 py-1 rounded-full whitespace-nowrap">
                <Brain className="w-3 h-3 text-[#8A8279]" />
                Strong: {userProfile.subject_affinity.strongest_subject}
              </div>
            )}
            {/* Quick inline actions */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setShowMemorySnapshot(true)}
                className="p-1.5 rounded-lg hover:bg-[#F5F0E8] text-[#B5AEA5] hover:text-[#8B7355] transition-colors"
                title="Memory Snapshot"
              >
                <Brain className="w-3.5 h-3.5" />
              </button>
              {activeRoadmap && (
                <>
                  <button
                    onClick={() => setShowTestUploader(true)}
                    className="p-1.5 rounded-lg hover:bg-[#F5F0E8] text-[#B5AEA5] hover:text-[#B87B6B] transition-colors"
                    title="Upload Test"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => sendMessage("Log my class session for today")}
                    className="p-1.5 rounded-lg hover:bg-[#F5F0E8] text-[#B5AEA5] hover:text-[#6B8E6B] transition-colors"
                    title="Log Class"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <MessageList
            messages={messages}
            isLoading={isLoading}
            isMentor={isMentor}
            title={title}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
          />

          <div className="shrink-0">
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
        </div>
      )}
    </div>
  );
}

