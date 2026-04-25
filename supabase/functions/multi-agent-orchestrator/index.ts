import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    const { message, session_id, conversation_history, study_context, use_full_orchestration = true } = await req.json()

    // ============================================
    // 0.5 COMPLETION INTENT — if the user explicitly says they've finished today's tasks,
    // mark the pending tasks in today's prescription as completed and log to task_completions_v2
    // so future turns (and every agent) see the updated state.
    // ============================================
    let autoCompletedCount = 0
    try {
      const msgLower = String(message || '').toLowerCase()
      const completionIntent =
        /\b(i\s*(have|'?ve|already)?\s*(just\s*)?(completed|finished|done|did)|done with|finished)\b.*\b(task|tasks|prescription|homework|today'?s|all of (them|it))\b/.test(msgLower) ||
        /\b(all\s*(tasks|done|completed))\b/.test(msgLower) ||
        /\b(completed|finished|done)\s+(all|the|my|today'?s)\b/.test(msgLower)

      if (completionIntent) {
        const todayStrInner = new Date().toISOString().split('T')[0]
        const { data: pres } = await supabaseClient
          .from('daily_prescriptions')
          .select('id, tasks')
          .eq('user_id', user.id)
          .eq('prescription_date', todayStrInner)
          .maybeSingle()

        if (pres && Array.isArray(pres.tasks) && pres.tasks.length > 0) {
          const pendingTasks = pres.tasks.filter((t: any) => !t.completed)
          autoCompletedCount = pendingTasks.length
          if (autoCompletedCount > 0) {
            const newTasks = pres.tasks.map((t: any) => ({ ...t, completed: true, completed_at: t.completed_at || new Date().toISOString() }))
            await supabaseClient.from('daily_prescriptions').update({ tasks: newTasks }).eq('id', pres.id)

            // Best-effort log to task_completions_v2 for each newly-completed task
            const rows = pres.tasks
              .map((t: any, idx: number) => ({ original: t, idx }))
              .filter(({ original }: any) => !original.completed)
              .map(({ original, idx }: any) => ({
                user_id: user.id,
                source_type: 'prescription',
                source_id: pres.id,
                task_order: idx,
                scheduled_date: todayStrInner,
                completed_at: new Date().toISOString(),
                task_snapshot: original,
              }))
            if (rows.length > 0) {
              const { error: v2Err } = await supabaseClient.from('task_completions_v2').insert(rows)
              if (v2Err) console.warn('task_completions_v2 insert failed:', v2Err.message)
            }
          }
        }
      }
    } catch (intentErr) {
      console.warn('Completion-intent handling failed:', (intentErr as any)?.message || intentErr)
    }

    // ============================================
    // 0. ACTIVITY SNAPSHOT — What has the student actually done?
    // Parallel-fetch a rich context bundle so Atlas knows:
    //  - their weak areas (knowledge graph)
    //  - what they've completed / uploaded recently
    //  - recent tests, classes, prescriptions, videos
    //  - persistent memories (preferences, goals, bookmarks)
    // Everything runs under the user's JWT so RLS enforces privacy.
    // ============================================
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    // Use allSettled so a single missing table / schema drift can't wipe the whole snapshot.
    const settled = await Promise.allSettled([
      supabaseClient
        .from('student_cognitive_profiles')
        .select('p_mastery, cognitive_tier, knowledge_components ( topic, subject )')
        .eq('user_id', user.id)
        .lt('p_mastery', 0.8)
        .order('p_mastery', { ascending: true })
        .limit(5),
      supabaseClient
        .from('task_completions')
        .select('plan_id, day_number, created_at')
        .eq('user_id', user.id)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseClient
        .from('task_completions_v2')
        .select('source_type, source_id, task_order, scheduled_date, completed_at, task_snapshot')
        .eq('user_id', user.id)
        .gte('completed_at', sinceIso)
        .order('completed_at', { ascending: false })
        .limit(15),
      supabaseClient
        .from('task_outputs')
        .select('output_type, text_content, file_url, ai_analysis, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseClient
        .from('test_results')
        .select('test_name, score, max_score, weak_topics, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2),
      supabaseClient
        .from('class_sessions')
        .select('subject, topic, notes, taught_at')
        .eq('user_id', user.id)
        .order('taught_at', { ascending: false })
        .limit(5),
      supabaseClient
        .from('daily_prescriptions')
        .select('id, tasks, total_estimated_minutes')
        .eq('user_id', user.id)
        .eq('prescription_date', todayStr)
        .maybeSingle(),
      supabaseClient
        .from('video_generations')
        .select('topic, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseClient
        .from('user_memory')
        .select('memory_type, key, value, last_seen_at, seen_count')
        .eq('user_id', user.id)
        .in('memory_type', ['preference', 'factual', 'goal', 'bookmark', 'skill', 'communication_style'])
        .order('last_seen_at', { ascending: false })
        .limit(12),
      supabaseClient
        .from('student_roadmaps')
        .select('institute_name, program, current_week')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    // Unpack settled results (fall back to empty data on rejection)
    const pick = (i: number) => (settled[i].status === 'fulfilled' ? (settled[i] as any).value : { data: null });
    const weakRes = pick(0);
    const completionsRes = pick(1);
    const completionsV2Res = pick(2);
    const outputsRes = pick(3);
    const testsRes = pick(4);
    const classSessionsRes = pick(5);
    const prescriptionRes = pick(6);
    const videosRes = pick(7);
    const memoriesRes = pick(8);
    const roadmapRes = pick(9);

    // Log any fetch failures for observability (doesn't block response)
    settled.forEach((s, i) => {
      if (s.status === 'rejected') console.warn(`Activity snapshot query ${i} failed:`, (s as any).reason?.message || s);
    });

    const sections: string[] = [];

    // Weak areas
    const weakNodes = (weakRes as any).data as any[] | null;
    if (weakNodes && weakNodes.length > 0) {
      sections.push(
        "Weak Areas (Knowledge Graph):\n" +
          weakNodes
            .map((n: any) => `- ${n.knowledge_components?.subject} / ${n.knowledge_components?.topic} (Mastery: ${(n.p_mastery * 100).toFixed(0)}%, ${n.cognitive_tier})`)
            .join('\n')
      );
    }

    // Active roadmap
    const roadmap = (roadmapRes as any).data;
    if (roadmap) {
      sections.push(`Active Curriculum: ${roadmap.institute_name} (${roadmap.program}), Week ${roadmap.current_week}`);
    }

    // Recent completions (legacy)
    const completions = (completionsRes as any).data as any[] | null;
    const completionsV2 = (completionsV2Res as any).data as any[] | null;
    const hasAnyCompletions = (completions && completions.length > 0) || (completionsV2 && completionsV2.length > 0);

    if (completions && completions.length > 0) {
      sections.push(
        `Completed Study-Plan Days (last 7 days, ${completions.length} total):\n` +
          completions.slice(0, 5).map((c: any) => `- Day ${c.day_number} on ${new Date(c.created_at).toISOString().slice(0, 10)}`).join('\n')
      );
    }

    // Granular completions from task_completions_v2 (prescriptions, daily-briefing items, etc.)
    if (completionsV2 && completionsV2.length > 0) {
      sections.push(
        `Completed Tasks (task_completions_v2, last 7 days, ${completionsV2.length} total):\n` +
          completionsV2.slice(0, 8).map((c: any) => {
            const when = new Date(c.completed_at).toISOString().slice(0, 10);
            const label = c.task_snapshot?.title || c.task_snapshot?.topic || c.task_snapshot?.type || `${c.source_type}#${c.task_order}`;
            return `- [${when}] ${c.source_type}: ${label}`;
          }).join('\n')
      );
    }

    if (!hasAnyCompletions && autoCompletedCount === 0) {
      sections.push("Completed Tasks (last 7 days): none recorded yet.");
    }

    // Auto-completion hint
    if (autoCompletedCount > 0) {
      sections.push(`AUTO-COMPLETION: Based on the student's latest message, I just marked ${autoCompletedCount} pending task(s) in today's prescription as completed. Acknowledge this naturally.`);
    }

    // Recent uploads / submissions
    const outputs = (outputsRes as any).data as any[] | null;
    if (outputs && outputs.length > 0) {
      sections.push(
        "Recent Uploads / Work Submissions:\n" +
          outputs
            .map((o: any) => {
              const when = new Date(o.created_at).toISOString().slice(0, 10);
              if (o.output_type === 'text') return `- [${when}] Text answer: ${String(o.text_content || '').slice(0, 160)}`;
              if (o.output_type === 'image') return `- [${when}] Image submitted${o.ai_analysis?.summary ? ` (AI analysis: ${String(o.ai_analysis.summary).slice(0, 160)})` : ''}`;
              if (o.output_type === 'pdf') return `- [${when}] PDF uploaded${o.ai_analysis?.summary ? ` (${String(o.ai_analysis.summary).slice(0, 160)})` : ''}`;
              return `- [${when}] ${o.output_type}`;
            })
            .join('\n')
      );
    }

    // Recent tests
    const tests = (testsRes as any).data as any[] | null;
    if (tests && tests.length > 0) {
      sections.push(
        "Recent Mock Tests:\n" +
          tests
            .map((t: any) => {
              const when = new Date(t.created_at).toISOString().slice(0, 10);
              const weak = Array.isArray(t.weak_topics) ? t.weak_topics.slice(0, 3).map((x: any) => (typeof x === 'string' ? x : x.topic)).filter(Boolean).join(', ') : '';
              return `- [${when}] ${t.test_name || 'Test'}: ${t.score ?? '?'} / ${t.max_score ?? '?'}${weak ? ` — weak: ${weak}` : ''}`;
            })
            .join('\n')
      );
    }

    // Classes logged
    const classes = (classSessionsRes as any).data as any[] | null;
    if (classes && classes.length > 0) {
      sections.push(
        "Recently Logged Classes:\n" +
          classes
            .map((c: any) => `- [${new Date(c.taught_at).toISOString().slice(0, 10)}] ${c.subject || '?'} — ${c.topic || 'topic'}`)
            .join('\n')
      );
    }

    // Today's prescription
    const prescription = (prescriptionRes as any).data;
    if (prescription && Array.isArray(prescription.tasks) && prescription.tasks.length > 0) {
      const done = prescription.tasks.filter((t: any) => t.completed).length;
      sections.push(
        `Today's Prescription (${done}/${prescription.tasks.length} done, ~${prescription.total_estimated_minutes || '?'} min):\n` +
          prescription.tasks
            .slice(0, 6)
            .map((t: any, i: number) => `${i + 1}. [${t.completed ? 'x' : ' '}] ${t.type || 'task'} — ${t.title || t.topic || ''}`)
            .join('\n')
      );
    }

    // Videos generated / watched
    const videos = (videosRes as any).data as any[] | null;
    if (videos && videos.length > 0) {
      sections.push(
        "Videos Atlas Has Made For Them:\n" +
          videos
            .map((v: any) => `- [${new Date(v.created_at).toISOString().slice(0, 10)}] ${v.topic}`)
            .join('\n')
      );
    }

    // Persistent memory
    const memories = (memoriesRes as any).data as any[] | null;
    if (memories && memories.length > 0) {
      sections.push(
        "Persistent Memory (what I know about this student):\n" +
          memories.map((m: any) => `- (${m.memory_type}) ${m.key}: ${m.value}`).join('\n')
      );
    }

    const activitySnapshot = sections.length > 0
      ? sections.join('\n\n')
      : "No prior activity found for this student yet.";

    // Base context string augmented with full activity snapshot
    const baseContext = `Study Context: ${study_context || 'None'}\n\n=== STUDENT ACTIVITY SNAPSHOT ===\n${activitySnapshot}\n=== END SNAPSHOT ===\n\nRecent Chat History: ${JSON.stringify(conversation_history.slice(-3))}\nStudent Message: ${message}`

    // Internal helper to call Gemini
    const callGemini = async (systemPrompt: string, userPrompt: string) => {
      const contents = [
        { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}\n\nUSER PROMPT: ${userPrompt}` }]}
      ]
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           contents,
           generationConfig: { temperature: 0.3 }
         })
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Gemini call failed', res.status, errText)
        throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`)
      }
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text || typeof text !== 'string' || !text.trim()) {
        console.error('Gemini returned empty candidate', JSON.stringify(data).slice(0, 500))
        throw new Error('Gemini returned empty response (possible safety block or quota)')
      }
      return text
    }

    let finalResponse = ''
    let emotionDetected = 'neutral'
    let pedagogicalMode = 'socratic'

    if (!use_full_orchestration) {
      // Fast path (Route to NDCF mentor or direct)
       finalResponse = await callGemini(
         "You are ATLAS, a warm, friendly, and encouraging study partner. The user prompt contains a STUDENT ACTIVITY SNAPSHOT of what this student has actually done (completions, uploads, tests, classes, videos, memories). Ground your answer in that snapshot — reference concrete items when relevant. Never claim you don't know what they've done. Be supportive and celebrate their progress.",
         baseContext
       )
    } else {
      try {
      // 1. Emotional Agent
      const emotionalOutput = await callGemini(
        "You are the Emotional Intelligence Agent. Analyze the student's emotional state (frustration, confidence, confusion). Output a short JSON with { 'emotion': '...', 'recommended_tone': '...' }",
        baseContext
      )

      try {
        const parsed = JSON.parse(emotionalOutput.replace(/```json/g, '').replace(/```/g, ''))
        emotionDetected = parsed.emotion || 'neutral'
      } catch(e) {}

      // 2. Subject Expert Agent
      const expertOutput = await callGemini(
        "You are the Subject Expert Agent. Ignore teaching style. Just analyze the factual correctness of the student's statement or precisely answer their technical question. Output pure facts.",
        baseContext
      )

      // 3. Pedagogical Agent
      const pedagogyOutput = await callGemini(
        `You are the Pedagogical Agent. Given the Expert's facts: "${expertOutput}" and the student's emotion: "${emotionDetected}", decide HOW to teach this. Should we use Socratic questioning, a real-world analogy, or just give the answer? Output your strategy.`,
        baseContext
      )

      // 4. Meta Agent (Synthesizer)
      finalResponse = await callGemini(
        `You are the Meta-Agent (StudyBud / ATLAS), the student's warm and encouraging AI study partner. Synthesize the final response to the student.
         Expert Facts: ${expertOutput}
         Teaching Strategy: ${pedagogyOutput}
         Tone to use based on emotion: ${emotionDetected}

         GROUNDING REQUIREMENT: The user prompt below contains a "STUDENT ACTIVITY SNAPSHOT" with
         what they've actually done (tasks completed, uploads, tests, classes, videos, prescriptions, memories).
         You MUST reference concrete items from that snapshot when relevant (e.g. "I see you completed Day 3
         yesterday", "your last test flagged Rotational Dynamics", "you uploaded a PDF on Kinematics on Apr 22").
         Do NOT claim you don't know what they've done — the snapshot is your memory. If the snapshot is empty,
         acknowledge that it's a fresh start and invite them to share context.

         Write the actual message the student will see. Keep it engaging, empathetic, and adhering to the strategy. Do not mention that you are an AI or agents.
         
         CRITICAL UI ROUTING: You control the student's UI workspace. If the student implicitly or explicitly asks to:
         - Watch videos or lectures: append exactly [ACTION:NAVIGATE_VIDEOS] at the end of your response.
         - Take a test, practice quiz, or solve papers: append exactly [ACTION:NAVIGATE_TEST]
         - View their knowledge graph or atlas: append exactly [ACTION:NAVIGATE_ATLAS]
         - See their study plans or curriculum: append exactly [ACTION:NAVIGATE_PLANS]
         
         Only append ONE tag if a transition is strongly requested. Otherwise, just output your normal conversational response.`,
        baseContext
      )

      // Log the conversation flow asynchronously
      const logPromises = [
        { name: 'Emotional Agent', role: 'monitor', output: emotionalOutput },
        { name: 'Expert Agent', role: 'subject_matter', output: expertOutput },
        { name: 'Pedagogy Agent', role: 'teaching_strategy', output: pedagogyOutput },
        { name: 'Meta Agent', role: 'synthesizer', output: finalResponse }
      ].map(agent => 
         supabaseClient.from('agent_conversations').insert({
            session_id,
            user_id: user.id,
            agent_name: agent.name,
            agent_role: agent.role,
            output: agent.output,
            input_context: { message }
         })
      )
      
      Promise.all(logPromises).catch(console.error)
      } catch (orchErr) {
        console.error('Orchestration failed, falling back to single call:', orchErr)
        // Fallback: single direct Gemini call so the user always gets a response
        try {
          finalResponse = await callGemini(
            "You are ATLAS, a warm, friendly, and encouraging AI study partner. The user prompt contains a STUDENT ACTIVITY SNAPSHOT — ground your answer in it and reference concrete items when relevant. Provide a kind, supportive, and motivating answer.",
            baseContext
          )
        } catch (fallbackErr) {
          console.error('Fallback Gemini call also failed:', fallbackErr)
          finalResponse = "I'm having trouble reaching my reasoning engine right now. Please try again in a moment."
        }
      }
    }

    return new Response(JSON.stringify({ 
      response: finalResponse,
      emotion_detected: emotionDetected,
      pedagogical_mode: pedagogicalMode,
      orchestration_used: use_full_orchestration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
