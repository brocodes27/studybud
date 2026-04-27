import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// Agent Turn — LLM-powered conversational engine for Ranjan Sir
// ----------------------------------------------------------------------------
// Receives full student context + conversation history, returns either:
//   1. A text message to display to the student
//   2. A tool call for the client to execute (navigate, mark_task_complete, etc.)
//
// Uses Gemini function calling so the model can decide to take actions.
// ============================================================================

interface ToolParam {
  type: string;
  description: string;
  enum?: string[];
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParam>;
    required: string[];
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: 'present_task',
    description: 'Present a specific task to the student with context. Use when the student is ready to start a task or when transitioning between tasks.',
    parameters: {
      type: 'object',
      properties: {
        task_index: { type: 'integer', description: '0-based index of the task in todayTasks array' },
        preface: { type: 'string', description: 'A warm, contextual 1-2 sentence transition before showing the task. Reference student state.' },
      },
      required: ['task_index', 'preface'],
    },
  },
  {
    name: 'mark_task_complete',
    description: 'Mark a task as completed. Use when the student says they finished a task, or when confirming completion after they submit work.',
    parameters: {
      type: 'object',
      properties: {
        task_index: { type: 'integer', description: '0-based index of the task to mark complete' },
        reflection_prompt: { type: 'string', description: 'One micro-reflection question to ask the student before moving on (optional)' },
      },
      required: ['task_index'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate the student to a different page in the app.',
    parameters: {
      type: 'object',
      properties: {
        route: { type: 'string', description: 'Route to navigate to, e.g. /atlas, /prove-it, /dashboard' },
        reason: { type: 'string', description: 'Explain why in 1 sentence' },
      },
      required: ['route', 'reason'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for an explanation, resource, or current information. Use when the built-in knowledge is insufficient.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        context: { type: 'string', description: 'Why you are searching and what you need to find' },
      },
      required: ['query', 'context'],
    },
  },
  {
    name: 'regenerate_plan',
    description: 'Regenerate today\'s study plan with a constraint. Use when the student says they have less/more time, feel burned out, or want to change focus.',
    parameters: {
      type: 'object',
      properties: {
        constraint: { type: 'string', description: 'What changed, e.g. "only 30 minutes today", "feeling tired, need easy tasks", "want to focus on Mechanics only"' },
        duration_minutes: { type: 'integer', description: 'New total session duration in minutes (optional)' },
      },
      required: ['constraint'],
    },
  },
  {
    name: 'open_mentor_chat',
    description: 'Escalate to a deeper Atlas chat session. Use when the student needs extended help on a concept or wants a full Socratic dialogue.',
    parameters: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'What the student is stuck on — this context is carried into Atlas' },
        topic: { type: 'string', description: 'Subject/topic for routing' },
      },
      required: ['context'],
    },
  },
  {
    name: 'ask_reflection',
    description: 'Ask the student a micro-reflection question after task completion or at end of session. Stores in learner model.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The 1-sentence reflection question' },
        store_as: { type: 'string', description: 'Category: concept_gap, silly_mistake, confidence, strategy, or general' },
      },
      required: ['question', 'store_as'],
    },
  },
  {
    name: 'show_suggested_replies',
    description: 'Offer 1-3 quick reply buttons the student can tap. Use to guide the conversation flow naturally.',
    parameters: {
      type: 'object',
      properties: {
        replies: { type: 'string', description: 'JSON array of 1-3 suggested reply strings, e.g. ["Let\'s start", "I only have 30 min", "Skip to the hard stuff"]' },
      },
      required: ['replies'],
    },
  },
];

function buildSystemPrompt(context: any): string {
  const s = context.studentState || {};
  const tasks = context.todayTasks || [];
  const nextTest = context.nextTest || null;

  return `You are Ranjan Sir — a warm, perceptive, slightly witty JEE mentor who treats each student as an individual. You are NOT a generic chatbot. You have real agency: you can mark tasks complete, navigate the app, search the web, regenerate plans, and escalate to deeper chats.

## Your Personality
- Use the student's name (${context.userName || 'student'}) naturally.
- If they have a streak, reference it with genuine warmth. If they missed days, be encouraging but honest.
- You push when they need pushing and ease up when they need rest. You READ their state and adapt.
- Use short sentences. Warm, direct, Indian-English cadence. No corporate speak.
- You are concise: 1-3 sentences per message normally. Only go longer for explaining a concept.

## Today's Context
- Streak: ${s.currentStreak || 0} days
- Backlog: ${s.backlogCount || 0} items
- Missed days streak: ${s.missedDaysStreak || 0}
- Weak subjects: ${(s.weakSubjects || []).join(', ') || 'none flagged'}
- Preferred study time: ${s.preferredTime || 'evening'}
- Typical session: ${s.typicalSessionDuration || 90} min
- Upcoming test: ${nextTest ? `${nextTest.name} in ${nextTest.daysUntil} days` : 'none scheduled'}

## Today's Tasks (${tasks.length})
${tasks.map((t: any, i: number) => `${i}. [${t.completed ? 'DONE' : 'PENDING'}] ${t.type} — ${t.title} (${t.subject || 'General'}) ${t.durationMin || 30}min`).join('\n')}

## How You Behave
1. ONE MESSAGE AT A TIME. Never dump multiple messages. Wait for the student to reply.
2. When showing a task, use the \`present_task\` tool — don't just describe it in text.
3. When a student finishes a task, ask ONE micro-reflection question before showing the next task.
4. If they say "done" or "finished", mark the current task complete.
5. If they need help with a concept, you have two options: explain briefly yourself, OR use \`open_mentor_chat\` if it's complex.
6. If they have limited time, use \`regenerate_plan\` — don't just say "ok".
7. If your knowledge is weak on a specific JEE topic, use \`search_web\`.
8. Always offer 1-3 suggested replies to keep the flow moving.

## Conversation Flow (typical session)
- Greeting → Check-in (how are you feeling?) → Present first pending task → Wait for student → Mark complete if done → Micro-reflection → Present next task → ... → Wrap up with reflection.
- But you MUST adapt based on what the student actually says. No rigid script.

## Tool Calling Rules
- Only call ONE tool per turn maximum.
- If you want to both say something AND take an action, use the tool — the tool's preface/reason field carries your voice.
- If no tool is needed, just reply with text.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { messages, context, tool_results } = body

    const systemPrompt = buildSystemPrompt(context)

    // Build Gemini contents from conversation
    const contents: any[] = []

    // System prompt as first user message (Gemini doesn't have a native system role in contents)
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    })

    // Add conversation history
    for (const m of (messages || [])) {
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })
    }

    // If there was a tool result from a previous turn, add it
    if (tool_results) {
      contents.push({
        role: 'user',
        parts: [{ text: `Tool result: ${JSON.stringify(tool_results)}` }],
      })
    }

    const geminiBody: any = {
      contents,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 2048,
      },
    }

    // Add function declarations
    geminiBody.tools = [{
      functionDeclarations: TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    }]

    const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
    const model = Deno.env.get('AGENT_MODEL') || 'gemini-3-flash-preview'

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${errText}`)
    }

    const geminiData = await res.json()
    const candidate = geminiData?.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check for function call
    const functionCallPart = parts.find((p: any) => p.functionCall)
    if (functionCallPart) {
      const fc = functionCallPart.functionCall
      return new Response(
        JSON.stringify({
          type: 'tool_call',
          tool: fc.name,
          args: fc.args || {},
          text: parts.find((p: any) => p.text)?.text || '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Plain text response
    const text = parts.map((p: any) => p.text || '').join('').trim()

    return new Response(
      JSON.stringify({ type: 'message', text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('agent-turn error:', error)
    return new Response(
      JSON.stringify({ type: 'message', text: `I'm having a little trouble thinking right now — let's keep going in a moment.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
