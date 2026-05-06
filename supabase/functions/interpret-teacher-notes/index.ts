import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

interface InterpretResult {
  success: boolean;
  interpreted_text: string;
  study_tasks: string;
  topics_identified: string[];
  key_concepts: string[];
  recommended_tasks: Array<{
    type: 'review' | 'practice' | 'retrieval' | 'timed';
    description: string;
    duration_min: number;
  }>;
  practice_questions?: Array<{
    question_text: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    question_type?: 'mcq' | 'numerical' | 'subjective' | 'short_answer';
    topic?: string;
    options?: string[];
  }>;
}

const SYSTEM_PROMPT = `You are an expert JEE (Joint Entrance Examination) study planner. Given the teacher's notes PDF pages, interpret the content and generate personalized study tasks for students.

Your response must:
1. Identify key concepts and topics covered in the notes
2. Generate 3-5 specific study tasks based on the content
3. Generate 5-8 practice questions strictly from the uploaded notes and listed topics
4. Each task should have: type (review/practice/retrieval/timed), description, and estimated duration
5. Suggest a logical study sequence: first revise the notes, then practice, then test yourself
6. Flag any conceptually difficult areas that students typically struggle with

Return JSON with:
- "interpreted_text": summary of what the teacher covered
- "topics_identified": array of topics/subtopics
- "key_concepts": array of key formulas/concepts students must remember
- "study_tasks": array of tasks with type, description, duration_min
- "study_sequence": recommended order of activities
- "practice_questions": array of questions with question_text, difficulty, question_type, topic, options if MCQ

Rules:
- Keep task descriptions specific to the notes content
- Duration in minutes, 10-45 min per task
- Types: "review" (read/revise notes), "practice" (solve problems), "retrieval" (closed-book recall), "timed" (test under pressure)
- Suggest first task as "review" so students start by revising notes
- If notes contain problem lists, suggest "practice" tasks
- If concepts are new/hard, suggest "retrieval" first to check understanding
- Practice questions must be answerable from the notes/topics, not generic syllabus questions`;

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
    const sbAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { class_session_id, file_url, pages, topics, subject } = await req.json();

    if (!class_session_id) {
      return new Response(JSON.stringify({ error: 'class_session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response(JSON.stringify({ error: 'pages (array of base64 image strings) required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context
    const contextInfo = topics?.length
      ? `Teacher covered: ${topics.join(', ')}. Subject: ${subject || 'General'}`
      : `Subject: ${subject || 'General'}`;

    const allContent: string[] = [];
    const allTasks: any[] = [];
    const allQuestions: any[] = [];
    let keyConcepts: string[] = [];
    let topicsIdentified: string[] = [];

    // Process pages in batches of 3
    for (let i = 0; i < pages.length; i += 3) {
      const batch = pages.slice(i, i + 3);
      const batchNum = Math.floor(i / 3) + 1;

      const messages: GeminiMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Context: ${contextInfo}\n\nInterpret these teacher notes pages and generate study tasks.` },
            ...batch.map((pageDataUrl: string) => ({
              type: 'image' as const,
              dataUrl: pageDataUrl,
            })),
          ],
        },
      ];

      try {
        const result = await callGeminiJSON<InterpretResult>(messages, { temperature: 0.3 });
        if (result.interpreted_text) allContent.push(result.interpreted_text);
        if (result.study_tasks) {
          try {
            const tasks = typeof result.study_tasks === 'string' ? JSON.parse(result.study_tasks) : result.study_tasks;
            if (Array.isArray(tasks)) allTasks.push(...tasks);
          } catch {
            // study_tasks might be plain text, add as review task
            allTasks.push({ type: 'review', description: result.study_tasks, duration_min: 20 });
          }
        }
        if (result.recommended_tasks?.length) allTasks.push(...result.recommended_tasks);
        if (result.practice_questions?.length) allQuestions.push(...result.practice_questions);
        if (result.key_concepts?.length) keyConcepts.push(...result.key_concepts);
        if (result.topics_identified?.length) topicsIdentified.push(...result.topics_identified);
      } catch (e) {
        console.error(`Batch ${batchNum} failed:`, e);
      }
    }

    const interpretedText = allContent.join('\n\n');
    const studyTasks = allTasks.slice(0, 6).map((t, idx) => ({
      order: idx + 1,
      type: t.type || 'review',
      description: t.description || t,
      duration_min: t.duration_min || 20,
    }));

    // Ensure first task is a review task (revise the notes)
    if (studyTasks.length > 0 && studyTasks[0].type !== 'review') {
      studyTasks.unshift({
        order: 0,
        type: 'review',
        description: `First: Revise the teacher's notes. Read through all key concepts and formulas covered today.`,
        duration_min: 15,
      });
    }

    const uniqueTopics = [...new Set([...(topicsIdentified || []), ...((topics || []) as string[])])];
    const questionRows = allQuestions
      .filter((q) => q?.question_text && String(q.question_text).trim().length > 10)
      .slice(0, 12)
      .map((q) => ({
        source_type: 'custom',
        source_id: class_session_id,
        question_text: String(q.question_text).trim(),
        difficulty: q.difficulty || 'medium',
        error_type_hint: q.question_type === 'mcq' ? 'mcq' : q.question_type === 'numerical' ? 'calculation' : 'concept',
        options: Array.isArray(q.options) && q.options.length ? q.options : null,
        marks: q.question_type === 'mcq' ? 4 : 2,
        negative_marks: q.question_type === 'mcq' ? 1 : 0,
        tags: [...new Set([subject || 'General', q.topic, ...uniqueTopics].filter(Boolean))],
      }));

    if (questionRows.length > 0) {
      const { error: insertError } = await sbAdmin.from('question_metadata').insert(questionRows);
      if (insertError) console.error('Failed to insert note-derived questions:', insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      interpreted_text: interpretedText || 'Notes processed successfully',
      study_tasks: JSON.stringify(studyTasks),
      topics_identified: uniqueTopics,
      key_concepts: [...new Set(keyConcepts)],
      questions_generated: questionRows.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('interpret-teacher-notes error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});