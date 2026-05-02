import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

interface ExtractedQuestion {
  topic: string;
  subtopic?: string;
  question_text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'numerical' | 'subjective';
  correct_answer?: string;
  options?: string[];
  tags?: string[];
}

interface ExtractionResult {
  questions: ExtractedQuestion[];
}

const SYSTEM_PROMPT = `You are an expert JEE (Joint Entrance Examination) question extractor. Given a page from a Bullet Point Problems (BPP) PDF, extract all questions in structured JSON format.

Rules:
- Extract ONLY questions that appear on this page
- For each question determine: topic, subtopic, question text, difficulty (easy/medium/hard), type (mcq/numerical/subjective)
- Topics must be one of: Kinematics, Laws of Motion, Work Energy Power, Rotational Dynamics, Gravitation, Electrostatics, Current Electricity, Magnetism, EMI, AC Circuits, Photoelectric Effect, Atoms, Nuclei, Semiconductors, Mole Concept, Thermodynamics, Equilibrium, Electrochemistry, Chemical Kinetics, GOC, Hydrocarbons, Haloalkanes, Alcohols Phenols Ethers, Amines, Periodic Table, Chemical Bonding, Coordination Compounds, p-Block, Limits, Continuity Differentiability, Applications of Derivatives, Integrals, Differential Equations, Quadratic Equations, Sequences Series, Complex Numbers, Matrices Determinants, Probability, Straight Lines, Circles, Parabola, Ellipse, Hyperbola
- MCQs must include all 4 options (A/B/C/D)
- Difficulty: JEE-main level = easy, JEE-main hard = medium, JEE-advanced = hard
- Tags should include subject and relevant sub-topics
- Return JSON array with "questions" key
- If no questions found on page, return { "questions": [] }
- NEVER guess. Only extract what is clearly visible.`;

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
    const { class_session_id, file_url, pages } = await req.json();

    if (!class_session_id || !file_url) {
      return new Response(JSON.stringify({ error: 'class_session_id and file_url are required' }), {
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

    // Validate class_session exists
    const { data: sessionData, error: sessionError } = await sbAdmin
      .from('class_attendance_sessions')
      .select('id, class_id, subject, topics_covered')
      .eq('id', class_session_id)
      .maybeSingle();
    if (sessionError || !sessionData) {
      return new Response(JSON.stringify({ error: 'Class session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get class info for subject
    const { data: classData } = await sbAdmin
      .from('classes')
      .select('subject')
      .eq('id', sessionData.class_id)
      .maybeSingle();

    const allQuestions: ExtractionResult['questions'] = [];

    // Process pages in batches of 3 (avoid token limits)
    for (let i = 0; i < pages.length; i += 3) {
      const batch = pages.slice(i, i + 3);
      const batchNum = Math.floor(i / 3) + 1;

      const messages: GeminiMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: batch.map((pageDataUrl: string, idx: number) => ({
            type: 'image' as const,
            dataUrl: pageDataUrl,
          })),
        },
      ];

      try {
        const result = await callGeminiJSON<ExtractionResult>(messages, { temperature: 0.1 });
        if (result.questions && result.questions.length > 0) {
          allQuestions.push(...result.questions);
        }
      } catch (e) {
        console.error(`Batch ${batchNum} failed:`, e);
        // Continue with other batches
      }
    }

    // Insert questions into database
    let insertedCount = 0;
    if (allQuestions.length > 0) {
      const questionRows = allQuestions.map((q) => ({
        source_type: 'bpp' as const,
        source_id: class_session_id,
        question_text: q.question_text,
        difficulty: q.difficulty,
        error_type_hint: q.question_type === 'mcq' ? 'mcq' : q.question_type === 'numerical' ? 'speed' : 'concept',
        options: q.options || null,
        marks: 4,
        negative_marks: 1,
        tags: [...(q.tags || []), sessionData.subject || classData?.subject || 'General', q.topic],
        bpp_session_id: class_session_id,
      }));

      const { error: insertError } = await sbAdmin.from('question_metadata').insert(questionRows);
      if (insertError) {
        console.error('Failed to insert questions:', insertError);
      } else {
        insertedCount = questionRows.length;
      }
    }

    // Update class_session_bpp record
    const { data: bppRecord } = await sbAdmin
      .from('class_session_bpp')
      .select('id')
      .eq('class_session_id', class_session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bppRecord) {
      await sbAdmin
        .from('class_session_bpp')
        .update({ processed: true, question_count: insertedCount, extracted_at: new Date().toISOString() })
        .eq('id', bppRecord.id);
    }

    return new Response(JSON.stringify({
      success: true,
      total_pages: pages.length,
      questions_extracted: insertedCount,
      topics_identified: [...new Set(allQuestions.map((q) => q.topic))],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('extract-bpp-questions error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
