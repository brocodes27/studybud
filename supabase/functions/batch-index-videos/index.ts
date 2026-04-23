import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    const { playlist_id, subject = 'General' } = await req.json()
    if (!playlist_id) throw new Error("Missing playlist_id")
    if (!YOUTUBE_API_KEY) throw new Error("Server is missing YOUTUBE_API_KEY")

    // Fetch playlist items
    const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlist_id}&key=${YOUTUBE_API_KEY}`)
    if (!playlistRes.ok) throw new Error("Failed to fetch playlist")
    
    const playlistData = await playlistRes.json()
    const items = playlistData.items || []

    let successCount = 0;
    
    // We loop through and call the single video indexer logically or replicate logic
    // Replicating logic here for speed instead of HTTP chaining
    const BATCH_SIZE = 5;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (item: any) => {
            const snippet = item.snippet;
            const video_id = snippet.resourceId.videoId;
            const title = snippet.title;
            const description = snippet.description;
            const channel_id = snippet.videoOwnerChannelId;
            const thumbnail_url = snippet.thumbnails?.high?.url;

            const contentToEmbed = `Title: ${title}. Description: ${description}. Subject: ${subject}.`
            
            const embeddingRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                   model: "models/text-embedding-004",
                   content: { parts: [{ text: contentToEmbed }] }
                })
            });

            const embeddingData = await embeddingRes.json()
            const embeddingVector = embeddingData.embedding?.values

            if (!embeddingVector) return false;

            const pgVectorStr = `[${embeddingVector.join(',')}]`

            const { error: dbError } = await supabaseClient.from('youtube_video_index').upsert({
                video_id, channel_id, title, description, subject, thumbnail_url,
                embedding: pgVectorStr, last_indexed: new Date().toISOString()
            }, { onConflict: 'video_id' });

            return !dbError;
        });

        const results = await Promise.all(promises);
        successCount += results.filter(Boolean).length;
    }

    return new Response(JSON.stringify({ success: true, total_indexed: successCount }), {
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
