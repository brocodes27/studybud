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

    const { failing_concept_text, k_nearest = 3 } = await req.json()

    // 1. Generate Embedding for the student's failing construct
    const embeddingRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           model: "models/text-embedding-004",
           content: { parts: [{ text: failing_concept_text }] }
        })
    })

    const embeddingData = await embeddingRes.json()
    const embeddingVector = embeddingData.embedding?.values

    if (!embeddingVector) {
        throw new Error("Failed to generate embedding for diagnosis query");
    }

    const pgVectorStr = `[${embeddingVector.join(',')}]`

    // 2. Perform RPC similarity search
    const { data: similarNodes, error: rpcError } = await supabaseClient.rpc('match_knowledge_components', {
        query_embedding: pgVectorStr,
        match_threshold: 0.65, // Must be somewhat related
        match_count: k_nearest
    })

    if (rpcError) throw rpcError;

    // 3. For the nearest nodes, let's artificially check if the student's cognitive profile
    // indicates weakness on these specific nodes. We pull their BKT "p_mastery" state.
    const nodeIds = similarNodes.map((n: any) => n.id)
    
    let diagnosis = []

    if (nodeIds.length > 0) {
       const { data: profileData } = await supabaseClient
         .from('student_cognitive_profiles')
         .select('component_id, p_mastery, noetic_tier')
         .eq('user_id', user.id)
         .in('component_id', nodeIds)

       // Merge the semantic graph match with the statistical mastery data
       diagnosis = similarNodes.map((node: any) => {
          const profile = profileData?.find(p => p.component_id === node.id)
          return {
             ...node,
             student_mastery: profile?.p_mastery || 0.0, // Default prior if not yet encountered
             cognitive_tier: profile?.noetic_tier || 'anoetic',
             is_gap: (profile?.p_mastery || 0.0) < 0.6 // Arbitrary threshold indicating gap
          }
       })
    }

    // Sort so the biggest gaps (lowest mastery) surface first
    diagnosis.sort((a, b) => a.student_mastery - b.student_mastery)

    return new Response(JSON.stringify({ 
      diagnosis_nodes: diagnosis,
      suggested_remediation: diagnosis.filter(d => d.is_gap).map(d => d.topic).slice(0, 2)
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
