import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

const META: Record<string, any> = {
  review_notes: { verb: 'Build the foundation', duration: 30, strategy: 'Write down the 3 most important formulas WITHOUT looking first. Then verify.', checkpoint: 'Can you write the key formula from memory?', coachNote: 'Slow is smooth, smooth is fast.' },
  guided_examples: { verb: 'Pattern-mastery drill', duration: 40, strategy: 'Cover the solution, attempt it yourself, then reveal and compare your steps.', checkpoint: 'Could you explain the solution to a friend?', coachNote: 'You need to SEE the pattern.' },
  retrieval_check: { verb: 'Closed-book pressure test', duration: 20, strategy: 'Put ALL notes away. Write everything you know about this topic.', checkpoint: 'Did you recall at least 80% correctly?', coachNote: 'Retrieval is the single most effective learning technique.' },
  timed_set: { verb: 'Exam simulation', duration: 25, strategy: 'NO notes, NO phone, NO breaks. Mark errors and classify them.', checkpoint: 'How many were silly mistakes vs concept gaps?', coachNote: 'Speed without accuracy is worthless.' },
  confidence_builder: { verb: 'Quick win', duration: 15, strategy: 'Re-solve 3 problems you have solved correctly before.', checkpoint: 'Did all 3 feel easier than the first time?', coachNote: "A 1-day win feels possible. Let's make today a win." },
  backlog_sweep: { verb: 'Backlog recovery', duration: 20, strategy: 'Pick the single oldest pending task. Do exactly HALF of what it asks.', checkpoint: 'Did you finish half with full attention?', coachNote: 'We clear them one brick at a time.' },
}
const ROTATION = [
  ['review_notes','guided_examples','retrieval_check'],
  ['review_notes','timed_set','guided_examples'],
  ['guided_examples','retrieval_check','review_notes'],
  ['review_notes','guided_examples','timed_set'],
  ['retrieval_check','review_notes','guided_examples'],
  ['timed_set','guided_examples','retrieval_check'],
  ['review_notes','retrieval_check','timed_set'],
];

function buildDesc(meta: any, subject: string, topic: string, subtopics: string[], weak: any, test: any, days: number|null): string {
  const list = subtopics.length ? '\nTargets:\n'+subtopics.map((s:string,i:number)=>`${i+1}. ${s}`).join('\n') : '';
  const hook = weak ? `Focus: ${weak.key} accuracy ${weak.accuracy}%. ${weak.mastery<40?'Red flag — fix today.':'Push above 70%.'}\n\n` : '';
  let d = `${meta.verb} — ${topic} (${subject})\n\n${hook}Strategy: ${meta.strategy}${list}\n\nCheck: ${meta.checkpoint}\n\nNote: ${meta.coachNote}`;
  if (test && days!==null && days<=7) d += `\n\nTest: ${test.test_name} in ${days} days. ~8-12 marks.`;
  return d;
}

function buildIntentions(preferredTime: string, duration: number, firstSubject: string) {
  return [
    { trigger: `At ${preferredTime}`, action: `Phone away. Open ${firstSubject} notes. Set 25-min timer.`, duration_min: 5 },
    { trigger: 'If I feel like skipping', action: 'Do exactly 2 problems instead of 5. Consistency beats intensity.', duration_min: 2 },
    { trigger: 'After each task', action: '30-second reflection: what still felt fuzzy?', duration_min: 5 },
    { trigger: `If finish early (under ${duration} min)`, action: 'Pick weakest subject, do 1 retrieval check. No notes.', duration_min: 10 },
  ];
}

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
    if (authErr||!user) return new Response(JSON.stringify({error:'Unauthorized'}), {status:401, headers:{...corsHeaders,'Content-Type':'application/json'}});

    const { roadmap_id, target_date } = await req.json();
    const date = target_date || new Date().toISOString().split('T')[0];

    const { data:roadmap } = await sb.from('student_roadmaps').select('*').eq('id', roadmap_id).single();
    if (!roadmap) throw new Error('Roadmap not found');

    const [sRes, pRes, wRes, tRes, tplRes] = await Promise.all([
      sb.from('class_sessions').select('subject,topics_covered,homework_assigned').eq('roadmap_id',roadmap_id).eq('session_date',date),
      sb.from('student_behavioral_profiles').select('*').eq('user_id',user.id).maybeSingle(),
      sb.from('user_subject_mastery').select('domain,subdomain,mastery_score,questions_attempted,questions_correct').eq('user_id',user.id).order('mastery_score',{ascending:true}).limit(5),
      sb.from('upcoming_tests').select('*').eq('roadmap_id',roadmap_id).eq('status','upcoming').gte('test_date',date).order('test_date',{ascending:true}).limit(1),
      sb.from('coaching_templates').select('weekly_schedule').eq('id',roadmap.template_id).maybeSingle(),
    ]);

    const profile = pRes.data;
    const weakAreas = wRes.data||[];
    const nextTest = (tRes.data||[])[0]||null;
    const template = tplRes.data;
    const dow = new Date(date).getDay();
    const daysUntil = nextTest ? Math.ceil((new Date(nextTest.test_date).getTime()-new Date(date).getTime())/(86400000)) : null;

    const weakMap = new Map();
    weakAreas.forEach((w:any)=>{ const k=`${w.domain}${w.subdomain?' — '+w.subdomain:''}`; weakMap.set(k,{mastery:Math.round((w.mastery_score||0)*100),accuracy:w.questions_attempted>0?Math.round((w.questions_correct/w.questions_attempted)*100):0}); });
    const weakest = Array.from(weakMap.entries()).slice(0,3).map(([key,v]:[string,any])=>({key,...v}));

    let types = [...ROTATION[dow]];
    if (daysUntil!==null && daysUntil<=3) types=['timed_set','timed_set','timed_set'];
    else if (daysUntil!==null && daysUntil<=7) types=['timed_set','retrieval_check','timed_set'];

    const streak = profile?.missed_days_streak||0;
    const backlog = profile?.backlog_count||0;
    if (streak>2) types[0]='confidence_builder';
    if (backlog>5) types.push('backlog_sweep');

    let tasks: any[] = [];
    const sched = template?.weekly_schedule;

    if (sched && Array.isArray(sched)) {
      const we = sched.find((w:any)=>w.week===roadmap.current_week);
      if (we) {
        const subs = ['physics','chemistry','mathematics'].filter((s:string)=>we[s]);
        tasks = subs.map((subj:string,i:number)=>{
          const td = we[subj]; const st = td.subtopics||[];
          const tt = types[i]||'review_notes'; const m=META[tt];
          const sn = subj.charAt(0).toUpperCase()+subj.slice(1);
          const wm = weakest.find((w:any)=>w.key.toLowerCase().includes(sn.toLowerCase())||w.key.toLowerCase().includes(td.topic.toLowerCase()))||null;
          return { order:i+1, title:`${sn}: ${td.topic}`, subject:sn, type:tt, duration_min:m.duration,
            details: buildDesc(m,sn,td.topic,st,wm,nextTest,daysUntil),
            difficulty: wm?(wm.mastery<40?'easy':wm.mastery<70?'medium':'hard'):'medium',
            resources: td.resources||['Class notes','NCERT'], topic: td.topic, subtopics: st };
        });
      }
    }

    if (!tasks.length) {
      const defaults = ['Physics — Mechanics','Chemistry — Organic','Mathematics — Calculus'];
      tasks = defaults.map((t:string,i:number)=>{
        const [sn,topic] = t.split(' — ');
        const tt = types[i]||'review_notes'; const m=META[tt];
        const wm = weakest.find((w:any)=>w.key.toLowerCase().includes(sn.toLowerCase()))||null;
        return { order:i+1, title:t, subject:sn, type:tt, duration_min:m.duration,
          details: buildDesc(m,sn,topic,[],wm,nextTest,daysUntil), difficulty:'medium', resources:['Class notes'], topic, subtopics: [] };
      });
    }

    // ── Enrich tasks with specific question metadata when available ──
    if (tasks.length > 0) {
      const topicTags = tasks.map((t: any) => t.topic).filter(Boolean);
      if (topicTags.length > 0) {
        try {
          const { data: questions } = await sb.from('question_metadata')
            .select('id, question_text, difficulty, kc_id, tags, marks, expected_time_sec')
            .in('tags', topicTags)
            .limit(topicTags.length * 3);
          if (questions && questions.length > 0) {
            tasks = tasks.map((t: any) => {
              const matched = questions.filter((q: any) => q.tags?.includes(t.topic));
              if (matched.length > 0) {
                const qList = matched.slice(0, 3).map((q: any, i: number) => `Q${i + 1} [${q.difficulty}, ${q.marks}m, ~${Math.round((q.expected_time_sec || 120) / 60)}min]: ${q.question_text?.substring(0, 80) || 'See question metadata'}...`).join('\n');
                return { ...t, details: `${t.details}\n\n📚 Specific Questions:\n${qList}`, question_refs: matched.slice(0, 3).map((q: any) => q.id) };
              }
              return t;
            });
          }
        } catch (e) {
          console.warn('question_metadata enrichment failed:', e);
        }
      }
    }

    const { data: activeInterventions } = await sb
      .from('interventions')
      .select('id, intervention_level, action_type, action_payload, trigger_type, severity')
      .eq('student_user_id', user.id)
      .eq('status', 'active')
      .order('intervention_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    const activeIntervention = (activeInterventions || [])[0] || null;

    tasks = tasks.map((task: any) => {
      const duration = Number(task.duration_min || task.estimated_minutes || 30);
      const lowDuration = Math.max(12, Math.round(duration * 0.45));
      const normalDuration = duration;
      const beastDuration = Math.round(duration * 1.45);
      const proofRequired = Boolean(activeIntervention?.action_payload?.proof_required);
      const trigger = activeIntervention?.trigger_type
        ? `Intervention: ${activeIntervention.trigger_type.replaceAll('_', ' ')}.`
        : null;

      return {
        ...task,
        proof_required: proofRequired,
        intervention_id: activeIntervention?.id || null,
        why_today: [
          trigger,
          task.details || task.description || `${task.subject || 'Study'} is next in your roadmap.`,
        ].filter(Boolean).join(' '),
        mission_variants: [
          {
            mode: 'low',
            label: 'Low energy',
            durationMin: lowDuration,
            taskLimit: 1,
            description: 'Do the smallest version that keeps the chain alive.',
          },
          {
            mode: 'normal',
            label: 'Normal',
            durationMin: normalDuration,
            description: 'Do the mission exactly as prescribed.',
          },
          {
            mode: 'beast',
            label: 'Beast mode',
            durationMin: beastDuration,
            description: 'Add one extra retrieval check or timed mini-set after completion.',
          },
        ],
      };
    });

    const totalMin = tasks.reduce((sum:number,t:any)=>sum+(t.duration_min||0),0);
    const preferredTime = profile?.preferred_time||'evening';
    const typicalDuration = profile?.typical_session_duration_min||90;
    const firstSubject = tasks[0]?.subject||'your first subject';
    const intentions = buildIntentions(preferredTime,typicalDuration,firstSubject);

    const contextSnapshot = { roadmap_week: roadmap.current_week, today_sessions: sRes.data||[], next_test: nextTest?{name:nextTest.test_name,date:nextTest.test_date,days_until:daysUntil}:null, behavioral_profile: profile||{}, weak_areas: weakest, generated_by: 'deterministic_engine_v1' };

    const plan = { total_estimated_minutes: totalMin, tasks, implementation_intentions: intentions, context_snapshot: contextSnapshot, source: 'deterministic' };

    return new Response(JSON.stringify({ success: true, plan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error:any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
