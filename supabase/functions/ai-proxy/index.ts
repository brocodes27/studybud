import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, callGeminiJSON, callGeminiEmbedding } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

const PROMPT_TEMPLATES: Record<string, (payload: any) => { messages: any[]; opts: any }> = {
  analyze_conversation: (p) => ({
    messages: [{ role: 'user', content: `Analyze this educational conversation about ${p.topic} and provide a detailed JSON response with: accuracy (0-100), keywords, feedback, suggestedNextTopics, learningStyle, confidenceLevel, areasForImprovement, strengths, emotionalState. Conversation: ${p.transcript}` }],
    opts: { temperature: 0.2, json: true }
  }),
  generate_feedback: (p) => ({
    messages: [{ role: 'user', content: `Generate personalized, encouraging feedback for a student. Analysis: ${JSON.stringify(p.analysis)}. Topic: ${p.topic}. Keep under 200 words, conversational tone.` }],
    opts: { temperature: 0.7 }
  }),
  generate_insights: (p) => ({
    messages: [{ role: 'user', content: `Analyze this student's learning data and provide insights. Data: ${JSON.stringify(p.data)}. Return JSON with: preferredLearningStyle, knowledgeGaps, strengths, recommendedTopics, difficultyLevel, studyRecommendations.` }],
    opts: { temperature: 0.3, json: true }
  }),
  generate_adaptive_questions: (p) => ({
    messages: [{ role: 'user', content: `Generate ${p.count || 3} adaptive questions for topic "${p.topic}" at ${p.difficulty || 'medium'} difficulty. Student level: ${p.level || 'intermediate'}. Return JSON array of {question, options, correctAnswer, explanation, difficulty}.` }],
    opts: { temperature: 0.5, json: true }
  }),
  detect_emotional_state: (p) => ({
    messages: [{ role: 'user', content: `Analyze this student message for emotional state. Message: "${p.message}". Context: ${p.context || ''}. Return JSON with {emotion, confidence, suggestedResponseTone}.` }],
    opts: { temperature: 0.3, json: true }
  }),
  generate_chat_completion: (p) => ({
    messages: [
      ...(p.systemPrompt ? [{ role: 'system', content: p.systemPrompt }] : []),
      { role: 'user', content: p.prompt }
    ],
    opts: { temperature: p.temperature ?? 0.7 }
  }),
  viva_questions: (p) => ({
    messages: [{ role: 'user', content: `Generate 3 viva voce (oral exam) questions for JEE topic "${p.topic}". Return JSON array of {question, context, expectedKeyPoints, difficulty}.` }],
    opts: { temperature: 0.5, json: true }
  }),
  transcribe_audio: (p) => ({
    messages: [{ role: 'user', content: [{ type: 'text', text: p.prompt || 'Transcribe this audio verbatim as plain text.' }, { type: 'image', dataUrl: p.base64Audio }] }],
    opts: { temperature: 0.0, json: true }
  }),
  analyze_images: (p) => ({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: p.systemPrompt ? `SYSTEM: ${p.systemPrompt}\n\n${p.prompt || 'Analyze this image.'}` : (p.prompt || 'Analyze this image.') },
        ...(p.images || []).map((img: string) => ({ type: 'image', dataUrl: img }))
      ]
    }],
    opts: { temperature: 0.4 }
  }),
};

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_ANON_KEY')??'', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const token = req.headers.get('Authorization')!.replace('Bearer ','');
    const { data:{user}, error: authErr } = await sb.auth.getUser(token);
    if (authErr||!user) return new Response(JSON.stringify({error:'Unauthorized'}), {status:401, headers:corsHeaders});

    const { action, payload } = await req.json();

    if (action === 'get_embedding') {
      const embedding = await callGeminiEmbedding(payload.text);
      return new Response(JSON.stringify({ success: true, result: embedding }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tmpl = PROMPT_TEMPLATES[action];
    if (!tmpl) return new Response(JSON.stringify({error:`Unknown action: ${action}`}), {status:400, headers:corsHeaders});

    // 1. Check AI budget before calling API
    const { data: hasBudget, error: budgetError } = await sb.rpc('check_ai_budget', { p_user_id: user.id });
    if (budgetError) console.error('Budget check error:', budgetError);
    if (hasBudget === false) {
      return new Response(JSON.stringify({ error: 'Monthly AI budget limit reached for your school. Please contact your administrator to upgrade your plan.' }), { 
        status: 402, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { messages, opts } = tmpl(payload);
    const isJson = opts.json;
    const result = isJson ? await callGeminiJSON(messages, opts) : await callGemini(messages, opts);

    // 2. Log AI usage details asynchronously
    const promptLen = JSON.stringify(messages).length;
    const completionLen = typeof result === 'string' ? result.length : JSON.stringify(result).length;
    sb.rpc('log_ai_usage', {
      p_user_id: user.id,
      p_model: 'gemini-1.5-flash',
      p_feature_name: action,
      p_prompt_len: promptLen,
      p_completion_len: completionLen
    }).catch((err: any) => console.error('Failed to log AI consumption:', err));

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('ai-proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
