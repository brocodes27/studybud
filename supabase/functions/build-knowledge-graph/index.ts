import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

// CORS handled per-request via getCors()

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

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

    // Ensure authorized (only admins or service callers should build the core graph)
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    // Accepts the JSON array array of knowledge components
    const { nodes } = await req.json()

    if (!Array.isArray(nodes)) {
       throw new Error("Payload must contain a 'nodes' array")
    }

    let insertedCount = 0;

    for (const node of nodes) {
      // 1. Generate Embedding string to represent the node semantically
      const contentToEmbed = `Subject: ${node.subject}. Topic: ${node.topic}. Subtopics: ${node.subtopic}`
      
      const embeddingRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
             model: "models/text-embedding-004",
             content: { parts: [{ text: contentToEmbed }] }
          })
      })

      const embeddingData = await embeddingRes.json()
      const embeddingVector = embeddingData.embedding?.values

      if (!embeddingVector) {
          console.error(`Failed to generate embedding for ${node.topic}`);
          continue;
      }

      // 2. Upsert into Supabase using topic+subject as natural composite representation
      // We will perform an upsert depending on uniqueness constraints, or simple insert since it's a seed
      // Note: vector string format for Postgres is '[0.1, 0.2, ...]'
      const pgVectorStr = `[${embeddingVector.join(',')}]`

      const { error: dbError } = await supabaseClient.from('knowledge_components').upsert({
          subject: node.subject,
          topic: node.topic,
          subtopic: node.subtopic,
          difficulty_tier: node.difficulty_tier || 1,
          exam_types: node.exam_types || ['JEE Mains'],
          bloom_level: node.bloom_level || 'understand',
          embedding: pgVectorStr
      }, { onConflict: 'id', ignoreDuplicates: false })

      if (dbError) {
          console.error("DB Error on graph insert:", dbError)
      } else {
          insertedCount++;
      }
    }

    // Ideally, we'd also generate the knowledge_graph_edges here (Prerequisites map).
    // For now, we are ingesting the nodes as a flat semantic vector space.

    return new Response(JSON.stringify({ success: true, inserted: insertedCount }), {
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
