import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

serve(async (req: Request) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
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

    // Admin check (server-side)
    const { data: profile } = await sb
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.is_admin) return new Response(JSON.stringify({error:'Admin only'}), {status:403, headers:corsHeaders});

    const { questions } = await req.json();
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('questions[] array required');
    if (questions.length > 500) throw new Error('Max 500 questions per batch');

    const validRows = questions.map((q: any) => ({
      source_type: q.source_type || 'custom',
      source_id: q.source_id || null,
      module_level: q.module_level || null,
      kc_id: q.kc_id || null,
      difficulty: ['easy','medium','hard','very_hard'].includes(q.difficulty) ? q.difficulty : 'medium',
      expected_time_sec: Number(q.expected_time_sec) || 120,
      error_type_hint: q.error_type_hint || null,
      question_text: q.question_text || '',
      solution_text: q.solution_text || null,
      marks: Number(q.marks) || 4,
      negative_marks: Number(q.negative_marks) || 1,
      tags: Array.isArray(q.tags) ? q.tags : (q.topic ? [q.topic] : []),
      exam_type: q.exam_type || 'JEE',
    }));

    const { data: inserted, error: insertErr } = await sb.from('question_metadata').insert(validRows).select();
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, inserted_count: inserted?.length || 0, first_id: inserted?.[0]?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('bulk-ingest-questions error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
