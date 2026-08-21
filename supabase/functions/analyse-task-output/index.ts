import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

serve(async (req: Request) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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

    const requestBody = await req.json()
    const { output_id, task_title, subject } = requestBody
    let output_type = requestBody.output_type
    let text_content = requestBody.text_content

    if (output_id) {
      const { data: ownedOutput, error: ownedOutputError } = await supabaseClient
        .from('task_outputs')
        .select('output_type, text_content, file_url, ai_analysis, source_key')
        .eq('id', output_id)
        .eq('user_id', user.id)
        .single()
      if (ownedOutputError || !ownedOutput) {
        return new Response(JSON.stringify({ error: 'Task output not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (ownedOutput.ai_analysis) {
        return new Response(JSON.stringify({ success: true, analysis: ownedOutput.ai_analysis, already_analyzed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      output_type = ownedOutput.output_type
      text_content = ownedOutput.text_content
      if (output_type === 'image' && ownedOutput.file_url?.startsWith('storage://submissions/')) {
        const storagePath = ownedOutput.file_url.replace('storage://submissions/', '')
        if (!storagePath.startsWith(`${user.id}/`)) {
          return new Response(JSON.stringify({ error: 'Attachment ownership mismatch' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { data: imageBlob, error: imageError } = await supabaseClient.storage
          .from('submissions')
          .download(storagePath)
        if (!imageError && imageBlob && imageBlob.size <= 8 * 1024 * 1024) {
          const bytes = new Uint8Array(await imageBlob.arrayBuffer())
          text_content = `data:${imageBlob.type || 'image/jpeg'};base64,${encodeBase64(bytes)}`
        }
      }
    }

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

    // Record weaknesses in knowledge graph
    if (parsed.identified_weaknesses?.length > 0) {
        for (const weakness of parsed.identified_weaknesses) {
        const weaknessPayload = {
          user_id: user.id,
          topic: weakness,
          subject: subject || 'General',
          knowledge_type: 'weakness_identified',
          content: `Identified via task output: ${task_title}`,
          source_type: 'task_output',
          metadata: { task_title, weakness },
          confidence: 0.8,
          source: 'analyse-task-output',
          assessment_source_id: output_id
            ? `task-output:${output_id}:weakness:${String(weakness).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`
            : null,
        }
        const weaknessResult = output_id
          ? await supabaseClient.from('user_knowledge').upsert(weaknessPayload, { onConflict: 'user_id,assessment_source_id' })
          : await supabaseClient.from('user_knowledge').insert(weaknessPayload)
        if (weaknessResult.error) throw weaknessResult.error
        }
    }

    if (task_title) {
      const feedbackPayload = {
        user_id: user.id,
        topic: task_title,
        subject: subject || 'General',
        knowledge_type: 'task_output_feedback',
        content: parsed.feedback || `Analyzed task output for ${task_title}`,
        source_type: 'task_output',
        source: 'analyse-task-output',
        confidence: 0.75,
        assessment_source_id: output_id ? `task-output:${output_id}:feedback` : null,
        metadata: {
          effort_score: parsed.effort_score ?? null,
          accuracy_score: parsed.accuracy_score ?? null,
          next_steps: parsed.next_steps ?? [],
        }
      }
      const feedbackResult = output_id
        ? await supabaseClient.from('user_knowledge').upsert(feedbackPayload, { onConflict: 'user_id,assessment_source_id' })
        : await supabaseClient.from('user_knowledge').insert(feedbackPayload)
      if (feedbackResult.error) throw feedbackResult.error
    }

    if (subject || parsed.identified_weaknesses?.length > 0) {
      const { data: existingProfile } = await supabaseClient
        .from('student_behavioral_profiles')
        .select('weak_subjects')
        .eq('user_id', user.id)
        .maybeSingle()

      const mergedWeakSubjects = new Set<string>(existingProfile?.weak_subjects || [])
      if (subject) mergedWeakSubjects.add(subject)

      const { error: profileError } = await supabaseClient
        .from('student_behavioral_profiles')
        .upsert({
          user_id: user.id,
          weak_subjects: Array.from(mergedWeakSubjects).filter(Boolean),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (profileError) throw profileError
    }

    const { error: refreshError } = await supabaseClient.rpc('refresh_behavioral_profile', {
      p_user_id: user.id
    })
    if (refreshError) throw refreshError

    // Mark analysis complete only after every idempotent knowledge side effect
    // succeeds. Retries can safely repair partial work until this final write.
    if (output_id) {
      const { error: updateError } = await supabaseClient
        .from('task_outputs')
        .update({ ai_analysis: parsed, updated_at: new Date().toISOString() })
        .eq('id', output_id)
        .eq('user_id', user.id)
      if (updateError) throw updateError
    }

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
