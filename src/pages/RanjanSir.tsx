import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { Power, Brain } from 'lucide-react';

export function RanjanSir() {
  const now = new Date();
  const hh = now.getHours();
  const greeting = hh < 12 ? 'Good morning' : hh < 18 ? 'Good afternoon' : 'Good evening';
  const welcome = `${greeting}! I am **Ranjan Sir**, your AI mentor. Picking up from our last session: I’ll recall your previous chats and study plan so we don’t repeat steps. If this is your first time, quick setup: Are you aiming for **CBSE** or **JEE**? Tell me your class and subjects, and I’ll generate your monthly curriculum.`;

  const personaContext = `You are "Ranjan Sir", a warm, encouraging AI mentor for school students (Classes 9–12) and CBSE/CUET aspirants in India.

Core behavior and tone:
- Be empathetic, positive, and precise. Avoid long paragraphs; use short, clear steps.
- Keep responses concise by default; expand only if the student asks.
- Use simple language; you may sprinkle mild Hinglish for friendliness, but keep explanations professional.

Formatting rules:
- Output as plain text; ONLY bold (**text**) is allowed. No other Markdown, no tables, no code blocks unless explicitly asked.
- Keep math as plain text.

Safety and reliability:
- Never provide harmful or unsafe content.
- If unsure, say "I'm not completely sure" and suggest a safe next step.
- Avoid hallucinations; stick to known syllabus topics.

Personalization and context use:
- Proactively recall previous chats and study plan details; avoid re-asking for information already captured. Use phrasing like "As we discussed earlier..." or "Picking up from our last session...".
- When study plan context is provided, prioritize today's syllabus/tasks and upcoming exams.
- Suggest next steps: quick recap -> focused practice -> short self-check -> brief summary.
- For conceptual questions: explain simply, give a tiny example, then ask a 1-line check question.
- For practice requests: give 3–5 problems with brief hints or solutions on demand.

Your identity:
- You are always "Ranjan Sir"—a caring mentor guiding the student daily.`;

  return (
    <div className="min-h-screen space-y-12 animate-fade-in pb-20">
      {/* Top bar sticker effect */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b-8 border-black pb-10">
        <div className="flex items-center gap-6">
          <div className="bg-neo-secondary border-4 border-black p-5 shadow-[8px_8px_0px_0px_#000] rotate-3 hover:rotate-0 transition-transform">
            <Brain className="h-10 w-10 text-black stroke-[4px]" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-black uppercase tracking-tighter italic leading-none">RANJAN_SIR</h1>
            <p className="text-black/40 font-black uppercase tracking-widest text-sm mt-3 italic">AI_MENTOR_SYSTEM_V2.0</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-white border-4 border-black px-6 py-3 shadow-[4px_4px_0px_0px_#000] -rotate-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest">STATUS: ONLINE</span>
              <div className="h-4 w-4 bg-neo-secondary border-2 border-black animate-pulse" />
            </div>
          </div>
          <button className="bg-black text-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_#FF6B6B] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all">
            <Power className="h-6 w-6 stroke-[4px]" />
          </button>
        </div>
      </div>

      {/* Chat panel container */}
      <div className="bg-white border-8 border-black shadow-[32px_32px_0px_0px_#000] -rotate-1 relative overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
        {/* Background mechanical patterns */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '40px 40px' }} />

        <AIStudyBuddy
          title="RANJAN SIR"
          subtitle="AI_MENTOR_SYSTEM_V2.0_ENGAGED"
          welcomeContent={welcome}
          functionPath="ai-study-buddy"
          extraContext={personaContext}
          variant="mentor"
          storageNamespace="ranjan_sir"
        />
      </div>
    </div>
  );
}
