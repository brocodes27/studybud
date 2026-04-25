import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { output_id, task_title, subject, output_type, text_content } = await req.json()

    let analysisContext = ""

    if (output_type === 'image' && text_content) {
      analysisContext = "Evaluate the handwritten notes/work in the provided image."
    } else if (output_type === 'text') {
      analysisContext = `Evaluate this student submission text: "${text_content}"`
    } else {
      analysisContext = "A PDF file was uploaded. Provide general encouraging feedback."
    }

    const messages: GeminiMessage[] = [
      {
        role: "system",
        content: `You are Ranjan Sir, a warm and encouraging JEE mentor. Evaluate the student's task output for "${task_title}" with kindness and constructive encouragement. Provide JSON response: { "effort_score": number(1-10), "accuracy_score": number(1-10), "feedback": "string", "identified_weaknesses": ["string"], "next_steps": ["string"] }`
      }
    ]

    if (output_type === 'image' && text_content) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: analysisContext },
          { type: "image", dataUrl: text_content }
        ]
      })
    } else {
      messages.push({ role: "user", content: analysisContext })
    }

    const parsed = await callGeminiJSON<any>(messages, { temperature: 0.3 })

    // Update the task_outputs table with analysis
    if (output_id) {
        const { error: updateError } = await supabaseClient
        .from('task_outputs')
        .update({ ai_analysis: parsed, updated_at: new Date().toISOString() })
        .eq('id', output_id)

        if (updateError) throw updateError
    }

    // Record weaknesses in knowledge graph
    if (parsed.identified_weaknesses?.length > 0) {
        for (const weakness of parsed.identified_weaknesses) {
            await supabaseClient.from('user_knowledge').insert({
                user_id: user.id,
                topic: weakness,
                subject: subject || 'General',
                knowledge_type: 'weakness_identified',
                content: `Identified via task output: ${task_title}`,
                source_type: 'task_output',
                metadata: { task_title, weakness },
                confidence: 0.8,
                source: 'analyse-task-output'
            })
        }
    }

    if (task_title) {
      await supabaseClient.from('user_knowledge').insert({
        user_id: user.id,
        topic: task_title,
        subject: subject || 'General',
        knowledge_type: 'task_output_feedback',
        content: parsed.feedback || `Analyzed task output for ${task_title}`,
        source_type: 'task_output',
        source: 'analyse-task-output',
        confidence: 0.75,
        metadata: {
          effort_score: parsed.effort_score ?? null,
          accuracy_score: parsed.accuracy_score ?? null,
          next_steps: parsed.next_steps ?? [],
        }
      })
    }

    if (subject || parsed.identified_weaknesses?.length > 0) {
      const { data: existingProfile } = await supabaseClient
        .from('student_behavioral_profiles')
        .select('weak_subjects')
        .eq('user_id', user.id)
        .maybeSingle()

      const mergedWeakSubjects = new Set<string>(existingProfile?.weak_subjects || [])
      if (subject) mergedWeakSubjects.add(subject)

      await supabaseClient
        .from('student_behavioral_profiles')
        .upsert({
          user_id: user.id,
          weak_subjects: Array.from(mergedWeakSubjects).filter(Boolean),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    }

    await supabaseClient.rpc('refresh_behavioral_profile', {
      p_user_id: user.id
    })

    return new Response(JSON.stringify({ success: true, analysis: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
