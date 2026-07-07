// Public, guest-safe edge function powering the anonymous landing-page
// "Prove-It" demo. No user JWT required (verify_jwt = false in config.toml);
// abuse is bounded by CORS origin allow-listing, a server-locked system
// prompt, input-size caps, and a small output-token budget.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { callGemini } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

const MAX_MESSAGE_CHARS = 1500
const MAX_HISTORY_TURNS = 12 // caps a demo session to ~6 Q/A exchanges

const DEMO_SYSTEM = `You are ATLAS in Prove-It demo mode — a strict Socratic examiner for JEE (Physics/Chemistry/Maths) preparation.
Rules:
- Only discuss JEE academic topics. If asked anything else, reply: "This demo only covers JEE topics — pick a topic above."
- Ask ONE concise question at a time. Do NOT explain. Do NOT encourage.
- When instructed by the user prompt to output a verdict, use exactly: [VERDICT:passed] Rigor:X/10 <summary> (or [VERDICT:failed]).
- Keep every reply under 80 words.`

serve(async (req: Request) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { message, conversation_history = [] } = await req.json()

    if (typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (
      message.length > MAX_MESSAGE_CHARS ||
      (Array.isArray(conversation_history) && conversation_history.length > MAX_HISTORY_TURNS)
    ) {
      return new Response(JSON.stringify({ error: 'Demo limit reached — sign up to keep going.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await callGemini(
      [
        { role: 'system', content: DEMO_SYSTEM },
        { role: 'user', content: message.slice(0, MAX_MESSAGE_CHARS) },
      ],
      { temperature: 0.4, maxOutputTokens: 300 },
    )

    // Match generateEmpatheticChat's response shape so callers stay uniform
    return new Response(JSON.stringify({
      response,
      emotion_detected: 'neutral',
      pedagogical_mode: 'socratic_examiner',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('landing-demo error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
