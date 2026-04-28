import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGeminiJSON } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

const RANJAN_VOICE_SYSTEM = `You are Ranjan Sir, a warm, perceptive JEE mentor who has been coaching students for 15+ years. You speak with the rhythm of someone who cares deeply but never panics. Your tone is encouraging, specific, and occasionally uses gentle humor. You never use generic motivational fluff. Every sentence must reference the student's actual plan, weak areas, or upcoming test. You are writing the voiceover script for their daily study briefing.`;

function buildVoicePrompt(plan: any, profile: any, name: string): string {
  const tasks = plan.tasks || [];
  const intentions = plan.implementation_intentions || [];
  const nextTest = plan.context_snapshot?.next_test;
  const weakAreas = plan.context_snapshot?.weak_areas || [];
  const taskSummaries = tasks.map((t: any, i: number) =>
    `Task ${i + 1}: ${t.title || t.topic} (${t.type}). ${t.duration_min} minutes. Key instruction: ${t.details?.split('\n')[0] || t.type}`
  ).join('\n');

  const weakHook = weakAreas.length
    ? `They are currently weakest in: ${weakAreas.map((w: any) => `${w.key} at ${w.mastery}% mastery`).join(', ')}.`
    : '';

  const testHook = nextTest
    ? `Their next test is ${nextTest.name} in ${nextTest.days_until} days. Build natural urgency without anxiety.`
    : '';

  return `Write a warm, spoken-word daily briefing script for ${name}. Here is their exact study plan for today:

${taskSummaries}

${weakHook}
${testHook}

Implementation intentions to weave in naturally:
${intentions.map((ii: any) => `- ${ii.trigger}: ${ii.action}`).join('\n')}

Requirements:
1. Start with a 1-sentence greeting that uses their name and acknowledges their current week.
2. Walk through each task in order, adding 1 specific tip per task that ONLY Ranjan Sir would know (e.g., "You tend to skip the FBD step when rushed — draw it first today").
3. End with a 2-sentence close: one honest encouragement, one tiny accountability nudge.
4. Total length: 90-120 seconds when spoken. About 180-220 words.
5. Format as a single text string with paragraph breaks. No markdown headers, no bullet lists.

Output JSON: { "voice_script": "string", "estimated_duration_sec": number, "tone_tags": ["warm","specific","gently urgent"] }`;
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_ANON_KEY')??'', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_ANON_KEY')??'', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const token = req.headers.get('Authorization')!.replace('Bearer ','');
    const { data:{user}, error: authErr } = await sb.auth.getUser(token);
    if (authErr||!user) return new Response(JSON.stringify({error:'Unauthorized'}), {status:401, headers:{...corsHeaders,'Content-Type':'application/json'}});

    const { plan, user_name } = await req.json();
    if (!plan || !plan.tasks) throw new Error('Plan object with tasks is required');

    const { data: profile } = await sb.from('student_behavioral_profiles').select('*').eq('user_id', user.id).maybeSingle();
    const name = user_name || profile?.nickname || 'Student';

    const prompt = buildVoicePrompt(plan, profile, name);
    const voiceJSON = await callGeminiJSON<any>(
      [{ role: 'system', content: 'You output JSON only.' }, { role: 'user', content: prompt }],
      { temperature: 0.7 }
    );

    return new Response(JSON.stringify({ success: true, voice_script: voiceJSON.voice_script, estimated_duration_sec: voiceJSON.estimated_duration_sec, tone_tags: voiceJSON.tone_tags }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
