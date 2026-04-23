import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need admin rights to write to index
    )

    // Authorization verification
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    const { video_id, subject = 'General' } = await req.json()
    if (!video_id) throw new Error("Missing video_id")

    // 1. Fetch metadata from YouTube (if key exists) or use payload overrides
    let title = "Unknown Title"
    let description = "Unknown Description"
    let thumbnail_url = `https://img.youtube.com/vi/${video_id}/maxresdefault.jpg`
    let channel_id = "Unknown"

    if (YOUTUBE_API_KEY) {
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${video_id}&key=${YOUTUBE_API_KEY}`)
        if (ytRes.ok) {
            const ytData = await ytRes.json()
            if (ytData.items && ytData.items.length > 0) {
                const snippet = ytData.items[0].snippet
                title = snippet.title
                description = snippet.description
                channel_id = snippet.channelId
                thumbnail_url = snippet.thumbnails?.high?.url || thumbnail_url
            }
        }
    }

    // 2. Generate Embedding via Gemini (text-embedding-004)
    const contentToEmbed = `Title: ${title}. Description: ${description}. Subject: ${subject}.`
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
        throw new Error("Failed to generate embedding for the video");
    }

    const pgVectorStr = `[${embeddingVector.join(',')}]`

    // 3. Upsert into database
    const { data, error: dbError } = await supabaseClient.from('youtube_video_index').upsert({
        video_id,
        channel_id,
        title,
        description,
        subject,
        thumbnail_url,
        embedding: pgVectorStr,
        last_indexed: new Date().toISOString()
    }, { onConflict: 'video_id' }).select().single()

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, indexed_video: data }), {
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
