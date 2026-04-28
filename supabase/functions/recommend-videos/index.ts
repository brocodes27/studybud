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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    const { query_text, component_id = null, limit = 5 } = await req.json()

    if (!query_text) {
        throw new Error("Missing query_text")
    }

    // 1. Generate text embedding for the query
    const embeddingRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           model: "models/text-embedding-004",
           content: { parts: [{ text: query_text }] }
        })
    })

    const embeddingData = await embeddingRes.json()
    const embeddingVector = embeddingData.embedding?.values

    if (!embeddingVector) {
        throw new Error("Failed to generate embedding for the search query");
    }

    const pgVectorStr = `[${embeddingVector.join(',')}]`

    // 2. Perform RPC similarity search against YouTube Index
    const { data: videos, error: rpcError } = await supabaseClient.rpc('match_youtube_videos', {
        query_embedding: pgVectorStr,
        match_threshold: 0.5,
        match_count: limit
    })

    if (rpcError) throw rpcError;

    // 3. Cache the recommendation asynchronously if component_id is provided
    if (component_id && videos && videos.length > 0) {
        const insertPromises = videos.slice(0, 2).map((v: any) => 
            supabaseClient.from('video_recommendations').upsert({
                user_id: user.id,
                component_id: component_id,
                video_id: v.id,
                reasoning: `Highly relevant semantic match for: ${query_text}`
            }, { onConflict: 'user_id, component_id, video_id', ignoreDuplicates: true })
        );
        Promise.all(insertPromises).catch(e => console.error("Cache recommendation error:", e))
    }

    return new Response(JSON.stringify({ recommendations: videos || [] }), {
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
