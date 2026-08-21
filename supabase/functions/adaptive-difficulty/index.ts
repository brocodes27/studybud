import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

// Configuration & Default CORS Headers
// CORS handled per-request via getCors()

serve(async (req) => {
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json'} })
    }

    const {
      subject,
      topic,
      topics,
      kc_ids,
      count = 10,
      source,
      student_user_id,
      class_name,
      homework_type,
    } = await req.json()
    const requestedCount = Math.max(1, Math.min(10, Number(count) || 4))
    const requestedTopics = Array.isArray(topics)
      ? topics.map(String).map((value: string) => value.trim()).filter(Boolean)
      : topic
        ? [String(topic).trim()]
        : []
    const targetUserId = student_user_id || user.id
    const sanitizeQuestion = (question: any) => ({
      id: question.id,
      kc_id: question.kc_id,
      question: question.question || question.question_text || question.prompt,
      options: Array.isArray(question.options) ? question.options : null,
      qtype: question.qtype || question.question_type || null,
      difficulty: question.difficulty || null,
      chapter: question.chapter || null,
      topic: question.knowledge_components?.topic || question.topic || topic || null,
      subtopic: question.knowledge_components?.subtopic || question.subtopic || null,
      p_correct: question.p_correct,
    })
    const generateSpecificQuestions = async (
      needed: number,
      excludedQuestions: string[] = [],
    ) => {
      if (needed <= 0) return []
      const topicList = requestedTopics.length ? requestedTopics : [String(topic || 'the selected lesson')]
      const messages: GeminiMessage[] = [
        {
          role: 'system',
          content: `You write teacher-ready, curriculum-aligned homework questions.
Return strict JSON: {"questions":[{"question":"...","options":null,"difficulty":"guided|check","topic":"..."}]}.

Rules:
- Return exactly the requested number of questions.
- Every question must be concrete, self-contained, and directly answerable.
- Never write vague prompts such as "solve one example", "explain the concept", or "write about this topic".
- For Mathematics and Physics, include all necessary numbers, units, diagrams-as-text, or conditions.
- For Chemistry and Biology, use precise processes, observations, data, structures, or scenarios.
- For Social Science, ask about a named event, institution, location, source, comparison, or cause/effect relationship.
- For English, Hindi, and Sanskrit, include the exact sentence, short passage, word, grammar form, or text reference needed.
- Spread questions across all selected topics as evenly as possible.
- Do not include answers, answer keys, solutions, hints, explanations, rubrics, or internal reasoning.
- Keep each question suitable for independent student work.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: `Generate exactly ${needed} distinct homework questions`,
            class: class_name || 'Use the subject-appropriate school level',
            subject: subject || 'General',
            topics: topicList,
            mode: homework_type || 'guided_practice',
            already_used_questions: excludedQuestions,
          }),
        },
      ]
      const generated = await callGeminiJSON<{ questions?: any[] }>(messages, {
        temperature: 0.45,
        maxOutputTokens: 4096,
      })
      return (Array.isArray(generated?.questions) ? generated.questions : [])
        .map(sanitizeQuestion)
        .filter((question: any) => String(question.question || '').trim())
        .slice(0, needed)
    }

    if (targetUserId !== user.id) {
      const { data: teacherClass } = await supabaseClient
        .from('class_members')
        .select('class_id, classes!inner(teacher_id)')
        .or(`user_id.eq.${targetUserId},student_id.eq.${targetUserId}`)
        .eq('classes.teacher_id', user.id)
        .limit(1)
        .maybeSingle()

      let canSupportStudent = Boolean(teacherClass)
      if (!canSupportStudent) {
        const { data: requesterMembership } = await supabaseClient
          .from('memberships')
          .select('school_id, role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('role', ['org_admin', 'principal'])
          .limit(1)
          .maybeSingle()
        if (requesterMembership) {
          const { data: studentMembership } = await supabaseClient
            .from('memberships')
            .select('user_id')
            .eq('user_id', targetUserId)
            .eq('school_id', requesterMembership.school_id)
            .eq('status', 'active')
            .maybeSingle()
          canSupportStudent = Boolean(studentMembership)
        }
      }
      if (!canSupportStudent) {
        return new Response(JSON.stringify({ error: 'Not authorized to adapt work for this student' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 1. Fetch relevant Knowledge Components (KCs) if not provided
    let target_kc_ids = kc_ids || []
    if (target_kc_ids.length === 0 && subject) {
      if (requestedTopics.length) {
        // Curriculum selections may point at either a topic or a subtopic.
        // Resolve both namespaces so a precise NCERT subtopic does not fall
        // through to unrelated random questions.
        const [topicResult, subtopicResult] = await Promise.all([
          supabaseClient
            .from('knowledge_components')
            .select('id')
            .ilike('subject', subject)
            .in('topic', requestedTopics)
            .limit(50),
          supabaseClient
            .from('knowledge_components')
            .select('id')
            .ilike('subject', subject)
            .in('subtopic', requestedTopics)
            .limit(50),
        ])
        target_kc_ids = Array.from(new Set([
          ...(topicResult.data || []).map(kc => kc.id),
          ...(subtopicResult.data || []).map(kc => kc.id),
        ]))
      } else {
        const { data: kcs } = await supabaseClient
          .from('knowledge_components')
          .select('id')
          .ilike('subject', subject)
          .limit(50)
        if (kcs) target_kc_ids = kcs.map(kc => kc.id)
      }
    }

    if (target_kc_ids.length === 0) {
      // A curriculum selection can be valid even before its question-bank/KC
      // mapping is populated. Generate concrete questions instead of returning
      // unrelated random items or vague client-side placeholders.
      const generatedQuestions = await generateSpecificQuestions(requestedCount)
      if (generatedQuestions.length !== requestedCount) {
        throw new Error(`Question generation returned ${generatedQuestions.length} of ${requestedCount} requested questions`)
      }
      return new Response(JSON.stringify({
        questions: generatedQuestions,
        mechanism: 'curriculum_ai_fallback',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Fetch Student's Mastery Profile for these KCs
    const { data: profiles } = await supabaseClient
      .from('student_cognitive_profiles')
      .select('kc_id, p_mastery')
      .eq('user_id', targetUserId)
      .in('kc_id', target_kc_ids)
    
    // Map of kc_id -> mastery (default to 0.1 if unseen)
    const masteryMap = new Map(target_kc_ids.map(id => [id, 0.1]))
    profiles?.forEach(p => masteryMap.set(p.kc_id, p.p_mastery))

    // Average mastery to approximate overall 'theta' (student ability)
    let sumMastery = 0;
    masteryMap.forEach(val => sumMastery += val)
    const avgMastery = sumMastery / masteryMap.size
    
    // IRT Theta conversion roughly from [0, 1] mastery to [-3, 3] standard normal
    // a mastery of 0.5 is theta 0, mastery 0.9 is theta 1.5, mastery 0.1 is theta -1.5
    const theta = (avgMastery - 0.5) * 4

    // 3. Fetch Candidate Questions
    const { data: candidates, error: candidateError } = await supabaseClient
      .from('question_bank')
      .select('*, knowledge_components(topic, subtopic)')
      .in('kc_id', target_kc_ids)
      .limit(100) // Fetch pool

    if (candidateError) throw candidateError

    const scoredQuestions = candidates?.map(q => {
      const b = q.irt_difficulty || 0        // standard normal
      const a = q.irt_discrimination || 1.0 // usually [0.5, 2.0]
      const c = q.irt_guessing || 0.25      // probability of guessing 

      // 3-Parameter Logistic (3PL) IRT Model
      // P(correct) = c + (1-c) / (1 + e^(-a * (theta - b)))
      const p_correct = c + (1 - c) / (1 + Math.exp(-a * (theta - b)))

      // We want to maximize Information. Information is highest when P(correct) is midway between c and 1
      // Target probability for "productive struggle" is usually around 0.6 - 0.8
      // We will score items by how close their p_correct is to the optimal target
      const target_p = c + (1 - c) / 2 // Information maximizing point
      
      // Calculate distance to target (smaller is better)
      const distance = Math.abs(p_correct - target_p)

      return {
        ...q,
        p_correct,
        distance
      }
    }) || []

    // 4. Sort by distance (closest to target probability = best for distinguishing ability)
    scoredQuestions.sort((a, b) => a.distance - b.distance)

    // 5. Select top `count`
    // Never expose answer keys, explanations, or internal scoring fields. This
    // function uses service-role reads, so the response must be an explicit
    // student-safe projection rather than raw question-bank rows.
    const selectedQuestions = scoredQuestions.slice(0, requestedCount).map(sanitizeQuestion)
    if (selectedQuestions.length < requestedCount) {
      const generated = await generateSpecificQuestions(
        requestedCount - selectedQuestions.length,
        selectedQuestions.map((question: any) => question.question),
      )
      selectedQuestions.push(...generated)
    }
    if (selectedQuestions.length !== requestedCount) {
      throw new Error(`Question generation returned ${selectedQuestions.length} of ${requestedCount} requested questions`)
    }

    return new Response(JSON.stringify({ 
      questions: selectedQuestions,
      theta_estimate: theta,
      avg_mastery: avgMastery,
      mechanism: 'irt_adaptive'
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
