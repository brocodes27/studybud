import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { Power } from 'lucide-react';

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
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-blue-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-6 w-6 rounded-full bg-blue-500" />
            <div>
              <div className="text-lg font-bold tracking-wide text-blue-900">RANJAN SIR</div>
              <div className="text-xs text-blue-700/70">AI Mentor System v2.0</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="uppercase tracking-wide text-blue-900/80">Status: Online</span>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
            <Power className="h-4 w-4 text-blue-700/70" />
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 h-full">
        <div className="rounded-2xl border border-blue-100 bg-white/80 backdrop-blur overflow-hidden h-[calc(100vh-140px)] shadow-xl shadow-blue-500/5">
          <AIStudyBuddy
            title="RANJAN SIR"
            subtitle="AI Mentor System v2.0"
            welcomeContent={welcome}
            functionPath="ai-study-buddy"
            extraContext={personaContext}
            variant="mentor"
            storageNamespace="ranjan_sir"
          />
        </div>
      </div>
    </div>
  );
}
